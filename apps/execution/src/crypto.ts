import crypto from 'crypto';

// ENCRYPTION_SECRET is required (no default fallback for production)
if (!process.env.ENCRYPTION_SECRET) {
  throw new Error('ENCRYPTION_SECRET environment variable is required');
}
// Trim quotes and whitespace from ENCRYPTION_SECRET to handle .env file formatting
// This ensures both API and Execution services use the same secret even if quotes are in .env
const rawSecret = process.env.ENCRYPTION_SECRET;
const ENCRYPTION_SECRET = rawSecret.trim().replace(/^['"]|['"]$/g, ''); // Remove surrounding quotes if present
const ALGORITHM = 'aes-256-cbc';

// Log secret info for debugging (first 10 chars only for security)
if (process.env.NODE_ENV === 'development') {
  console.log(`[Crypto] ENCRYPTION_SECRET length: ${ENCRYPTION_SECRET.length}, starts with: ${ENCRYPTION_SECRET.substring(0, 10)}...`);
}

/**
 * Derives a 32-byte key from the encryption secret using SHA-256
 */
function getKey(): Buffer {
  return crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
}

/**
 * Decrypts text encrypted with AES-256-CBC
 * This matches the encryption used in apps/api
 */
export function decrypt(encryptedText: string): string {
  try {
    const key = getKey();
    const parts = encryptedText.split(':');

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`Invalid encrypted text format. Expected format: "iv:encrypted", got ${parts.length} parts`);
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    if (iv.length !== 16) {
      throw new Error(`Invalid IV length. Expected 16 bytes, got ${iv.length}`);
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    const final = decipher.final('utf8');
    decrypted += final;

    if (!decrypted || decrypted.length === 0) {
      throw new Error('Decryption resulted in empty string');
    }

    return decrypted;
  } catch (error: any) {
    // Provide more context about the decryption failure
    if (error.message.includes('Invalid encrypted text format')) {
      throw error;
    }
    throw new Error(`Decryption failed: ${error.message}. This usually means ENCRYPTION_SECRET doesn't match between services.`);
  }
}

