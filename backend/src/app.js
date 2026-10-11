import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import enrollmentRouter from './routes/enrollment.js';
import complaintContextRouter from './routes/complaintContext.js';
import submitRouter from './routes/submit.js';
import semaphoreGroupRouter from './routes/semaphoreGroup.js';
import insightsRouter from './routes/insights.js';
import { createRateLimiter } from './middleware/rateLimiter.js';

dotenv.config();

const app = express();

const permittedOrigin = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin: permittedOrigin,
    credentials: true,
  })
);

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'incognito-backend',
  });
});

// Basic rate limiters: OTP requests (e.g. 10/15min), Enrollment (10/15min), Submission (15/15min)
// In test environments, tests can disable or test explicitly without breaking existing suites.
const otpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many OTP requests from this connection. Please try again later.',
});

const enrollLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many enrollment attempts. Please try again later.',
});

const submitLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: 'Too many complaint submissions. Please try again later.',
});

// Apply rate limiting to specific endpoints
app.use('/api/request-otp', otpLimiter);
app.use('/api/enroll', enrollLimiter);
app.use('/api/submit', submitLimiter);

app.use('/api', enrollmentRouter);
app.use('/api', complaintContextRouter);
app.use('/api', submitRouter);
app.use('/api', semaphoreGroupRouter);
app.use('/api', insightsRouter);

export default app;
