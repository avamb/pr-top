/**
 * R15 verification: GatedInstallPrompt only shows on authenticated routes.
 */
const AUTHENTICATED_PREFIXES = [
  '/dashboard', '/clients', '/sessions', '/exercises',
  '/analytics', '/settings', '/subscription', '/admin',
];

const isInAuthenticatedZone = (pathname) =>
  AUTHENTICATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  );

const publicPaths = [
  '/', '/register', '/login', '/forgot-password', '/reset-password',
  '/security/encryption', '/security/gdpr', '/compare/upheal', '/for-coaches',
  '/pricing', '/ru', '/es/terms', '/uk/privacy', '/confirm',
  '/verify-lead', '/share/supervision/abc123',
];

const authPaths = [
  '/dashboard', '/dashboard/guide', '/clients', '/clients/123',
  '/sessions/bulk', '/sessions/abc', '/exercises', '/analytics',
  '/settings', '/subscription', '/subscription/success',
  '/admin', '/admin/therapists', '/admin/settings', '/admin/logs',
];

let passed = 0;
let failed = 0;

publicPaths.forEach((p) => {
  const result = isInAuthenticatedZone(p);
  if (result) {
    console.error(`FAIL [public] InstallPrompt incorrectly shown on: ${p}`);
    failed++;
  } else {
    console.log(`PASS [public] InstallPrompt hidden on: ${p}`);
    passed++;
  }
});

authPaths.forEach((p) => {
  const result = isInAuthenticatedZone(p);
  if (!result) {
    console.error(`FAIL [auth] InstallPrompt incorrectly hidden on: ${p}`);
    failed++;
  } else {
    console.log(`PASS [auth]   InstallPrompt shown on: ${p}`);
    passed++;
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
