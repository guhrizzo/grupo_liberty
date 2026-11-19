import 'server-only'
import { BATIDAS, type RegistroPonto } from '@/constants/ponto'

/**
 * Cliente da folha única de ponto. A folha mora no liberty-sistema (Supabase);
 * este sistema não grava mais ponto no Firestore. A identidade entre os dois
 * sistemas é o E-MAIL (os uids do Firebase e do Supabase são diferentes), por
 * isso aqui o `uid` de um funcionário na folha é o próprio e-mail.
 *
 * Variáveis de ambiente:
 *   PONTO_API_URL    URL completa de /api/ponto/integracao do liberty-sistema
 *   PONTO_API_SECRET mesmo valor configurado no liberty-sistema (mín. 16 caracteres)
 */

const TIMEOUT_MS = 15_000

export type RespostaFolhaUnica<T> =
  | ({ ok: true } & T)
  | { ok: false; erro: string; status: number }

export async function chamarFolhaUnica<T = Record<string, never>>(
  acao: string,
  dados: Record<string, unknown> = {},
): Promise<RespostaFolhaUnica<T>> {
  const url = process.env.PONTO_API_URL
  const segredo = process.env.PONTO_API_SECRET
  if (!url || !segredo || segredo.length < 16) {
    return { ok: false, erro: 'Ponto indisponível: integração com a folha única não configurada.', status: 503 }
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${segredo}` },
      body: JSON.stringify({ acao, ...dados }),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const json = (await resp.json().catch(() => null)) as ({ ok?: boolean; erro?: string } & T) | null
    if (resp.ok && json?.ok) return json as { ok: true } & T
    return {
      ok: false,
      erro: json?.erro ?? 'Não foi possível acessar a folha de ponto. Tente novamente.',
      status: resp.status,
    }
  } catch (err) {
    console.error('[folha-unica]', acao, err instanceof Error ? err.message : err)
    return { ok: false, erro: 'Folha de ponto indisponível no momento. Tente novamente.', status: 0 }
  }
}

/** Registro vindo do liberty-sistema → formato local, com o e-mail como `uid`. */
export function registroDaFolhaUnica(r: RegistroPonto): RegistroPonto {
  const email = r.email.toLowerCase()
  return { ...r, uid: email, id: `${email}_${r.data}` }
}

/** Última batida gravada no dia (a que acabou de ser registrada). */
export function ultimaBatida(r: RegistroPonto): { batida: (typeof BATIDAS)[number]; iso: string } | null {
  let melhor: { batida: (typeof BATIDAS)[number]; iso: string } | null = null
  for (const b of BATIDAS) {
    const iso = r.batidas[b]
    if (iso && (!melhor || new Date(iso) > new Date(melhor.iso))) melhor = { batida: b, iso }
  }
  return melhor
}
