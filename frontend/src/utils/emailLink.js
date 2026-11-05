// Links in account emails carry their token after the # (browsers never send that part
// to servers). Read it once, then remove it from the address bar and browser history.
export function takeTokenFromUrl() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
  if (token) window.history.replaceState(null, '', window.location.pathname);
  return token;
}
