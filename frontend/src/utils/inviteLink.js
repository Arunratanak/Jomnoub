// Accepts a whole invite link or just its code. Only the code is ever used, so a link
// to another website can't send anyone away from Jomnoub.
export function inviteTokenFrom(text) {
  const value = text.trim();
  const fromLink = value.match(/\/invite\/([^/?#\s]+)/);
  const token = fromLink ? fromLink[1] : value;
  return /^[\w-]{20,100}$/.test(token) ? token : null;
}
