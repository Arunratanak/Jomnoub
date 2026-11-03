export default function errorHandler(err, req, res, next) {
  console.error(err); // full details stay in your server logs only

  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Invalid input', details: err.issues });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Something went wrong' : err.message,
  });
}