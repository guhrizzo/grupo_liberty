// Token do QR rotativo do ponto. Sem estado: `<janela>.<hmac>`, onde a janela
// muda a cada QR_JANELA_MS. Vale a janela atual e a anterior (~60 s).
// Roda só no servidor (usa node:crypto); o segredo é passado por parâmetro
// para ser testável.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { QR_JANELA_MS } from '@/constants/ponto'

function assinar(segredo: string, janela: number): string {
  return createHmac('sha256', segredo).update(`ponto:${janela}`).digest('hex')
}

export function gerarTokenPonto(segredo: string, agora: number = Date.now()): string {
  const janela = Math.floor(agora / QR_JANELA_MS)
  return `${janela}.${assinar(segredo, janela)}`
}

export function validarTokenPonto(
  token: unknown,
  segredo: string,
  agora: number = Date.now(),
): boolean {
  if (typeof token !== 'string' || !segredo) return false
  const m = /^(\d{1,12})\.([0-9a-f]{64})$/.exec(token)
  if (!m) return false
  const janela = Number(m[1])
  const atual = Math.floor(agora / QR_JANELA_MS)
  if (janela > atual || janela < atual - 1) return false
  const esperado = Buffer.from(assinar(segredo, janela), 'hex')
  const recebido = Buffer.from(m[2], 'hex')
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
}
