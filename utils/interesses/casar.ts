import { adminDb } from '@/utils/firebase/admin'
import { veiculoCasaComInteresse } from '@/app/dashboard/interesses/match'
import type { Interesse, InteressadoResumo, VeiculoParaMatch } from '@/app/dashboard/interesses/types'

export const COLECAO_INTERESSES = 'interesses'

/** Clientes com interesse ATIVO que casam com o veículo (usado ao cadastrar um veículo novo). */
export async function buscarInteressadosDoVeiculo(veiculo: VeiculoParaMatch): Promise<InteressadoResumo[]> {
  const snap = await adminDb.collection(COLECAO_INTERESSES).where('status', '==', 'ativo').get()
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Interesse, 'id'>) }))
    .filter((i) =>
      veiculoCasaComInteresse(
        {
          marca: i.marca ?? '',
          modelo: i.modelo ?? '',
          anoMin: i.anoMin ?? null,
          anoMax: i.anoMax ?? null,
          precoMax: i.precoMax ?? null,
          cambio: i.cambio ?? '',
          combustivel: i.combustivel ?? '',
          cor: i.cor ?? '',
        },
        veiculo,
      ),
    )
    .map((i) => ({ id: i.id, clienteNome: i.clienteNome ?? '', clienteTelefone: i.clienteTelefone ?? '' }))
}
