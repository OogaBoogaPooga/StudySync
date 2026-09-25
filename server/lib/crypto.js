import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey() {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY missing or too short (need 32+ chars)');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

export function encrypt(plaintext) {
  if (typeof plaintext !== 'string' || !plaintext.length) {
    throw new Error('encrypt: plaintext must be a non-empty string');
  }
  const key = getKey();
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, ct]).toString('base64');
}

export function decrypt(blob) {
  if (typeof blob !== 'string' || !blob.length) {
    throw new Error('decrypt: blob must be a non-empty string');
  }
  const buf = Buffer.from(blob, 'base64');
  if (buf.length < SALT_LEN + IV_LEN + TAG_LEN + 1) {
    throw new Error('decrypt: blob too short / corrupted');
  }
  const salt = buf.subarray(0, SALT_LEN);
  const iv = buf.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = buf.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const ct = buf.subarray(SALT_LEN + IV_LEN + TAG_LEN);
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

export function mask(secret) {
  const s = String(secret || '');
  if (s.length <= 2) return '**';
  return s[0] + '*'.repeat(Math.max(3, s.length - 2)) + s[s.length - 1];
}
