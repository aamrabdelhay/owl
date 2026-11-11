/**
 * Web Crypto helpers: PBKDF2 password hashing (lock screen) and
 * AES-GCM encryption (Password Keeper vault).
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function randomSalt(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return toHex(arr.buffer as ArrayBuffer);
}

const PBKDF2_ITERATIONS = 150000;

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(saltHex) as unknown as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return toHex(bits);
}

export async function verifyPassword(password: string, saltHex: string, expectedHex: string): Promise<boolean> {
  if (!expectedHex) return false;
  const hash = await hashPassword(password, saltHex);
  // constant-time-ish compare
  if (hash.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  return diff === 0;
}

/* ----------------------------- Vault crypto ----------------------------- */

async function deriveAesKey(master: string, saltHex: string, iterations = 120000): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(master), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromHex(saltHex) as unknown as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedBlob {
  iv: string;
  data: string;
  salt: string;
  verifier: string;
}

export async function encryptVault(master: string, plaintext: string, saltHex?: string): Promise<EncryptedBlob> {
  const salt = saltHex || randomSalt();
  const key = await deriveAesKey(master, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, enc.encode(plaintext));
  const verifier = await hashPassword(master, salt);
  return { iv: toHex(iv.buffer as ArrayBuffer), data: toHex(cipher), salt, verifier };
}

export async function decryptVault(master: string, blob: EncryptedBlob): Promise<string | null> {
  try {
    const key = await deriveAesKey(master, blob.salt);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromHex(blob.iv) as any },
      key,
      fromHex(blob.data) as any
    );
    return dec.decode(plain);
  } catch {
    return null;
  }
}

export function generatePassword(length = 16, opts = { upper: true, digits: true, symbols: true }): string {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%^&*()-_=+[]{}?';
  let pool = lower;
  if (opts.upper) pool += upper;
  if (opts.digits) pool += digits;
  if (opts.symbols) pool += symbols;
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < length; i++) out += pool[arr[i] % pool.length];
  return out;
}

export function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  return { score, label: labels[Math.min(score, 5)] };
}
