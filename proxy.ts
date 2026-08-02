import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/firebase/middleware'
import { rateLimit } from '@/utils/rate-limit'
import { getClientIp } from '@/utils/get-client-ip'

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

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}