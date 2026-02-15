'use client'

import { useState, useCallback, useRef } from 'react'

interface UseRateLimitOptions {
  /** Maximum number of attempts allowed within the time window */
  maxAttempts: number
  /** Time window in milliseconds */
  windowMs: number
}

interface UseRateLimitReturn {
  /** Whether the user is currently rate-limited */
  isRateLimited: boolean
  /** Number of remaining attempts in the current window */
  remainingAttempts: number
  /** Seconds until the rate limit resets (0 if not limited) */
  secondsUntilReset: number
  /** Record an attempt. Returns true if allowed, false if rate-limited */
  recordAttempt: () => boolean
  /** Reset the rate limiter */
  reset: () => void
}

export function useRateLimit({
  maxAttempts,
  windowMs,
}: UseRateLimitOptions): UseRateLimitReturn {
  const attemptsRef = useRef<number[]>([])
  const [, forceUpdate] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanExpiredAttempts = useCallback(() => {
    const now = Date.now()
    attemptsRef.current = attemptsRef.current.filter(
      (timestamp) => now - timestamp < windowMs
    )
  }, [windowMs])

  const getState = useCallback(() => {
    cleanExpiredAttempts()
    const attempts = attemptsRef.current
    const isLimited = attempts.length >= maxAttempts
    const remaining = Math.max(0, maxAttempts - attempts.length)

    let secondsUntilReset = 0
    if (isLimited && attempts.length > 0) {
      const oldestAttempt = attempts[0]
      const resetTime = oldestAttempt + windowMs
      secondsUntilReset = Math.ceil((resetTime - Date.now()) / 1000)
    }

    return { isLimited, remaining, secondsUntilReset }
  }, [cleanExpiredAttempts, maxAttempts, windowMs])

  const recordAttempt = useCallback(() => {
    cleanExpiredAttempts()

    if (attemptsRef.current.length >= maxAttempts) {
      forceUpdate((n) => n + 1)
      return false
    }

    attemptsRef.current.push(Date.now())

    // Schedule a re-render when the oldest attempt expires
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    const oldestAttempt = attemptsRef.current[0]
    const timeUntilExpiry = oldestAttempt + windowMs - Date.now()
    timerRef.current = setTimeout(() => {
      forceUpdate((n) => n + 1)
    }, timeUntilExpiry + 50) // small buffer

    forceUpdate((n) => n + 1)
    return true
  }, [cleanExpiredAttempts, maxAttempts, windowMs])

  const reset = useCallback(() => {
    attemptsRef.current = []
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    forceUpdate((n) => n + 1)
  }, [])

  const { isLimited, remaining, secondsUntilReset } = getState()

  return {
    isRateLimited: isLimited,
    remainingAttempts: remaining,
    secondsUntilReset,
    recordAttempt,
    reset,
  }
}
