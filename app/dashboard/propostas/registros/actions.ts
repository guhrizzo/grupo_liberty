'use server'

import { revalidatePath } from 'next/cache'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { decrypt, encrypt } from '@/utils/crypto'
import { maskCPFCNPJ, onlyDigits } from '@/utils/masks'
import { validarCPF } from '@/utils/validadorCpf'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import type { CreatePropostaInput, PropostaPecaConserto } from '../actions'
import { ehVendedorDasMetas } from '@/app/dashboard/metas/vendedores'
import { MOTIVOS_RECUSA, MOTIVO_DETALHE_MAX } from './motivos'

async function assertAuthorized() {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')
  if (!hasPageAccess(user, 'propostas')) {
    throw new Error('Acesso negado. Apenas administradores e vendedores podem acessar.')
  }
  return user
}

/** Proposta cadastrada manualmente pela equipe (fora do fluxo de pedidos de clientes). */
export interface PropostaRegistrada {
  id: string
  nome: string
  cpf?: string
  telefone: string
  email: string
  cliente_data: string | null
  numero_contrato: string | null

  veiculo_marca: string
  veiculo_modelo: string
  veiculo_ano: number | null
  veiculo_placa: string | null
  veiculo_valor_fipe: number | null
  valor_estimado_divida: number | null

  valor_ipva: number | null
  valor_licenciamento: number | null
  valor_multas: number | null

  valor_parcela: number | null
  parcelas_totais: number | null
  parcelas_pagas: number | null
  parcelas_atrasadas: number | null
  banco: string | null

  pecas_conserto: PropostaPecaConserto[] | null

  /** Valor comercial da proposta. */
  valor: number | null
  /** Proposta prévia calculada no cadastro. */
  proposta_previa: number | null
  /** R$ 300 fixos + 6% sobre (proposta prévia − proposta). */
  comissao_vendedor: number | null

  vendedor_uid: string | null
  vendedor_email: string | null

  /** `aceito` = proposta fechada (o veículo foi comprado). */
  status: 'pendente' | 'aceito' | 'recusado'
  created_at: string

  /** Quem fechou (conta para as metas) — gravado ao marcar como fechada. */
  fechada_por_uid: string | null
  fechada_por_nome: string | null
  fechada_em: string | null

  /** Só quando `status` = recusado; null nas recusadas antes do campo existir. */
  motivo_recusa: string | null
  motivo_recusa_detalhe: string | null
}

function sanitizeText(value: string | null | undefined): string {
  return (value ?? '').toString().trim()
}

function sanitizeOptionalInt(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const n = Math.round(value)
  return n >= 0 ? n : null
}

function sanitizeOptionalNumber(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return value >= 0 ? value : null
}

/**
 * Registra uma proposta cadastrada manualmente pela equipe (tela "Cadastrar nova
 * proposta"). Fica em coleção própria, separada do fluxo de pedidos enviados por
 * clientes (`propostas`), para não misturar as duas filas de trabalho.
 */
