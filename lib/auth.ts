import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { TeacherJWT, StudentJWT } from '@/types';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'fallback-secret-change-in-production-32chars'
);

const EXPIRY = '24h';

export async function signTeacherToken(payload: TeacherJWT): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret);
}

export async function signStudentToken(payload: StudentJWT): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload & (TeacherJWT | StudentJWT)> {
  const { payload } = await jwtVerify(token, secret);
  return payload as JWTPayload & (TeacherJWT | StudentJWT);
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
