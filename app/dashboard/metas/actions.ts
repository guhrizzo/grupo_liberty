'use server'

import { revalidatePath } from 'next/cache'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { getSessionUser, hasPageAccess, isAdmSupremo, type SessionUser } from '@/utils/permissions'
import { ehMesValido, mesAtual } from '@/app/dashboard/financeiro/periodo'
import { temAcessoPagina } from '@/constants/permissoes'
import { gravarUidsVendedores, lerUidsVendedores, opcoesDeUsuarios } from './vendedores'
import {
  META_OBSERVACAO_MAX,
  META_QUANTIDADE_MAX,
  type Meta,
  type MetaFieldErrors,
  type MetaProposta,
  type MetaResponse,
  type MetaSituacao,
  type VendedorOpcao,
} from './types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COLECAO = 'metas'

/** Uma meta por vendedor por mês. */
function idDaMeta(vendedorUid: string, mes: string) {
  return `${vendedorUid}_${mes}`
}

/** Quem pode ver a aba: ADM supremo ou quem tem acesso a Propostas. */
function podeVerMetas(user: SessionUser) {
  return isAdmSupremo(user) || hasPageAccess(user, 'propostas')
}

async function checarAdmSupremo(): Promise<{ user: SessionUser } | { error: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!isAdmSupremo(user)) return { error: 'Acesso negado. Apenas o ADM supremo gerencia metas.' }
  return { user }
}

/** Meta antiga (só veículos) não tem `valorMeta`; meta sem nada vira 1 veículo. */
function alvosDa(data: FirebaseFirestore.DocumentData) {
  const quantidade = Number(data.quantidade) > 0 ? Number(data.quantidade) : null
  const valorMeta = Number(data.valorMeta) > 0 ? Number(data.valorMeta) : null
  return { quantidade: quantidade ?? (valorMeta ? null : 1), valorMeta, exigirAmbas: data.exigirAmbas === true }
}

/**
 * Meta batida: com um alvo só, bater ele; com os dois, bater um (padrão) ou
 * os dois, conforme `exigirAmbas` (escolha do ADM supremo).
 */
function metaBatida(
  alvos: { quantidade: number | null; valorMeta: number | null; exigirAmbas: boolean },
  propostas: MetaProposta[],
) {
  const valorFechado = propostas.reduce((acc, p) => acc + p.valorFipe, 0)
  const resultados = [
    alvos.quantidade != null ? propostas.length >= alvos.quantidade : null,
    alvos.valorMeta != null ? valorFechado >= alvos.valorMeta : null,
  ].filter((r): r is boolean => r !== null)
  return alvos.exigirAmbas ? resultados.every(Boolean) : resultados.some(Boolean)
}

function situacaoDa(mes: string, batida: boolean): MetaSituacao {
  if (batida) return 'batida'
  return mes < mesAtual() ? 'nao_batida' : 'andamento'
}

/**
 * Propostas registradas fechadas, agrupadas por `${vendedorUid}_${mes}` (mês
 * no fuso de SP). Só igualdade na query, para não exigir índice composto.
 */
async function fechadasPorVendedorMes(vendedorUid?: string): Promise<Map<string, MetaProposta[]>> {
  const col = adminDb.collection('propostas_registradas')
  const snap = vendedorUid
    ? await col.where('fechada_por_uid', '==', vendedorUid).get()
    : await col.where('status', '==', 'aceito').get()

  const mapa = new Map<string, MetaProposta[]>()
  for (const doc of snap.docs) {
    const p = doc.data()
    if (p.status !== 'aceito' || !p.fechada_por_uid || !p.fechada_em) continue
    const chave = idDaMeta(p.fechada_por_uid, mesAtual(new Date(p.fechada_em)))
    const lista = mapa.get(chave) ?? []
    lista.push({
      id: doc.id,
      cliente: p.nome ?? '',
      veiculo: `${p.veiculo_marca ?? ''} ${p.veiculo_modelo ?? ''}`.trim(),
      valorFipe: Number(p.veiculo_valor_fipe) || 0,
      fechadaEm: p.fechada_em,
    })
    mapa.set(chave, lista)
  }
  return mapa
}

