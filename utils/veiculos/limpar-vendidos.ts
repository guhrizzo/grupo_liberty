import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import { apagarVeiculoCompleto } from '@/utils/veiculos/apagar'
import { VENDIDO_TTL_DIAS } from '@/constants/veiculos'

export interface LimparVendidosResultado {
  verificados: number
  removidos: number
  erros: number
}

/**
 * Apaga de vez os veículos marcados como vendidos há mais de
 * `VENDIDO_TTL_DIAS` dias. Chamado pelo cron `/api/cron/limpar-vendidos`.
 *
 * A query é um range sobre o campo único `vendidoEm` (ISO 8601, ordenável
 * lexicograficamente) — o Firestore indexa campos únicos automaticamente, sem
 * precisar de índice composto. Veículos sem `vendidoEm` não entram no range.
 */
export async function limparVeiculosVendidos(): Promise<LimparVendidosResultado> {
  const cutoff = new Date(Date.now() - VENDIDO_TTL_DIAS * 86_400_000).toISOString()
  const snap = await adminDb
    .collection('veiculos')
    .where('vendidoEm', '<', cutoff)
    .get()

  let removidos = 0
  let erros = 0
  for (const doc of snap.docs) {
    try {
      await apagarVeiculoCompleto(doc.id)
      removidos++
    } catch (err) {
      console.error('[limpar-vendidos] falha ao apagar', doc.id, err)
      erros++
    }
  }

  return { verificados: snap.size, removidos, erros }
}
