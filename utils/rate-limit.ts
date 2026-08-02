// Rate limiter em memória (janela fixa), por chave arbitrária (ex.: IP, ou IP+rota).
//
// Válido para UMA instância Node de processo longo (ex.: `next start` numa VPS/
// container/PM2). Se o app rodar em múltiplas réplicas atrás de um load balancer,
// cada instância conta separado — o limite ainda funciona, mas não é global entre
// réplicas. Para isso, trocar o Map abaixo por um contador compartilhado (Redis/
// Upstash).

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Evita empilhar múltiplos intervalos de limpeza em recarregamentos do dev
// server (HMR) — o módulo pode ser reavaliado várias vezes no mesmo processo.
const globalForCleanup = globalThis as unknown as { __rateLimitCleanupStarted?: boolean }
if (!globalForCleanup.__rateLimitCleanupStarted) {
  globalForCleanup.__rateLimitCleanupStarted = true
  const interval = setInterval(
    () => {
      const now = Date.now()
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key)
      }
    },
    5 * 60 * 1000,
  )
  // Node: não impede o processo de encerrar por causa do timer. No-op em runtimes sem essa API.
  ;(interval as unknown as { unref?: () => void }).unref?.()
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

/** Registra uma requisição para `key` e diz se ela ainda está dentro do limite. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 }
  }

  existing.count += 1
  const allowed = existing.count <= limit
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
  return { allowed, remaining: Math.max(0, limit - existing.count), retryAfterSeconds }
}
