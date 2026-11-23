export type TemaPortal = 'light' | 'dark'

const cookieTema = 'liberty_tema_entrada'
const eventoTema = 'liberty:tema-portal'

export function lerTemaPortalNoNavegador(): TemaPortal {
  const valor = document.cookie.split('; ').find((item) => item.startsWith(`${cookieTema}=`))?.split('=')[1]
  return valor === 'light' ? 'light' : 'dark'
}

export function observarTemaPortal(notificar: () => void) {
  window.addEventListener(eventoTema, notificar)
  return () => window.removeEventListener(eventoTema, notificar)
}

export function salvarTemaPortal(tema: TemaPortal) {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${cookieTema}=${tema}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
  for (const caminho of ['/area-do-cliente', '/area-do-cliente/entrar']) {
    document.cookie = `${cookieTema}=; Path=${caminho}; Max-Age=0; SameSite=Lax${secure}`
  }
  window.dispatchEvent(new Event(eventoTema))
}