function revalidar() {
  revalidatePath('/dashboard/metas')
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

/** ADM supremo vê todas as metas do mês; os demais, só a própria. */
export async function getMetas(mes: string): Promise<Meta[]> {
  try {
    const user = await getSessionUser()
    if (!user || !podeVerMetas(user) || !ehMesValido(mes)) return []
    const adm = isAdmSupremo(user)

    const metasSnap = adm
      ? await adminDb.collection(COLECAO).where('mes', '==', mes).get()
      : await adminDb.collection(COLECAO).where('vendedorUid', '==', user.uid).get()

    const docs = metasSnap.docs.filter((d) => d.data().mes === mes)
    if (docs.length === 0) return []

    const fechadas = await fechadasPorVendedorMes(adm ? undefined : user.uid)

    return docs
      .map((doc) => {
        const data = doc.data()
        const alvos = alvosDa(data)
        const propostas = (fechadas.get(idDaMeta(data.vendedorUid, data.mes)) ?? []).sort((a, b) =>
          a.fechadaEm.localeCompare(b.fechadaEm),
        )
        return {
          id: doc.id,
          vendedorUid: data.vendedorUid ?? '',
          vendedorNome: data.vendedorNome ?? 'Usuário',
          mes: data.mes,
          quantidade: alvos.quantidade,
          valorMeta: alvos.valorMeta,
          exigirAmbas: alvos.quantidade != null && alvos.valorMeta != null && alvos.exigirAmbas,
          bonus: typeof data.bonus === 'number' ? data.bonus : null,
          observacao: data.observacao ?? '',
          bonusPagoEm: data.bonusPagoEm ?? null,
          fechadas: propostas.length,
          valorFechado: propostas.reduce((acc, p) => acc + p.valorFipe, 0),
          propostas,
          situacao: situacaoDa(data.mes, metaBatida(alvos, propostas)),
        } satisfies Meta
      })
      .sort((a, b) => a.vendedorNome.localeCompare(b.vendedorNome, 'pt-BR'))
  } catch (err) {
    console.error('[getMetas]', err)
    return []
  }
}

// ─── CRUD do ADM supremo ─────────────────────────────────────────────────────

/**
 * Cria (sem `id`) ou edita (com `id`) uma meta. Na edição, vendedor e mês
 * ficam fixos (fazem parte do id); só as metas, bônus e observação mudam.
 */
export async function salvarMeta(formData: FormData): Promise<MetaResponse> {
  const check = await checarAdmSupremo()
  if ('error' in check) return { error: check.error }
  const { user } = check

  const id = ((formData.get('id') as string) || '').trim()
  const vendedorUid = ((formData.get('vendedorUid') as string) || '').trim()
  const mes = ((formData.get('mes') as string) || '').trim()
  const quantidadeBruta = ((formData.get('quantidade') as string) || '').trim()
  const quantidade = quantidadeBruta === '' ? null : Number(quantidadeBruta)
  const valorMetaBruto = ((formData.get('valorMeta') as string) || '').trim()
  const valorMeta = valorMetaBruto === '' ? null : Number(valorMetaBruto)
  // Só faz sentido com as duas metas preenchidas.
  const exigirAmbas = formData.get('exigirAmbas') === 'true' && quantidade !== null && valorMeta !== null
  const bonusBruto = ((formData.get('bonus') as string) || '').trim()
  const bonus = bonusBruto === '' ? null : Number(bonusBruto)
  const observacao = ((formData.get('observacao') as string) || '').trim()

  const fieldErrors: MetaFieldErrors = {}
  if (!id) {
    if (!vendedorUid) fieldErrors.vendedorUid = 'Escolha o vendedor.'
    if (!ehMesValido(mes)) fieldErrors.mes = 'Informe o mês.'
    else if (mes < mesAtual()) fieldErrors.mes = 'Não dá para criar meta em mês que já passou.'
  }
  if (quantidade === null && valorMeta === null) {
    fieldErrors.quantidade = 'Informe a meta em veículos, em R$ ou as duas.'
  } else {
    if (quantidade !== null && (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > META_QUANTIDADE_MAX)) {
      fieldErrors.quantidade = 'Informe um número inteiro de veículos (mínimo 1).'
    }
    if (valorMeta !== null && (!Number.isFinite(valorMeta) || valorMeta <= 0)) {
      fieldErrors.valorMeta = 'Informe um valor maior que zero.'
    }
  }
  if (bonus !== null && (!Number.isFinite(bonus) || bonus < 0)) fieldErrors.bonus = 'Valor do bônus inválido.'
  if (observacao.length > META_OBSERVACAO_MAX) fieldErrors.observacao = `Máximo de ${META_OBSERVACAO_MAX} caracteres.`

  let vendedorNome = ''
  if (!id && vendedorUid && !(await lerUidsVendedores()).includes(vendedorUid)) {
    fieldErrors.vendedorUid = 'Esse usuário não está na lista de vendedores.'
  } else if (!id && vendedorUid) {
    try {
      const u = await adminAuth.getUser(vendedorUid)
      vendedorNome = u.displayName || u.email || 'Usuário'
    } catch {
      fieldErrors.vendedorUid = 'Usuário não encontrado.'
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Verifique os campos destacados.', fieldErrors }
  }

  const now = new Date().toISOString()
  try {
    if (id) {
      const ref = adminDb.collection(COLECAO).doc(id)
      if (!(await ref.get()).exists) return { error: 'Meta não encontrada.' }
      await ref.update({ quantidade, valorMeta, exigirAmbas, bonus, observacao, atualizadoEm: now })
      revalidar()
      return { success: 'Meta atualizada.' }
    }

    const ref = adminDb.collection(COLECAO).doc(idDaMeta(vendedorUid, mes))
    // `create` falha se o doc já existe — evita duas metas do mesmo vendedor no mês.
    await ref.create({
      vendedorUid,
      vendedorNome,
      mes,
      quantidade,
      valorMeta,
      exigirAmbas,
      bonus,
      observacao,
      bonusPagoEm: null,
      criadoPorUid: user.uid,
      criadoPorNome: user.name || user.email || 'Usuário',
      criadoEm: now,
      atualizadoEm: now,
    })
    revalidar()
    return { success: 'Meta criada.' }
  } catch (err) {
    if ((err as { code?: number }).code === 6) {
      return {
        error: 'Esse vendedor já tem meta nesse mês.',
        fieldErrors: { vendedorUid: 'Já existe meta para esse vendedor nesse mês — edite a existente.' },
      }
    }
    console.error('[salvarMeta]', err)
    return { error: 'Erro ao salvar a meta.' }
  }
}

export async function excluirMeta(id: string): Promise<MetaResponse> {
  const check = await checarAdmSupremo()
  if ('error' in check) return { error: check.error }
  try {
    await adminDb.collection(COLECAO).doc(id).delete()
    revalidar()
    return { success: 'Meta excluída.' }
  } catch (err) {
    console.error('[excluirMeta]', err)
    return { error: 'Erro ao excluir a meta.' }
  }
}

/** Marca/desmarca o bônus como pago. Só dá para marcar se a meta foi batida. */
export async function definirBonusPago(id: string, pago: boolean): Promise<MetaResponse> {
  const check = await checarAdmSupremo()
  if ('error' in check) return { error: check.error }
  try {
    const ref = adminDb.collection(COLECAO).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Meta não encontrada.' }
    const data = doc.data()!

    if (pago) {
      const fechadas = await fechadasPorVendedorMes(data.vendedorUid)
      const propostas = fechadas.get(idDaMeta(data.vendedorUid, data.mes)) ?? []
      if (!metaBatida(alvosDa(data), propostas)) {
        return { error: 'A meta ainda não foi batida.' }
      }
    }

    const now = new Date().toISOString()
    await ref.update({ bonusPagoEm: pago ? now : null, atualizadoEm: now })
    revalidar()
    return { success: pago ? 'Bônus marcado como pago.' : 'Pagamento do bônus desfeito.' }
  } catch (err) {
    console.error('[definirBonusPago]', err)
    return { error: 'Erro ao atualizar o bônus.' }
  }
}

// ─── Vendedores das metas ────────────────────────────────────────────────────

/** Vendedores da lista — opções de "Quem fechou?" e do seletor de meta. */
export async function getVendedoresMetas(): Promise<VendedorOpcao[]> {
  try {
    const user = await getSessionUser()
    if (!user || !podeVerMetas(user)) return []
    return await opcoesDeUsuarios(await lerUidsVendedores())
  } catch (err) {
    console.error('[getVendedoresMetas]', err)
    return []
  }
}

/** Todos os usuários com acesso a Propostas — candidatos à lista. Só ADM supremo. */
export async function getCandidatosVendedores(): Promise<VendedorOpcao[]> {
  const check = await checarAdmSupremo()
  if ('error' in check) return []
  try {
    const profilesSnap = await adminDb.collection('profiles').get()
    const comAcesso = profilesSnap.docs
      .filter((d) => temAcessoPagina(d.data()?.role, d.data()?.permissions, 'propostas'))
      .map((d) => d.id)
    return await opcoesDeUsuarios(comAcesso)
  } catch (err) {
    console.error('[getCandidatosVendedores]', err)
    return []
  }
}

export async function salvarVendedoresMetas(uids: string[]): Promise<MetaResponse> {
  const check = await checarAdmSupremo()
  if ('error' in check) return { error: check.error }
  try {
    const candidatos = new Set((await getCandidatosVendedores()).map((c) => c.uid))
    const validos = [...new Set(uids)].filter((u) => candidatos.has(u))
    await gravarUidsVendedores(validos, check.user.uid)
    revalidar()
    revalidatePath('/dashboard/propostas/registros')
    return { success: 'Lista de vendedores atualizada.' }
  } catch (err) {
    console.error('[salvarVendedoresMetas]', err)
    return { error: 'Erro ao salvar a lista de vendedores.' }
  }
}
