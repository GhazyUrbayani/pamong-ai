/**
 * Fixed-window rate limiter for authentication endpoints.
 *
 * Deliberately in-process: this application is a single instance backed by a local
 * SQLite file (see ARCHITECTURE.md §5), so an in-memory counter is consistent with
 * the rest of the system and adds no operational dependency. It does NOT survive a
 * restart and does NOT coordinate across instances — the moment this app is scaled
 * horizontally, this must move to a shared store.
 */

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

// Sweep expired windows occasionally so the map cannot grow without bound from
// one-off keys. Cheap: this only runs on a request that finds the map large.
const SWEEP_THRESHOLD = 5000;

function sweep(now: number) {
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitRule {
  /** Maximum attempts allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets — suitable for a Retry-After header. */
  retryAfterSeconds: number;
}

/**
 * Count one attempt against `key`. Returns whether it is allowed.
 */
export function hit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();

  if (buckets.size > SWEEP_THRESHOLD) sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  const allowed = existing.count <= rule.limit;
  return {
    allowed,
    remaining: Math.max(0, rule.limit - existing.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/** Forget a key — call after a successful login so honest users are not penalised. */
export function reset(key: string) {
  buckets.delete(key);
}

/**
 * Best-effort client address.
 *
 * Behind a proxy the left-most `x-forwarded-for` entry is the client, but that
 * header is client-controlled when no proxy rewrites it. It is therefore a
 * throttling hint, never an identity — which is why the per-account limit below
 * does not depend on it.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Throttle one login attempt on two axes.
 *
 * - Per account: stops an attacker grinding one victim's password, and works even
 *   when the source address is spoofed or rotated.
 * - Per address: stops one source spraying many accounts.
 *
 * Both must pass. Limits are sized so a student fumbling a printed password is
 * never locked out in a normal lesson.
 */
const PER_ACCOUNT: RateLimitRule = { limit: 10, windowMs: 5 * 60_000 };
const PER_ADDRESS: RateLimitRule = { limit: 40, windowMs: 5 * 60_000 };

export interface LoginThrottle {
  allowed: boolean;
  retryAfterSeconds: number;
  accountKey: string;
  addressKey: string;
}

export function throttleLogin(
  scope: 'guru' | 'siswa',
  account: string,
  headers: Headers
): LoginThrottle {
  const accountKey = `${scope}:account:${account.toLowerCase().trim()}`;
  const addressKey = `${scope}:address:${clientKey(headers)}`;

  const perAccount = hit(accountKey, PER_ACCOUNT);
  const perAddress = hit(addressKey, PER_ADDRESS);

  return {
    allowed: perAccount.allowed && perAddress.allowed,
    retryAfterSeconds: Math.max(perAccount.retryAfterSeconds, perAddress.retryAfterSeconds),
    accountKey,
    addressKey,
  };
}

/** Clear both counters for a successful login. */
export function clearLoginThrottle(throttle: LoginThrottle) {
  reset(throttle.accountKey);
  reset(throttle.addressKey);
}
