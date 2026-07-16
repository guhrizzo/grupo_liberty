import { NextResponse, type NextRequest } from 'next/server';

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value;

  let user = null;
  if (sessionCookie) {
    const decoded = parseJwt(sessionCookie);
    if (decoded && decoded.exp * 1000 > Date.now()) {
      user = {
        uid: decoded.sub || decoded.user_id,
        email: decoded.email,
      };
    }
  }

  // Se tentar acessar rota privada e não estiver logado
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Remove o cookie expirado se houver
    const response = NextResponse.redirect(url);
    if (sessionCookie) {
      response.cookies.delete('session');
    }
    return response;
  }

  return NextResponse.next({ request });
}
