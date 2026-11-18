'use server'

import { headers } from 'next/headers'
import { assertPageAccess } from '@/utils/permissions'
import { ehUserAgentMobile } from '@/utils/ponto/dispositivo'
import { gerarTokenPonto } from '@/utils/ponto/token'
import { segredoPonto } from '@/utils/ponto/registros'

/** Token atual do QR (só o ADM supremo). A tela busca de novo antes da janela virar. */
export async function getTokenQr(): Promise<{ ok: true; token: string } | { ok: false; erro: string }> {
  try {
    await assertPageAccess('ponto')
  } catch {
    return { ok: false, erro: 'Acesso negado.' }
  }
  if (ehUserAgentMobile((await headers()).get('user-agent'))) {
    return { ok: false, erro: 'O QR code só pode ser gerado em um computador.' }
  }
  try {
    return { ok: true, token: gerarTokenPonto(segredoPonto()) }
  } catch {
    return { ok: false, erro: 'PONTO_QR_SECRET não configurado no servidor.' }
  }
}
