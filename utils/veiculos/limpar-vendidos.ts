import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import { VENDIDO_TTL_DIAS } from '@/constants/veiculos'

export interface LimparVendidosResultado {
  verificados: number
  movidos: number
  erros: number
}

/**
 * Move para Privado os veículos cujas vendas foram registradas há mais de
 * `VENDIDO_TTL_DIAS` dias (não apaga: o veículo e o histórico da venda ficam). Chamado pelo cron `/api/cron/limpar-vendidos`.
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

  let movidos = 0
  let erros = 0
  for (const doc of snap.docs) {
    // O prazo conta de quando a venda foi registrada: a `vendidoEm` pode ser retroativa.
    const registrado = doc.data().vendidoRegistradoEm
    if (typeof registrado === 'string' && registrado >= cutoff) continue
    if (doc.data().vendidoOculto === true) continue
    try {
      await doc.ref.update({
        publico: false,
        vendidoOculto: true,
        updated_at: new Date().toISOString(),
      })
      movidos++
    } catch (err) {
      console.error('[limpar-vendidos] falha ao mover pra privado', doc.id, err)
      erros++
    }
  }

  return { verificados: snap.size, movidos, erros }
}
