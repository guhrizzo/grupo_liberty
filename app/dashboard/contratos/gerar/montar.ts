// Ponto único que monta o documento do contrato gerado. Usado pela prévia (no
// navegador) e pelo PDF (no servidor), para os dois mostrarem exatamente o mesmo texto.

import type { ContratoBlocos } from './blocos'
import { montarLocacao } from './texto-locacao'
import { montarRecuperacao } from './texto-recuperacao'
import { montarPrestacao } from './texto-prestacao'
import { montarPromessa } from './texto-promessa'
import { ehLocacao, ehPrestacao, ehRecuperacao, type GerarContratoInput } from './types'

export function montarContratoGerado(i: GerarContratoInput, hoje: Date = new Date()): ContratoBlocos {
  if (ehLocacao(i.tipo)) return montarLocacao(i, hoje)
  if (ehRecuperacao(i.tipo)) return montarRecuperacao(i, hoje)
  return ehPrestacao(i.tipo) ? montarPrestacao(i, hoje) : montarPromessa(i, hoje)
}
