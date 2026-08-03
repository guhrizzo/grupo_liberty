import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth } from './admin';

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Só rotas privadas precisam da checagem — evita verificação
  // criptográfica em toda requisição do site público.
  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next({ request });
  }

  const sessionCookie = request.cookies.get('session')?.value;
  let authenticated = false;

  if (sessionCookie) {
    try {
      // Verificação real (assinatura + validade). Sem checkRevoked aqui —
      // essa checagem (com round-trip de rede) já é feita, com autoridade,
      // por getSessionUser() em cada página/Server Action; duplicá-la aqui
      // deixaria toda navegação do dashboard mais lenta sem ganho real.
      await adminAuth.verifySessionCookie(sessionCookie);
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Remove o cookie inválido/expirado se houver
    const response = NextResponse.redirect(url);
    if (sessionCookie) {
      response.cookies.delete('session');
    }
    return response;
  }

  return NextResponse.next({ request });
}
