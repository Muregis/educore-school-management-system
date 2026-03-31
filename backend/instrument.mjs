// instrument.mjs — loaded via --import flag before any other module
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  sendDefaultPii: true,

  // 100% in dev, lower in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Capture local variable values in stack frames
  includeLocalVariables: true,

  enableLogs: true,
});
