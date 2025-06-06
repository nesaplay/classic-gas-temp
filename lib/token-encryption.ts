import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Recommended for GCM
const AUTH_TAG_LENGTH = 16; // Recommended for GCM

const ENCRYPTION_KEY = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY!;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  // Key should be 32 bytes, which is 64 hex characters
  throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY environment variable is missing, invalid, or not 64 hex characters long.');
}

// Convert hex key to buffer
const key = Buffer.from(ENCRYPTION_KEY, 'hex');

export function encryptToken(text: string | null | undefined): string | null {
  if (text === null || text === undefined) {
    return null;
  }

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Prepend IV and authTag to the encrypted text (hex encoded)
    // Format: iv:authTag:encryptedText
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error("Encryption failed:", error);
    // Depending on your error handling strategy, you might want to throw
    // or return null/empty string, but failing might be safer.
    throw new Error("Failed to encrypt token.");
  }
}

export function decryptToken(encryptedText: string | null | undefined): string | null {
  if (encryptedText === null || encryptedText === undefined) {
    return null;
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format.');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    if (iv.length !== IV_LENGTH) {
        throw new Error('Invalid IV length.');
    }
    // Auth tag length check might vary slightly depending on exact crypto version, 
    // but GCM typically uses 16 bytes.
    // if (authTag.length !== AUTH_TAG_LENGTH) { 
    //     throw new Error('Invalid authTag length.');
    // }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    // Handle errors appropriately - often indicates tampering or wrong key
    // Returning null might mask issues, throwing might be better server-side.
    throw new Error("Failed to decrypt token. It might be corrupted or the key is wrong.");
  }
} 