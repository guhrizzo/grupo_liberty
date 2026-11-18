'use server'

import { headers } from 'next/headers'
import { getSessionUser } from '@/utils/permissions'
import { ehUserAgentMobile } from '@/utils/ponto/dispositivo'
import { gerarTokenPonto } from '@/utils/ponto/token'
import { segredoPonto } from '@/utils/ponto/registros'

/**
 * Token atual do QR. Qualquer funcionário logado (com cargo) pode exibir o QR
 * no computador dele; quem bate o ponto continua precisando do celular dentro
 * da empresa, então exibir o QR de casa não libera nada.
 */
export async function getTokenQr(): Promise<{ ok: true; token: string } | { ok: false; erro: string }> {
  const user = await getSessionUser()
  if (!user?.role) return { ok: false, erro: 'Acesso negado.' }
  if (ehUserAgentMobile((await headers()).get('user-agent'))) {
    return { ok: false, erro: 'O QR code só pode ser gerado em um computador.' }
  }
  try {
    return { ok: true, token: gerarTokenPonto(segredoPonto()) }
  } catch {
    return { ok: false, erro: 'PONTO_QR_SECRET não configurado no servidor.' }
  }
}
