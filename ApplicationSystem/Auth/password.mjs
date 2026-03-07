import argon2 from 'argon2';

const argonOptions = {
  type: argon2.argon2id,
};

/**
 * Hash a plaintext password using Argon2id.
 */
export async function hashPassword(password) {
  if (typeof password !== 'string' || !password.length) {
    throw new Error('Password must be a non-empty string');
  }

  return argon2.hash(password, argonOptions);
}

/**
 * Verify a plaintext password against a stored Argon2 hash.
 */
export async function verifyPassword(password, hash) {
  if (typeof password !== 'string' || !hash) {
    return false;
  }

  try {
    return await argon2.verify(hash, password);
  } catch (err) {
    return false;
  }
}
