/**
 * Simple in-memory rate limiter for API routes.
 * Tracks attempts per key (e.g., user ID) within a sliding time window.
 * Note: This resets on server restart. For production at scale,
 * consider using Redis or Supabase-based rate limiting.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)
    if (entry.timestamps.length === 0) {
      store.delete(key)
    }
  }
}

interface RateLimitOptions {
  /** Unique prefix for this limiter (e.g., 'invite-hourly') */
  prefix: string
  /** Maximum attempts in the window */
  maxAttempts: number
  /** Window duration in milliseconds */
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const { prefix, maxAttempts, windowMs } = options
  const storeKey = `${prefix}:${key}`
  const now = Date.now()

  cleanup(windowMs)

  let entry = store.get(storeKey)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(storeKey, entry)
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

  if (entry.timestamps.length >= maxAttempts) {
    const oldestTimestamp = entry.timestamps[0]
    const resetInMs = oldestTimestamp + windowMs - now
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.ceil(resetInMs / 1000),
    }
  }

  return {
    allowed: true,
    remaining: maxAttempts - entry.timestamps.length,
    resetInSeconds: 0,
  }
}

export function recordRateLimitAttempt(
  key: string,
  prefix: string
): void {
  const storeKey = `${prefix}:${key}`
  let entry = store.get(storeKey)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(storeKey, entry)
  }
  entry.timestamps.push(Date.now())
}
