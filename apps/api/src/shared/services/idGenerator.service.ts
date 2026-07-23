import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class IdGeneratorService {
  /**
   * Generates an ID with a given prefix and a random string of the specified length.
   * Example: generateId('BRC', 5) => 'BRC324ae'
   *
   * @param prefix The prefix string to attach at the beginning (e.g. 'BRC')
   * @param length The length of the random alphanumeric string to generate
   * @returns A concatenated string of prefix + random characters
   */
  generateId(prefix: string, length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = prefix;

    // Use crypto.randomBytes for secure and robust random generation
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += chars[randomBytes[i] % chars.length];
    }

    return result;
  }
}
