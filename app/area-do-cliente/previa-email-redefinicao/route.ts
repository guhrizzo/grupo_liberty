import logo from '@/app/public/logo-liberty-car-white.png'
import { renderEmailRedefinicaoPortal } from '@/utils/email/templates/redefinicao-portal'

export function GET() {
  if (process.env.NODE_ENV !== 'development') return new Response(null, { status: 404 })

  const email = renderEmailRedefinicaoPortal('#previa', logo.src)
  return new Response(email.html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
