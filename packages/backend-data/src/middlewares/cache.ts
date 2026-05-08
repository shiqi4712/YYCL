import NodeCache from 'node-cache'

const TTL = Number(process.env.CACHE_TTL_SECONDS) || 300

export const cache = new NodeCache({ stdTTL: TTL, checkperiod: 60 })

export function cacheKey(prefix: string, params: Record<string, any>): string {
  const sorted = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&')
  return `${prefix}:${sorted}`
}
