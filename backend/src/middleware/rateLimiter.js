/**
 * In-memory sliding-window rate limiter for single-instance Express.
 * 
 * Strict Privacy Requirement:
 * - Does NOT log IP addresses, complaint text, student identity data,
 *   commitments, or nullifiers.
 * - Stores only opaque hash or raw key in memory with timestamp list, cleaned periodically.
 * - Does not break tests when NODE_ENV === 'test' or rate limits disabled.
 */

export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 10,
  message = 'Too many requests, please try again later.',
  skip = () => false,
} = {}) {
  // Map of clientIdentifier -> Array of timestamp numbers
  const hits = new Map();

  // Periodic cleanup every 5 minutes to prevent memory accumulation
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      const active = timestamps.filter((t) => now - t < windowMs);
      if (active.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, active);
      }
    }
  }, 5 * 60 * 1000);

  // Unref so cleanup interval does not block process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  const limiterMiddleware = (req, res, next) => {
    // If rate limiting is globally disabled or skipped (e.g. in certain tests)
    if (process.env.DISABLE_RATE_LIMIT === 'true' || skip(req)) {
      return next();
    }

    const clientKey = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const now = Date.now();

    const clientTimestamps = hits.get(clientKey) || [];
    const validTimestamps = clientTimestamps.filter((t) => now - t < windowMs);

    if (validTimestamps.length >= max) {
      // Do NOT log the IP address or any request details
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({
        ok: false,
        error: message,
      });
    }

    validTimestamps.push(now);
    hits.set(clientKey, validTimestamps);
    next();
  };

  limiterMiddleware.reset = () => {
    hits.clear();
  };

  return limiterMiddleware;
}
