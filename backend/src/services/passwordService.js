import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

// scrypt settings from the OWASP password storage guidance: deliberately slow and
// memory-hungry, so stolen hashes are expensive to guess
const N = 2 ** 15;
const R = 8;
const P = 3;
const KEY_LENGTH = 32;
const MAX_MEMORY = 128 * N * R * 2;

const derive = (password, salt, n, r, p, length) =>
  scrypt(password, salt, length, { N: n, r, p, maxmem: MAX_MEMORY });

// Stored as scrypt$N$r$p$salt$hash, so the settings can be raised later
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await derive(password, salt, N, R, P, KEY_LENGTH);
  return ['scrypt', N, R, P, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function verifyPassword(password, stored) {
  const [scheme, n, r, p, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await derive(password, Buffer.from(salt, 'base64url'), Number(n), Number(r), Number(p), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// Run when no account matches, so a wrong email takes as long as a wrong password
// and response times can't reveal which addresses have accounts
const dummyHash = hashPassword(crypto.randomBytes(16).toString('hex'));
export async function fakeVerify(password) {
  await verifyPassword(password, await dummyHash);
  return false;
}
