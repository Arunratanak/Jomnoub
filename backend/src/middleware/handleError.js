export default function errorHandler(err, req, res, next) {
  // Log only the name, message and stack, never the whole error object: some
  // errors carry request data (e.g. a JSON parse error holds the raw body in err.body).
  console.error(err.stack || `${err.name || 'Error'}: ${err.message}`);

  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Invalid input', details: err.issues });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Something went wrong' : err.message,
  });
}
