/**
 * Optional Sentry init for the Node server. Activates only if SENTRY_DSN
 * is set, so dev environments stay quiet and don't require an account.
 *
 * To enable: set SENTRY_DSN in env, `npm i @sentry/node`, then
 * `import "./sentry.mjs"` at the top of your server entry.
 */

if (process.env.SENTRY_DSN) {
  try {
    const Sentry = await import("@sentry/node")
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_RATE || "0.1"),
    })
    console.log("[sentry] initialized")
  } catch (err) {
    console.warn("[sentry] DSN set but @sentry/node not installed:", err.message)
  }
}
