import 'server-only'
import { adminDb } from '@/utils/firebase/admin'

// Fora do arquivo de server actions de propósito: só é chamado por actions
// que já validaram o acesso, e não deve ser invocável direto por POST.
/**
 * Recalcula e persiste `custoEfetivoTotal` de um veículo:
 * `debitos + precoAquisicao + soma das manutenções baixadas do veículo`.
 * É chamado ao salvar o veículo e sempre que uma manutenção dele é criada,
 * editada, baixada, estornada ou removida, para o valor gravado não ficar
 * defasado. Falha em silêncio (loga) — nunca deve quebrar o fluxo que a chamou.
 *
 * "Baixada" = tem objeto `baixa` OU (legado) já tinha `custo > 0` e não está
 * cancelada. O valor é `baixa.valor` quando há baixa, senão o `custo` legado.
 */
export async function recalcularCustoEfetivoTotal(veiculoId: string): Promise<void> {
  if (!veiculoId) return
  try {
    const ref = adminDb.collection('veiculos').doc(veiculoId)
    const snap = await ref.get()
    if (!snap.exists) return
    const data = snap.data() || {}
    const base = (data.debitos ?? 0) + (data.precoAquisicao ?? 0)

    const manutSnap = await adminDb
      .collection('manutencoes')
      .where('veiculoId', '==', veiculoId)
      .get()
    let manutencoes = 0
    for (const m of manutSnap.docs) {
      const md = m.data()
      if (md.status === 'cancelada') continue
      const baixa = md.baixa as { valor?: number } | null | undefined
      const custoLegado = typeof md.custo === 'number' ? md.custo : Number(md.custo) || 0
      const baixada = !!baixa || custoLegado > 0
      if (!baixada) continue
      const valor = baixa ? Number(baixa.valor) || 0 : custoLegado
      if (valor > 0) manutencoes += valor
    }

    const total = base + manutencoes || null
    await ref.update({ custoEfetivoTotal: total })
  } catch (error) {
    console.error('Erro ao recalcular custo efetivo total do veículo', veiculoId, error)
  }
}
