import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/firebase/middleware'
import { rateLimit } from '@/utils/rate-limit'
import { getClientIp } from '@/utils/get-client-ip'
import { isBotUserAgent } from '@/utils/analytics/bots'

// Cookie de identidade do visitante (analytics). UUID aleatório, sem PII.
const VISITOR_COOKIE = 'liberty_vid'
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 ano

// Limite geral: qualquer IP, em qualquer rota coberta pelo matcher abaixo.
// Barra enxurradas de requisições genéricas (flood/DoS básico).
const GLOBAL_LIMIT = 200
const GLOBAL_WINDOW_MS = 60 * 1000 // 1 minuto

// Login / cadastro / recuperação de senha (app/login/actions.ts) — alvo
// clássico de força bruta e mail-bombing.
const LOGIN_LIMIT = 10
const LOGIN_WINDOW_MS = 5 * 60 * 1000 // 5 minutos

// Envio de proposta público, sem login (app/veiculos/[id]/actions.ts) — alvo
// de spam, já que grava direto no Firestore sem captcha.
const PROPOSTA_LIMIT = 5
const PROPOSTA_WINDOW_MS = 10 * 60 * 1000 // 10 minutos

function tooManyRequests(retryAfterSeconds: number) {
  return new NextResponse('Muitas requisições. Tente novamente em instantes.', {
    status: 429,
    headers: { 'Retry-After': String(retryAfterSeconds) },
  })
}

export default async function proxy(request: NextRequest) {
  const ip = getClientIp(request)
  const { pathname } = request.nextUrl

  const global = rateLimit(`global:${ip}`, GLOBAL_LIMIT, GLOBAL_WINDOW_MS)
  if (!global.allowed) return tooManyRequests(global.retryAfterSeconds)

  if (pathname === '/login' && request.method === 'POST') {
    const login = rateLimit(`login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS)
    if (!login.allowed) return tooManyRequests(login.retryAfterSeconds)
  }

  if (pathname.startsWith('/veiculos/') && request.method === 'POST') {
    const proposta = rateLimit(`proposta:${ip}`, PROPOSTA_LIMIT, PROPOSTA_WINDOW_MS)
    if (!proposta.allowed) return tooManyRequests(proposta.retryAfterSeconds)
  }

  const response = await updateSession(request)

  // Garante um id de visitante para o analytics (contagem de pessoas únicas).
  // Não gera para bots — eles não devem virar "visitantes".
  if (
    !request.cookies.get(VISITOR_COOKIE) &&
    !isBotUserAgent(request.headers.get('user-agent'))
  ) {
    response.cookies.set(VISITOR_COOKIE, randomUUID(), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: VISITOR_COOKIE_MAX_AGE,
    })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}