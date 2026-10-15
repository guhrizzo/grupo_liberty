import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import { COBRANCA_LIXEIRA_TTL_DIAS } from '@/constants/cobrancas'

export interface LimparLixeiraResultado {
  verificadas: number
  removidas: number
  erros: number
}

/**
 * Apaga de vez as cobranças (com parcelas e pagamentos) que estão na lixeira
 * há mais de `COBRANCA_LIXEIRA_TTL_DIAS` dias. Chamado pelo cron
 * `/api/cron/limpar-cobrancas`. Range sobre o campo único `excluidaEm` (ISO
 * 8601) — não precisa de índice composto.
 */
export async function limparLixeiraCobrancas(): Promise<LimparLixeiraResultado> {
  const cutoff = new Date(Date.now() - COBRANCA_LIXEIRA_TTL_DIAS * 86_400_000).toISOString()
  const snap = await adminDb.collection('cobrancas').where('excluidaEm', '<', cutoff).get()

  let removidas = 0
  let erros = 0
  for (const doc of snap.docs) {
    try {
      const [parcelasSnap, pagamentosSnap] = await Promise.all([
        adminDb.collection('cobranca_parcelas').where('cobrancaId', '==', doc.id).get(),
        adminDb.collection('cobranca_pagamentos').where('cobrancaId', '==', doc.id).get(),
      ])
      const batch = adminDb.batch()
      for (const d of [...pagamentosSnap.docs, ...parcelasSnap.docs]) batch.delete(d.ref)
      batch.delete(doc.ref)
      await batch.commit()
      removidas++
    } catch (err) {
      console.error('[limpar-cobrancas] falha ao apagar', doc.id, err)
      erros++
    }
  }
  return { verificadas: snap.size, removidas, erros }
}