export async function createPropostaRegistrada(
  input: CreatePropostaInput,
): Promise<{ success?: string; error?: string; id?: string }> {
  try {
    const user = await assertAuthorized()

    const nome = sanitizeText(input.nome)
    const cpfDigits = onlyDigits(sanitizeText(input.cpf))
    const telefone = sanitizeText(input.telefone)
    const email = sanitizeText(input.email)

    if (!nome || nome.length < 2) return { error: 'Informe o nome completo do cliente.' }
    if (!cpfDigits || !validarCPF(cpfDigits)) {
      return { error: 'O CPF informado é inválido.' }
    }
    if (!telefone || telefone.length < 8) {
      return { error: 'Informe um telefone/WhatsApp de contato válido.' }
    }
    if (!email || !email.includes('@')) {
      return { error: 'Informe um endereço de e-mail válido.' }
    }

    const veiculoMarca = sanitizeText(input.veiculo_marca)
    const veiculoModelo = sanitizeText(input.veiculo_modelo)
    if (!veiculoMarca) return { error: 'Informe a marca do veículo.' }
    if (!veiculoModelo) return { error: 'Informe o modelo do veículo.' }

    const valor = input.valor == null ? null : Number(input.valor)
    if (valor !== null && (!Number.isFinite(valor) || valor <= 0)) {
      return { error: 'Valor da proposta inválido.' }
    }

    const propostaPreviaNum =
      input.proposta_previa == null ? null : Number(input.proposta_previa)
    if (
      propostaPreviaNum !== null &&
      (!Number.isFinite(propostaPreviaNum) || propostaPreviaNum <= 0)
    ) {
      return { error: 'Valor da proposta prévia inválido.' }
    }

    // Comissão = R$ 300 fixos + 6% sobre a diferença entre a proposta prévia
    // e a proposta real. Guardada no cadastro para manter o histórico
    // consistente mesmo se a fórmula mudar no futuro.
    const comissaoVendedor =
      valor != null && propostaPreviaNum != null
        ? 300 + (propostaPreviaNum - valor) * 0.06
        : null

    const cpfCriptografado = encrypt(cpfDigits)

    const pecasLimpa: PropostaPecaConserto[] = (input.pecasConserto ?? [])
      .map((p) => ({
        nome: sanitizeText(p.nome),
        valor: sanitizeOptionalNumber(Number(p.valor)) ?? 0,
      }))
      .filter((p) => p.nome.length > 0)

    const docRef = adminDb.collection('propostas_registradas').doc()
    const numeroContrato =
      sanitizeText(input.numero_contrato ?? '') ||
      `#${docRef.id.slice(0, 8).toUpperCase()}`

    const clienteData = sanitizeText(input.cliente_data ?? '') || null
    const nowIso = new Date().toISOString()

    await docRef.set({
      nome,
      cpf: cpfCriptografado,
      telefone,
      email,
      valor,
      proposta_previa: propostaPreviaNum,
      comissao_vendedor: comissaoVendedor,
      status: input.status ?? 'pendente',
      cliente_data: clienteData,
      numero_contrato: numeroContrato,

      veiculo_marca: veiculoMarca,
      veiculo_modelo: veiculoModelo,
      veiculo_ano: sanitizeOptionalInt(input.veiculo_ano),
      veiculo_placa: sanitizeText(input.veiculo_placa) || null,
      veiculo_valor_fipe: sanitizeOptionalNumber(input.veiculo_valor_fipe),
      valor_estimado_divida: sanitizeOptionalNumber(input.valor_estimado_divida),

      valor_ipva: sanitizeOptionalNumber(input.valor_ipva),
      valor_licenciamento: sanitizeOptionalNumber(input.valor_licenciamento),
      valor_multas: sanitizeOptionalNumber(input.valor_multas),

      valor_parcela: sanitizeOptionalNumber(input.valor_parcela),
      parcelas_totais: sanitizeOptionalInt(input.parcelas_totais),
      parcelas_pagas: sanitizeOptionalInt(input.parcelas_pagas),
      parcelas_atrasadas: sanitizeOptionalInt(input.parcelas_atrasadas),
      banco: sanitizeText(input.banco ?? '') || null,

      pecas_conserto: pecasLimpa,

      vendedor_uid: user.uid,
      vendedor_email: user.email,

      created_at: nowIso,
      updated_at: nowIso,
    })

    revalidatePath('/dashboard/propostas', 'layout')

    return { success: 'Proposta cadastrada com sucesso!', id: docRef.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao cadastrar proposta.'
    console.error('Erro ao cadastrar proposta registrada:', err)
    return { error: message }
  }
}

/** Lista as propostas registradas manualmente pela equipe, mais recentes primeiro. */
export async function getPropostasRegistradas(): Promise<PropostaRegistrada[]> {
  try {
    await assertAuthorized()

    const snapshot = await adminDb
      .collection('propostas_registradas')
      .orderBy('created_at', 'desc')
      .get()

    const list: PropostaRegistrada[] = []
    snapshot.forEach((doc) => {
      const p = doc.data() as Record<string, unknown>

      let decryptedCpf = ''
      if (typeof p.cpf === 'string' && p.cpf) {
        const raw = decrypt(p.cpf)
        if (raw) decryptedCpf = maskCPFCNPJ(raw)
      }

      const pecasConserto: PropostaPecaConserto[] | null = Array.isArray(p.pecas_conserto)
        ? p.pecas_conserto.map((x: unknown) => {
            const obj = x as { nome?: unknown; valor?: unknown }
            return {
              nome: String(obj.nome ?? '').trim(),
              valor: Number(obj.valor) || 0,
            }
          })
        : null

      list.push({
        id: doc.id,
        nome: (p.nome as string) ?? '',
        cpf: decryptedCpf || undefined,
        telefone: (p.telefone as string) ?? '',
        email: (p.email as string) ?? '',
        cliente_data: (p.cliente_data as string) ?? null,
        numero_contrato: (p.numero_contrato as string) ?? null,

        veiculo_marca: (p.veiculo_marca as string) ?? '',
        veiculo_modelo: (p.veiculo_modelo as string) ?? '',
        veiculo_ano: (p.veiculo_ano as number) ?? null,
        veiculo_placa: (p.veiculo_placa as string) ?? null,
        veiculo_valor_fipe: (p.veiculo_valor_fipe as number) ?? null,
        valor_estimado_divida: (p.valor_estimado_divida as number) ?? null,

        valor_ipva: (p.valor_ipva as number) ?? null,
        valor_licenciamento: (p.valor_licenciamento as number) ?? null,
        valor_multas: (p.valor_multas as number) ?? null,

        valor_parcela: (p.valor_parcela as number) ?? null,
        parcelas_totais: (p.parcelas_totais as number) ?? null,
        parcelas_pagas: (p.parcelas_pagas as number) ?? null,
        parcelas_atrasadas: (p.parcelas_atrasadas as number) ?? null,
        banco: (p.banco as string) ?? null,

        pecas_conserto: pecasConserto,

        valor: (p.valor as number) ?? null,
        proposta_previa: (p.proposta_previa as number) ?? null,
        comissao_vendedor: (p.comissao_vendedor as number) ?? null,

        vendedor_uid: (p.vendedor_uid as string) ?? null,
        vendedor_email: (p.vendedor_email as string) ?? null,

        status: (p.status as PropostaRegistrada['status']) ?? 'pendente',
        created_at: p.created_at as string,

        fechada_por_uid: (p.fechada_por_uid as string) ?? null,
        fechada_por_nome: (p.fechada_por_nome as string) ?? null,
        fechada_em: (p.fechada_em as string) ?? null,

        motivo_recusa: (p.motivo_recusa as string) ?? null,
        motivo_recusa_detalhe: (p.motivo_recusa_detalhe as string) ?? null,
      })
    })
    return list
  } catch (err) {
    console.error('Erro ao buscar propostas registradas:', err)
    return []
  }
}

/** Proposta registrada com CPF em dígitos puros — usada só para popular o formulário de edição. */
export interface PropostaRegistradaEditavel
  extends Omit<
    PropostaRegistrada,
    'cpf' | 'vendedor_uid' | 'vendedor_email' | 'created_at' | 'fechada_por_uid' | 'fechada_por_nome' | 'fechada_em' | 'motivo_recusa' | 'motivo_recusa_detalhe'
  > {
  cpfDigits: string
}

/** Busca uma proposta registrada pelo id, para edição. */
export async function getPropostaRegistradaById(
  id: string,
): Promise<PropostaRegistradaEditavel | null> {
  try {
    await assertAuthorized()
    if (!id) return null

    const doc = await adminDb.collection('propostas_registradas').doc(id).get()
    if (!doc.exists) return null

    const p = doc.data() as Record<string, unknown>

    let cpfDigits = ''
    if (typeof p.cpf === 'string' && p.cpf) {
      cpfDigits = decrypt(p.cpf) || ''
    }

    const pecasConserto: PropostaPecaConserto[] | null = Array.isArray(p.pecas_conserto)
      ? p.pecas_conserto.map((x: unknown) => {
          const obj = x as { nome?: unknown; valor?: unknown }
          return {
            nome: String(obj.nome ?? '').trim(),
            valor: Number(obj.valor) || 0,
          }
        })
      : null

    return {
      id: doc.id,
      nome: (p.nome as string) ?? '',
      cpfDigits,
      telefone: (p.telefone as string) ?? '',
      email: (p.email as string) ?? '',
      cliente_data: (p.cliente_data as string) ?? null,
      numero_contrato: (p.numero_contrato as string) ?? null,

      veiculo_marca: (p.veiculo_marca as string) ?? '',
      veiculo_modelo: (p.veiculo_modelo as string) ?? '',
      veiculo_ano: (p.veiculo_ano as number) ?? null,
      veiculo_placa: (p.veiculo_placa as string) ?? null,
      veiculo_valor_fipe: (p.veiculo_valor_fipe as number) ?? null,
      valor_estimado_divida: (p.valor_estimado_divida as number) ?? null,

      valor_ipva: (p.valor_ipva as number) ?? null,
      valor_licenciamento: (p.valor_licenciamento as number) ?? null,
      valor_multas: (p.valor_multas as number) ?? null,

      valor_parcela: (p.valor_parcela as number) ?? null,
      parcelas_totais: (p.parcelas_totais as number) ?? null,
      parcelas_pagas: (p.parcelas_pagas as number) ?? null,
      parcelas_atrasadas: (p.parcelas_atrasadas as number) ?? null,
      banco: (p.banco as string) ?? null,

      pecas_conserto: pecasConserto,

      valor: (p.valor as number) ?? null,
      proposta_previa: (p.proposta_previa as number) ?? null,
      comissao_vendedor: (p.comissao_vendedor as number) ?? null,

      status: (p.status as PropostaRegistrada['status']) ?? 'pendente',
    }
  } catch (err) {
    console.error('Erro ao buscar proposta registrada:', err)
    return null
  }
}

/** Atualiza uma proposta registrada manualmente, recalculando a comissão. */
export async function updatePropostaRegistrada(
  id: string,
  input: CreatePropostaInput,
): Promise<{ success?: string; error?: string }> {
  try {
    await assertAuthorized()
    if (!id) return { error: 'ID da proposta inválido.' }

    const ref = adminDb.collection('propostas_registradas').doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Proposta não encontrada.' }

    const nome = sanitizeText(input.nome)
    const cpfDigits = onlyDigits(sanitizeText(input.cpf))
    const telefone = sanitizeText(input.telefone)
    const email = sanitizeText(input.email)

    if (!nome || nome.length < 2) return { error: 'Informe o nome completo do cliente.' }
    if (!cpfDigits || !validarCPF(cpfDigits)) {
      return { error: 'O CPF informado é inválido.' }
    }
    if (!telefone || telefone.length < 8) {
      return { error: 'Informe um telefone/WhatsApp de contato válido.' }
    }
    if (!email || !email.includes('@')) {
      return { error: 'Informe um endereço de e-mail válido.' }
    }

    const veiculoMarca = sanitizeText(input.veiculo_marca)
    const veiculoModelo = sanitizeText(input.veiculo_modelo)
    if (!veiculoMarca) return { error: 'Informe a marca do veículo.' }
    if (!veiculoModelo) return { error: 'Informe o modelo do veículo.' }

    const valor = input.valor == null ? null : Number(input.valor)
    if (valor !== null && (!Number.isFinite(valor) || valor <= 0)) {
      return { error: 'Valor da proposta inválido.' }
    }

    const propostaPreviaNum =
      input.proposta_previa == null ? null : Number(input.proposta_previa)
    if (
      propostaPreviaNum !== null &&
      (!Number.isFinite(propostaPreviaNum) || propostaPreviaNum <= 0)
    ) {
      return { error: 'Valor da proposta prévia inválido.' }
    }

    const comissaoVendedor =
      valor != null && propostaPreviaNum != null
        ? 300 + (propostaPreviaNum - valor) * 0.06
        : null

    const pecasLimpa: PropostaPecaConserto[] = (input.pecasConserto ?? [])
      .map((p) => ({
        nome: sanitizeText(p.nome),
        valor: sanitizeOptionalNumber(Number(p.valor)) ?? 0,
      }))
      .filter((p) => p.nome.length > 0)

    await ref.update({
      nome,
      cpf: encrypt(cpfDigits),
      telefone,
      email,
      valor,
      proposta_previa: propostaPreviaNum,
      comissao_vendedor: comissaoVendedor,
      // `status` não é editável aqui: fechar/reabrir é feito por definirPropostaFechada.
      cliente_data: sanitizeText(input.cliente_data ?? '') || null,
      numero_contrato: sanitizeText(input.numero_contrato ?? '') || null,

      veiculo_marca: veiculoMarca,
      veiculo_modelo: veiculoModelo,
      veiculo_ano: sanitizeOptionalInt(input.veiculo_ano),
      veiculo_placa: sanitizeText(input.veiculo_placa) || null,
      veiculo_valor_fipe: sanitizeOptionalNumber(input.veiculo_valor_fipe),
      valor_estimado_divida: sanitizeOptionalNumber(input.valor_estimado_divida),

      valor_ipva: sanitizeOptionalNumber(input.valor_ipva),
      valor_licenciamento: sanitizeOptionalNumber(input.valor_licenciamento),
      valor_multas: sanitizeOptionalNumber(input.valor_multas),

      valor_parcela: sanitizeOptionalNumber(input.valor_parcela),
      parcelas_totais: sanitizeOptionalInt(input.parcelas_totais),
      parcelas_pagas: sanitizeOptionalInt(input.parcelas_pagas),
      parcelas_atrasadas: sanitizeOptionalInt(input.parcelas_atrasadas),
      banco: sanitizeText(input.banco ?? '') || null,

      pecas_conserto: pecasLimpa,

      updated_at: new Date().toISOString(),
    })

    revalidatePath('/dashboard/propostas', 'layout')
    revalidatePath(`/dashboard/propostas/registros/${id}/editar`)

    return { success: 'Proposta atualizada com sucesso!' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar proposta.'
    console.error('Erro ao atualizar proposta registrada:', err)
    return { error: message }
  }
}

/** Exclui uma proposta registrada manualmente. */
export async function deletePropostaRegistrada(
  id: string,
): Promise<{ success?: string; error?: string }> {
  try {
    await assertAuthorized()
    if (!id) return { error: 'ID da proposta inválido.' }

    const ref = adminDb.collection('propostas_registradas').doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Proposta não encontrada.' }

    await ref.delete()

    revalidatePath('/dashboard/propostas', 'layout')
    return { success: 'Proposta excluída com sucesso.' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir proposta.'
    return { error: message }
  }
}

/**
 * Marca a proposta como fechada (`vendedorUid` = quem fechou, conta para as
 * metas) ou reabre (`vendedorUid` = null, deixa de contar).
 */
export async function definirPropostaFechada(
  id: string,
  vendedorUid: string | null,
): Promise<{ success?: string; error?: string }> {
  try {
    await assertAuthorized()
    if (!id) return { error: 'ID da proposta inválido.' }

    const ref = adminDb.collection('propostas_registradas').doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Proposta não encontrada.' }

    const nowIso = new Date().toISOString()
    if (vendedorUid) {
      if (!(await ehVendedorDasMetas(vendedorUid))) {
        return { error: 'Escolha um vendedor da lista de vendedores das metas.' }
      }
      let nome: string
      try {
        const u = await adminAuth.getUser(vendedorUid)
        nome = u.displayName || u.email || 'Usuário'
      } catch {
        return { error: 'Vendedor não encontrado.' }
      }
      await ref.update({
        status: 'aceito',
        fechada_por_uid: vendedorUid,
        fechada_por_nome: nome,
        fechada_em: nowIso,
        motivo_recusa: null,
        motivo_recusa_detalhe: null,
        updated_at: nowIso,
      })
    } else {
      await ref.update({
        status: 'pendente',
        fechada_por_uid: null,
        fechada_por_nome: null,
        fechada_em: null,
        motivo_recusa: null,
        motivo_recusa_detalhe: null,
        updated_at: nowIso,
      })
    }

    revalidatePath('/dashboard/propostas', 'layout')
    revalidatePath('/dashboard/metas')
    return { success: vendedorUid ? 'Proposta marcada como aceita.' : 'Proposta voltou para em aberto.' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar a proposta.'
    return { error: message }
  }
}

/**
 * Marca a proposta como recusada: sai da comissão e das metas (só as aceitas
 * contam). Apaga quem fechou, se ela estava aceita.
 */
export async function definirPropostaRecusada(
  id: string,
  motivo: string,
  detalhe?: string,
): Promise<{ success?: string; error?: string }> {
  try {
    await assertAuthorized()
    if (!id) return { error: 'ID da proposta inválido.' }

    if (!MOTIVOS_RECUSA.some((m) => m.valor === motivo)) return { error: 'Escolha o motivo da recusa.' }
    const detalheLimpo = motivo === 'outro' ? sanitizeText(detalhe).slice(0, MOTIVO_DETALHE_MAX) : ''
    if (motivo === 'outro' && !detalheLimpo) return { error: 'Descreva o motivo da recusa.' }

    const ref = adminDb.collection('propostas_registradas').doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Proposta não encontrada.' }

    await ref.update({
      status: 'recusado',
      fechada_por_uid: null,
      fechada_por_nome: null,
      fechada_em: null,
      motivo_recusa: motivo,
      motivo_recusa_detalhe: detalheLimpo || null,
      updated_at: new Date().toISOString(),
    })

    revalidatePath('/dashboard/propostas', 'layout')
    revalidatePath('/dashboard/metas')
    return { success: 'Proposta marcada como recusada.' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar a proposta.'
    return { error: message }
  }
}
