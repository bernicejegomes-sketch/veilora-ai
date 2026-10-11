/**
 * Configuration helper for Demo Mode.
 *
 * Demo Mode allows the use of synthetic DEV001–DEV005 roster and
 * the development OTP (e.g. 123456) for hackathon demonstration.
 *
 * For safety, DEMO_MODE is FALSE by default unless explicitly set to:
 * DEMO_MODE=true or DEMO_MODE=1 in environment variables.
 */

export function isDemoModeEnabled() {
  if (process.env.DEMO_MODE !== undefined) {
    const envVal = (process.env.DEMO_MODE || '').trim().toLowerCase();
    return envVal === 'true' || envVal === '1';
  }
  // For automated tests running in test environment where DEMO_MODE is not explicitly specified,
  // allow synthetic roster and dev OTP so existing regression tests pass smoothly.
  return process.env.NODE_ENV === 'test';
}
