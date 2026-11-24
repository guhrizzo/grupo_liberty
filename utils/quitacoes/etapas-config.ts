import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import { ETAPAS_PADRAO, normalizarEtapas, type EtapaConfig } from './etapas'

const configEtapas = () => adminDb.collection('quitacao_config').doc('etapas')

/** Lista global de etapas. Sem configuração salva (ou inválida), usa o padrão. */
export async function carregarEtapas(): Promise<EtapaConfig[]> {
  try {
    const salvo = normalizarEtapas((await configEtapas().get()).get('etapas'))
    if (salvo) return salvo
  } catch {
    console.warn('[quitacao] Não foi possível ler as etapas configuradas; usando o padrão.')
  }
  return ETAPAS_PADRAO.map((e) => ({ ...e }))
}

export async function gravarEtapas(etapas: EtapaConfig[], uid: string) {
  await configEtapas().set({ etapas, atualizadoEm: new Date().toISOString(), atualizadoPorUid: uid })
}
