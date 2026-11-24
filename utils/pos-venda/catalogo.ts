import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import { CATALOGO_PADRAO, normalizarCatalogo, type PlanoCatalogo } from './catalogo-modelo'

const catalogoRef = () => adminDb.collection('pos_venda_catalogo').doc('planos')

/** Catálogo editável pelo administrador. Sem configuração salva (ou inválida), vale o padrão. */
export async function carregarCatalogo(): Promise<PlanoCatalogo[]> {
  try {
    const salvo = normalizarCatalogo((await catalogoRef().get()).get('planos'))
    if (salvo) return salvo
  } catch {
    console.warn('[pos-venda] Não foi possível ler o catálogo; usando o padrão.')
  }
  return CATALOGO_PADRAO.map((p) => ({ ...p }))
}

export async function gravarCatalogo(planos: PlanoCatalogo[], uid: string) {
  await catalogoRef().set({ planos, atualizadoEm: new Date().toISOString(), atualizadoPorUid: uid })
}
