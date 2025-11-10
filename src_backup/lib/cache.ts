const CACHE_TTL = 3600 * 1000; // 1h

const memoryCache: Record<string, { data: any; expires: number }> = {};

export function setCache(key: string, data: any, ttl = CACHE_TTL) {
  memoryCache[key] = { data, expires: Date.now() + ttl };
}

export function getCache(key: string) {
  const entry = memoryCache[key];
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    delete memoryCache[key];
    return null;
  }
  return entry.data;
}
