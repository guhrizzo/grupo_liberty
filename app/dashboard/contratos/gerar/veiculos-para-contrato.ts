// Veículo do estoque → dados que o gerador de contratos usa para pré-preencher.

import type { getVehicles } from '@/app/dashboard/veiculos/actions'
import { parcelasAtrasoAtual } from '@/utils/veiculos/parcelas-atraso'
import type { VeiculoParaContrato } from './types'

type VeiculoEstoque = Awaited<ReturnType<typeof getVehicles>>[number]

export function paraVeiculoContrato(v: VeiculoEstoque): VeiculoParaContrato {
  return {
    id: v.id,
    rotulo: `${v.marca ?? ''} ${v.modelo ?? ''} ${v.ano ?? ''}${v.placa ? ` — ${v.placa}` : ''}`.trim(),
    marca: v.marca ?? '',
    modelo: v.modelo ?? '',
    marcaModelo: `${v.marca ?? ''} ${v.modelo ?? ''}`.trim(),
    ano: v.ano ? String(v.ano) : '',
    placa: v.placa ?? '',
    fipe: v.tabelaFipe ?? null,
    renavam: v.renavam ?? '',
    banco: v.banco ?? '',
    valorParcela: v.valorParcela ?? null,
    parcelasAtraso: parcelasAtrasoAtual({
      base: v.parcelasAtraso,
      informadoEm: v.parcelasAtrasoEm,
      parcelasRestantes: v.parcelasRestantes,
    }),
  }
}
