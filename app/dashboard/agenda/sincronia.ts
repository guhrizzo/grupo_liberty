import 'server-only'
import { headers } from 'next/headers'
import { adminDb } from '@/utils/firebase/admin'
import { hojeNoFuso } from '@/app/dashboard/financeiro/periodo'
import { excluirEvento, salvarEvento, type DadosEvento } from '@/utils/google-agenda'

// Sincronia Agenda → Google. Fica fora de actions.ts de propósito: estas funções
// recebem `uid` arbitrário e não podem virar server action chamável pelo navegador.

const COLECAO = 'agenda'

/** Origem pública desta requisição (www em produção, localhost em dev). */
export async function origem(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export function dadosEvento(data: FirebaseFirestore.DocumentData, base: string): DadosEvento {
  return {
    titulo: data.titulo ?? '',
    descricao: data.descricao ?? '',
    local: data.local ?? '',
    data: data.data,
    diaInteiro: data.diaInteiro === true,
    horaInicio: data.horaInicio ?? null,
    horaFim: data.horaFim ?? null,
    linkPainel: `${base}/dashboard/agenda`,
  }
}

/**
 * Leva o compromisso para o Google de cada participante (cria/atualiza) e tira
 * de quem saiu. Nunca lança: falhas ficam em `googleErros[uid]`.
 */
export async function sincronizar(
  id: string,
  data: FirebaseFirestore.DocumentData,
  removidos: string[],
  base: string,
): Promise<string[]> {
  const eventos: Record<string, string> = { ...(data.googleEventos ?? {}) }
  const erros: Record<string, string> = {}
  const evento = dadosEvento(data, base)
  const participantes: string[] = data.participantesUids ?? []

  await Promise.all([
    ...participantes.map(async (uid) => {
      try {
        const novoId = await salvarEvento(uid, eventos[uid] ?? null, evento)
        if (novoId) eventos[uid] = novoId
      } catch (err) {
        erros[uid] = err instanceof Error ? err.message : 'Falha ao sincronizar.'
      }
    }),
    ...removidos.map(async (uid) => {
      const eventId = eventos[uid]
      delete eventos[uid]
      if (!eventId) return
      try {
        await excluirEvento(uid, eventId)
      } catch (err) {
        console.error('[agenda] falha ao excluir evento de participante removido', uid, err)
      }
    }),
  ])

  await adminDb.collection(COLECAO).doc(id).update({ googleEventos: eventos, googleErros: erros })
  return Object.keys(erros)
}

/**
 * Depois de conectar: leva para o Google da pessoa os compromissos futuros em
 * que ela já é participante. Chamado pela rota de retorno do OAuth.
 */
export async function sincronizarFuturosDe(uid: string, base: string): Promise<void> {
  const snap = await adminDb.collection(COLECAO).where('participantesUids', 'array-contains', uid).get()
  const hoje = hojeNoFuso()
  await Promise.all(
    snap.docs
      .filter((d) => (d.data().data ?? '') >= hoje)
      .map(async (d) => {
        const data = d.data()
        const eventos: Record<string, string> = { ...(data.googleEventos ?? {}) }
        const erros: Record<string, string> = { ...(data.googleErros ?? {}) }
        try {
          const novoId = await salvarEvento(uid, eventos[uid] ?? null, dadosEvento(data, base))
          if (novoId) eventos[uid] = novoId
          delete erros[uid]
        } catch (err) {
          erros[uid] = err instanceof Error ? err.message : 'Falha ao sincronizar.'
        }
        await d.ref.update({ googleEventos: eventos, googleErros: erros })
      }),
  )
}
