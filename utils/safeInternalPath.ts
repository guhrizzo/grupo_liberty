/**
 * Sanitiza um destino de redirect vindo do cliente (query string, campo de
 * formulário) para garantir que é um caminho relativo do próprio site — nunca
 * um host externo. Protege contra open-redirect.
 *
 * Aceita: "/dashboard", "/entrar-dispositivo?porta=1&state=x"
 * Recusa (→ fallback): "//evil.com", "https://evil.com", "javascript:…",
 *   "/\\evil.com", vazio.
 *
 * @param p valor cru
 * @param fallback caminho usado quando `p` não é seguro (padrão "/dashboard")
 */
export function safeInternalPath(p: unknown, fallback = '/dashboard'): string {
  const s = typeof p === 'string' ? p.trim() : ''
  if (!s || !s.startsWith('/') || s.startsWith('//') || s.includes('\\')) {
    return fallback
  }
  try {
    // Base inválida de propósito: só queremos pathname + search de um caminho
    // relativo. Se `s` embutir um esquema/host, o parse não bate com essa base.
    const u = new URL(s, 'https://internal.invalid')
    if (u.origin !== 'https://internal.invalid') return fallback
    return u.pathname + u.search
  } catch {
    return fallback
  }
}
