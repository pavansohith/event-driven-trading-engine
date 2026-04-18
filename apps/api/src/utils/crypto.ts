import crypto from 'crypto';

// Trim quotes and whitespace from ENCRYPTION_SECRET to handle .env file formatting
const ENCRYPTION_SECRET = (process.env.ENCRYPTION_SECRET || 'default-secret-key-change-in-production')
  .trim()
  .replace(/^['"]|['"]$/g, ''); // Remove surrounding quotes if present
const ALGORITHM = 'aes-256-cbc';

/**
 * Derives a 32-byte key from the encryption secret using SHA-256
 */
function getKey(): Buffer {
  return crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
}

/**
 * Encrypts text using AES-256-CBC
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Prepend IV to encrypted data
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypts text encrypted with encrypt()
 */
export function decrypt(encryptedText: string): string {
  const key = getKey();
  const parts = encryptedText.split(':');

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  const final = decipher.final('utf8');
  decrypted += final;

  return decrypted;
}

