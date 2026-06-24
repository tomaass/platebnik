import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

type Limiters = {
  read: Ratelimit
  write: Ratelimit
}

let _limiters: Limiters | null = null

const getLimiters = (): Limiters | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    return null
  }

  if (_limiters !== null) {
    return _limiters
  }

  const redis = new Redis({ url, token })

  _limiters = {
    read: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '60 s'), prefix: 'rl:read' }),
    write: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '60 s'), prefix: 'rl:write' }),
  }

  return _limiters
}

let _warnedOnce = false

export const checkRateLimit = async (key: string, kind: 'read' | 'write'): Promise<boolean> => {
  const limiters = getLimiters()

  if (limiters === null) {
    if (!_warnedOnce) {
      console.warn('[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN not set — rate-limiting disabled in dev')
      _warnedOnce = true
    }
    return true
  }

  const { success } = await limiters[kind].limit(key)
  return success
}
