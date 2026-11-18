// Tipo de aparelho: o QR do ponto é gerado só no computador e lido só no celular.
// É uma regra de uso (UX), não de segurança: o User-Agent pode ser trocado.

const UA_MOBILE = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|Opera Mini|IEMobile/i

export function ehUserAgentMobile(ua: string | null | undefined): boolean {
  return !!ua && UA_MOBILE.test(ua)
}

/** Detecção no navegador. iPadOS se apresenta como Mac, então confere o toque. */
export function detectarMobileNoNavegador(): boolean {
  if (ehUserAgentMobile(navigator.userAgent)) return true
  if (/Mac/i.test(navigator.platform) && navigator.maxTouchPoints > 1) return true
  return window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches
}
