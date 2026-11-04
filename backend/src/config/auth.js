const isProd = process.env.NODE_ENV === 'production';

export const SESSION_COOKIE = 'token';
export const SESSION_DAYS = 7;

// Session JWT: HS256 only, so tokens signed any other way are rejected
export const JWT_ALGORITHM = 'HS256';
export const JWT_EXPIRES_IN = `${SESSION_DAYS}d`;

// sameSite 'lax' in every environment: in production the frontend reaches the API
// through the same-origin /api rewrite, so 'none' isn't needed, and 'lax' stops other
// sites from making a logged-in browser send state-changing requests (CSRF).
export const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
};

// Same options without maxAge, so logout clears the exact cookie that login set
const { maxAge, ...clearOptions } = cookieOptions;
export const clearCookieOptions = clearOptions;
