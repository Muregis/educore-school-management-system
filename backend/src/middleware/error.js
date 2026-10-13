export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === "production";

  // Always log server-side; never send stack to clients in production
  if (status >= 500) {
    console.error("[error]", req?.method, req?.path, err?.message || err);
  } else {
    console.warn("[error]", status, req?.method, req?.path, err?.message || err);
  }

  if (res.headersSent) {
    return next(err);
  }

  const body = {
    message: err.expose || !isProd || status < 500
      ? (err.message || "Request failed")
      : "Internal server error",
  };
  if (!isProd && err.stack) {
    body.stack = err.stack.split("\n").slice(0, 8);
  }
  return res.status(status).json(body);
}
