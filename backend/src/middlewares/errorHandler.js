import { HttpError } from '../exceptions/HttpError.js';

export default function errorHandler(err, req, res, next) {
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Invalid input', details: err.issues });
  }

  // Expected errors (404, 403, ...) thrown on purpose by services and middlewares
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  // Anything else is unexpected. Log only the name, message and stack, never the
  // whole error object: some errors carry request data (e.g. a JSON parse error
  // holds the raw body in err.body).
  console.error(err.stack || `${err.name || 'Error'}: ${err.message}`);

  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Something went wrong' : err.message,
  });
}
