import { randomBytes } from 'crypto';

/**
 * Returns a cryptographically secure random integer in the range [min, max] (inclusive).
 * Uses rejection sampling to avoid modulo bias.
 */
export function getSecureRandomInt(min: number, max: number): number {
  const range = max - min + 1;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8) || 1;
  const maxValid = Math.floor(256 ** bytesNeeded / range) * range - 1;

  let randomInt;
  do {
    const bytes = randomBytes(bytesNeeded);
    randomInt = bytes.readUIntBE(0, bytesNeeded);
  } while (randomInt > maxValid);

  return min + (randomInt % range);
}

/**
 * Rolls a single fair die with the given number of faces (default 6).
 * Returns a value in [1, faces].
 */
export function rollDie(faces = 6): number {
  return getSecureRandomInt(1, faces);
}
