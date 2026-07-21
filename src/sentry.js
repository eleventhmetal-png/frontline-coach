import * as Sentry from "@sentry/react";

// Error monitoring only, production builds only.
//
// - The DSN is safe to ship in the client bundle: it only permits SENDING
//   events to Sentry, not reading anything back. It is not a secret.
// - Tracing and Session Replay are intentionally OFF, and sendDefaultPii is
//   FALSE, so no coaching content or employee information is ever sent to
//   Sentry — only the error and stack trace.
// - Gated to import.meta.env.PROD so local `npm run dev` never reports.
//
// Sentry's default init also installs global handlers for uncaught errors and
// unhandled promise rejections, which covers the app's async failures.
if (import.meta.env.PROD) {
  Sentry.init({
    dsn: "https://fd32817bc1f230aa5e2af516d213581f@o4511774047272960.ingest.us.sentry.io/4511774061035520",
    environment: "production",
    sendDefaultPii: false,
  });

  // Route the ErrorBoundary's manual report hook (window.__reportError) into
  // Sentry so React render crashes are captured with their component stack.
  if (typeof window !== "undefined") {
    window.__reportError = (error, info) => {
      try {
        Sentry.captureException(
          error,
          info?.componentStack ? { extra: { componentStack: info.componentStack } } : undefined
        );
      } catch (e) {
        /* never let reporting throw */
      }
    };
  }
}

export { Sentry };
