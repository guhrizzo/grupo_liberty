import type { NextRequest } from 'next/server'

/**
 * Extrai o IP real do visitante a partir dos headers definidos pelo proxy/CDN
 * na frente da aplicação (Cloudflare, Nginx, etc.). Sem um proxy confiável
 * reescrevendo esses headers, eles podem ser forjados pelo próprio cliente —
 * por isso essa função só deve ser usada quando há um proxy/CDN garantido na
 * frente do app.
 */
export function getClientIp(request: NextRequest): string {
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  // X-Forwarded-For: cliente, proxy1, proxy2... — o primeiro é o IP original.
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }

  return 'unknown'
}
