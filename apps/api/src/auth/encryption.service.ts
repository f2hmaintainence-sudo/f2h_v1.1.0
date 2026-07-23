import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly saltLength = 64;
  private readonly tagLength = 16;

  /*===============================================================================================
Encryption Key Management
================================================================================================*/
  private getEncryptionKey(): Buffer {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret) {
      throw new Error(
        'CRITICAL: ENCRYPTION_SECRET environment variable is not set',
      );
    }
    if (secret.length < 32) {
      throw new Error('ENCRYPTION_SECRET must be at least 32 characters long');
    }
    return crypto.pbkdf2Sync(
      secret,
      'salt-for-key-derivation',
      100000,
      this.keyLength,
      'sha256',
    );
  }

  /*===============================================================================================
  Refresh Token Encryption & Hashing
================================================================================================*/
  encryptRefreshToken(token: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  }

  /*===============================================================================================
  Refresh Token Decryption
================================================================================================*/
  decryptRefreshToken(encryptedToken: string): string {
    try {
      const parts = encryptedToken.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted token format');
      }
      const [ivHex, tagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const key = this.getEncryptionKey();
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt refresh token');
    }
  }

  /*===============================================================================================
  Hashing Refresh Tokens for Database Storage
================================================================================================*/

  async hashRefreshToken(token: string): Promise<string> {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
  async verifyRefreshTokenHash(token: string, hash: string): Promise<boolean> {
    const computedHash = await this.hashRefreshToken(token);
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
  }
}
