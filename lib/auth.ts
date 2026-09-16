import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { TeacherJWT, StudentJWT } from '@/types';

const EXPIRY = '24h';

let cachedSecret: Uint8Array | null = null;

/**
 * Resolve the signing secret.
 *
 * Resolved lazily rather than at module load so that `next build`, which imports
 * route handlers for analysis, does not require the variable to be present.
 *
 * There is deliberately NO constant fallback. A literal committed to this
 * repository would let anyone who reads the source mint a valid teacher token
 * against any deployment that forgot to set JWT_SECRET.
 */
function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;

  const configured = process.env.JWT_SECRET?.trim();

  if (configured) {
    if (configured.length < 32) {
      console.warn(
        '[auth] JWT_SECRET is shorter than 32 characters. Use a longer random value for HS256.'
      );
    }
    cachedSecret = new TextEncoder().encode(configured);
    return cachedSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[auth] JWT_SECRET is not set. Refusing to issue or verify tokens without one — ' +
        'set JWT_SECRET to a long random string before starting in production.'
    );
  }

  // Development: a random per-process secret. Costs a re-login after each restart,
  // which is cheap, and keeps a guessable constant out of the codebase entirely.
  const generated = new Uint8Array(32);
  crypto.getRandomValues(generated);
  console.warn(
    '[auth] JWT_SECRET is not set. Using a random per-process secret; logins end when ' +
      'the dev server restarts. Set JWT_SECRET in .env.local to keep sessions across restarts.'
  );
  cachedSecret = generated;
  return cachedSecret;
}

export async function signTeacherToken(payload: TeacherJWT): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

export async function signStudentToken(payload: StudentJWT): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload & (TeacherJWT | StudentJWT)> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as JWTPayload & (TeacherJWT | StudentJWT);
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
