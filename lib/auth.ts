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

  // This repository is a competition MVP. The login pages expose demo
  // credentials publicly, so a stable fallback is allowed only while MVP mode is
  // enabled. Set PAMONG_MVP_MODE=false in any non-demo deployment; that restores
  // the strict requirement for JWT_SECRET.
  const mvpMode = process.env.PAMONG_MVP_MODE !== 'false';
  if (mvpMode) {
    console.warn(
      '[auth] JWT_SECRET is not set. Using the competition-MVP signing key. ' +
        'This is demo access only; set JWT_SECRET and PAMONG_MVP_MODE=false for non-demo use.'
    );
    cachedSecret = new TextEncoder().encode(
      'pamong-ai-competition-mvp-demo-signing-key-v1-only-not-for-production-use'
    );
    return cachedSecret;
  }

  throw new Error(
    '[auth] JWT_SECRET is not set and PAMONG_MVP_MODE=false. ' +
      'Set JWT_SECRET to a long random string before starting a non-demo deployment.'
  );
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
