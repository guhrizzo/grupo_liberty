// Ponto único que monta o documento do contrato gerado. Usado pela prévia (no
// navegador) e pelo PDF (no servidor), para os dois mostrarem exatamente o mesmo texto.

import type { ContratoBlocos } from './blocos'
import { montarPromessa } from './texto-promessa'
import type { GerarContratoInput } from './types'

export function montarContratoGerado(i: GerarContratoInput, hoje: Date = new Date()): ContratoBlocos {
  return montarPromessa(i, hoje)
}
