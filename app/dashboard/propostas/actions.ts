'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { sendPropostaStatusEmail } from '@/utils/email/send-proposta-email'
import { decrypt, encrypt } from '@/utils/crypto'
import { maskCPFCNPJ, onlyDigits } from '@/utils/masks'
import { validarCPF } from '@/utils/validadorCpf'

export interface PropostaPecaConserto {
  nome: string
  valor: number
}

export interface Proposta {
  id: string
  veiculo_id?: string | null
  user_id: string | null
  nome?: string
  cpf?: string
  telefone?: string
  email?: string
  /** ISO date da proposta (cliente_data ou created_at) */
  cliente_data?: string | null
  /** Número do contrato exibido no PDF (pode coincidir com id curto). */
  numero_contrato?: string | null
  valor: number | null
  /** Valor comercial final destacado no PDF (página 3). */
  proposta_comercial?: number | null
  /** Valor monetário da "Proposta Prévia" exibido em destaque (página 4). */
  proposta_previa?: number | null
  condicoes?: string | null
  mensagem: string
  status: 'pendente' | 'aceito' | 'recusado'
  created_at: string

  // Veículo (digitado, pois o cadastro aceita carros fora do estoque)
  veiculo_marca?: string | null
  veiculo_modelo?: string | null
  veiculo_ano?: number | null
  veiculo_placa?: string | null
  veiculo_valor_fipe?: number | null
  valor_estimado_divida?: number | null

  // Pendências
  valor_ipva?: number | null
  valor_licenciamento?: number | null
  valor_multas?: number | null

  // Parcelamento
  valor_parcela?: number | null
  parcelas_totais?: number | null
  parcelas_pagas?: number | null
  parcelas_atrasadas?: number | null
  banco?: string | null

  // Peças
  pecas_conserto?: PropostaPecaConserto[] | null

  // Mantidos (retrocompatibilidade)
  veiculos: {
    marca: string
    modelo: string
    preco: number
  } | null
  user_email?: string
  user_name?: string
  user_phone?: string
}

async function getSessionUser() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) return null

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(session, true)
    return decodedClaims
  } catch {
    return null
  }
}

async function assertAuthorized() {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')

  const profileDoc = await adminDb.collection('profiles').doc(user.uid).get()
  const profile = profileDoc.data()

  if (!profileDoc.exists || !profile || !['admin', 'vendedor'].includes(profile.role)) {
    throw new Error('Acesso negado. Apenas administradores e vendedores podem acessar.')
  }

  return { user, role: profile.role }
}

/**
 * Busca todas as propostas enviadas.
 */
export async function getPropostas(): Promise<Proposta[]> {
  try {
    await assertAuthorized()

    const propostasSnapshot = await adminDb.collection('propostas')
      .orderBy('created_at', 'desc')
      .get()

    const propostasList: any[] = []
    propostasSnapshot.forEach((doc: any) => {
      propostasList.push({ id: doc.id, ...doc.data() })
    })

    if (propostasList.length === 0) return []

    const veiculosSnapshot = await adminDb.collection('veiculos').get()
    const veiculosMap: Record<string, { marca: string; modelo: string; preco: number }> = {}
    veiculosSnapshot.forEach((doc: any) => {
      const data = doc.data()
      veiculosMap[doc.id] = {
        marca: data.marca,
        modelo: data.modelo,
        preco: data.preco,
      }
    })

    let authUsers: any[] = []
    try {
      const listUsersResult = await adminAuth.listUsers()
      authUsers = listUsersResult.users
    } catch {
      // Caso não consiga listar usuários do Auth
    }

    return propostasList.map((p: any) => {
      const authUser = authUsers.find((u: any) => u.uid === p.user_id)
      const veiculoInfo = veiculosMap[p.veiculo_id] || null

      const clienteNome = p.nome || authUser?.displayName || 'Visitante'
      const clienteEmail = p.email || authUser?.email || 'Sem e-mail'
      const clienteTelefone = p.telefone || 'Sem telefone'

      let decryptedCpf = ''
      if (p.cpf) {
        const raw = decrypt(p.cpf)
        if (raw) {
          decryptedCpf = maskCPFCNPJ(raw)
        }
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
        id: p.id,
        veiculo_id: p.veiculo_id ?? null,
        user_id: p.user_id ?? null,
        nome: clienteNome,
        cpf: decryptedCpf || undefined,
        telefone: clienteTelefone,
        email: clienteEmail,
        cliente_data: p.cliente_data ?? null,
        numero_contrato: p.numero_contrato ?? null,
        valor: p.valor,
        proposta_comercial: p.proposta_comercial ?? null,
        condicoes: p.condicoes ?? null,
        mensagem: p.mensagem,
        proposta_previa: p.proposta_previa ?? null,
        status: p.status,
        created_at: p.created_at,

        veiculo_marca: p.veiculo_marca ?? null,
        veiculo_modelo: p.veiculo_modelo ?? null,
        veiculo_ano: p.veiculo_ano ?? null,
        veiculo_placa: p.veiculo_placa ?? null,
        veiculo_valor_fipe: p.veiculo_valor_fipe ?? null,
        valor_estimado_divida: p.valor_estimado_divida ?? null,

        valor_ipva: p.valor_ipva ?? null,
        valor_licenciamento: p.valor_licenciamento ?? null,
        valor_multas: p.valor_multas ?? null,

        valor_parcela: p.valor_parcela ?? null,
        parcelas_totais: p.parcelas_totais ?? null,
        parcelas_pagas: p.parcelas_pagas ?? null,
        parcelas_atrasadas: p.parcelas_atrasadas ?? null,
        banco: p.banco ?? null,

        pecas_conserto: pecasConserto,

        veiculos: veiculoInfo,
        user_email: clienteEmail,
        user_name: clienteNome,
        user_phone: clienteTelefone,
      }
    })
  } catch (err) {
    console.error('Erro ao buscar propostas:', err)
    return []
  }
}

/** Atualiza o status de uma proposta. */
export async function updatePropostaStatus(id: string, newStatus: 'pendente' | 'aceito' | 'recusado'): Promise<{ success?: string; error?: string; emailSent?: boolean }> {
  try {
    await assertAuthorized()

    await adminDb.collection('propostas').doc(id).update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })

    revalidatePath('/dashboard/propostas')

    let emailSent = false
    if (newStatus === 'aceito' || newStatus === 'recusado') {
      try {
        const propostaDoc = await adminDb.collection('propostas').doc(id).get()
        const proposta = propostaDoc.data()

        if (proposta) {
          let clienteNome = proposta.nome || 'Cliente'
          let clienteEmail = proposta.email || ''

          if (proposta.user_id && !clienteEmail) {
            try {
              const authUser = await adminAuth.getUser(proposta.user_id)
              clienteEmail = authUser.email || ''
              clienteNome = proposta.nome || authUser.displayName || 'Cliente'
            } catch {
              // Usuário não encontrado
            }
          }

          let veiculoMarca = 'Veículo'
          let veiculoModelo = ''
          if (proposta.veiculo_id) {
            try {
              const veiculoDoc = await adminDb.collection('veiculos').doc(proposta.veiculo_id).get()
              const veiculo = veiculoDoc.data()
              if (veiculo) {
                veiculoMarca = veiculo.marca || 'Veículo'
                veiculoModelo = veiculo.modelo || ''
              }
            } catch {
              // Veículo removido
            }
          }

          emailSent = await sendPropostaStatusEmail({
            clienteNome,
            clienteEmail,
            veiculoMarca,
            veiculoModelo,
            valorOfertado: proposta.valor ?? null,
            status: newStatus,
          })
        }
      } catch (emailErr) {
        console.error('[Email] Falha ao enviar notificação de proposta:', emailErr)
      }
    }

    return { success: 'Status da proposta atualizado com sucesso!', emailSent }
  } catch (err: any) {
    return { error: err.message || 'Erro de autorização.' }
  }
}

/** Exclui uma proposta aceita ou recusada. */
export async function deleteProposta(id: string): Promise<{ success?: string; error?: string }> {
  try {
    await assertAuthorized()

    const propostaRef = adminDb.collection('propostas').doc(id)
    const propostaDoc = await propostaRef.get()

    if (!propostaDoc.exists) {
      return { error: 'Proposta não encontrada.' }
    }

    const data = propostaDoc.data()
    if (!data || !['aceito', 'recusado'].includes(data.status)) {
      return { error: 'Apenas propostas aceitas ou recusadas podem ser excluídas.' }
    }

    await propostaRef.delete()

    revalidatePath('/dashboard/propostas')
    return { success: 'Proposta excluída com sucesso.' }
  } catch (err: any) {
    return { error: err.message || 'Erro ao excluir proposta.' }
  }
}

/** Atualiza apenas a Proposta Comercial e/ou Condições. */
export async function updatePropostaComercial(
  id: string,
  propostaComercial: number | null,
  condicoes: string | null,
): Promise<{ success?: string; error?: string }> {
  try {
    await assertAuthorized()

    if (!id) return { error: 'ID da proposta inválido.' }

    const propostaRef = adminDb.collection('propostas').doc(id)
    const propostaDoc = await propostaRef.get()
    if (!propostaDoc.exists) return { error: 'Proposta não encontrada.' }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (propostaComercial !== null) {
      if (typeof propostaComercial !== 'number' || Number.isNaN(propostaComercial) || propostaComercial < 0) {
        return { error: 'Proposta comercial inválida.' }
      }
      update.proposta_comercial = propostaComercial
    }

    if (condicoes !== null) {
      update.condicoes = String(condicoes)
    }

    await propostaRef.update(update)
    revalidatePath('/dashboard/propostas')

    return { success: 'Proposta atualizada com sucesso.' }
  } catch (err: any) {
    return { error: err.message || 'Erro ao atualizar proposta.' }
  }
}

/** Lista os veículos do estoque para a nova proposta (modo legado). */
export interface VeiculoResumo {
  id: string
  marca: string
  modelo: string
  preco: number | null
  ano?: number | null
  foto?: string | null
}

export async function listVeiculosForProposta(): Promise<VeiculoResumo[]> {
  try {
    await assertAuthorized()

    const snapshot = await adminDb
      .collection('veiculos')
      .orderBy('created_at', 'desc')
      .get()

    const result: VeiculoResumo[] = []
    snapshot.forEach((doc) => {
      const data = doc.data()
      const fotos = Array.isArray(data.fotos) ? (data.fotos as string[]) : []
      result.push({
        id: doc.id,
        marca: data.marca ?? '',
        modelo: data.modelo ?? '',
        preco: typeof data.preco === 'number' ? data.preco : null,
        ano: data.ano ?? null,
        foto: fotos[0] ?? null,
      })
    })
    return result
  } catch (err) {
    console.error('Erro ao listar veículos para proposta:', err)
    return []
  }
}

/** Schema completo para criação manual de uma proposta. */
export interface CreatePropostaInput {
  // Cliente
  nome: string
  cpf: string
  telefone: string
  email: string
  /** Data no formato YYYY-MM-DD (opcional). */
  cliente_data?: string | null
  /** Número do contrato (opcional — gerado automático se ausente). */
  numero_contrato?: string | null

  // Veículo (digitado, sem exigir veiculo_id)
  veiculo_id?: string | null
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_ano: number | null
  veiculo_placa: string
  veiculo_valor_fipe: number | null
  valor_estimado_divida: number | null

  // Pendências
  valor_ipva: number | null
  valor_licenciamento: number | null
  valor_multas: number | null

  // Parcelamento
  valor_parcela: number | null
  parcelas_totais: number | null
  parcelas_pagas: number | null
  parcelas_atrasadas: number | null
  banco?: string | null

  // Peças
  pecasConserto: Array<{ nome: string; valor: number }>

  // Proposta comercial + proposta prévia (valor monetário exibido na página 4)
  valor: number | null
  /** Valor monetário da proposta prévia (página 4 do PDF). */
  proposta_previa: number | null
  mensagem: string
  status?: 'pendente' | 'aceito' | 'recusado'
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
 * Cria uma nova proposta manualmente pelo dashboard ("Cadastrar nova proposta").
 * O veículo é digitado livremente — não exige que esteja no estoque.
 */
export async function createProposta(
  input: CreatePropostaInput,
): Promise<{ success?: string; error?: string; id?: string }> {
  try {
    await assertAuthorized()

    const nome = sanitizeText(input.nome)
    const cpfDigits = onlyDigits(sanitizeText(input.cpf))
    const telefone = sanitizeText(input.telefone)
    const email = sanitizeText(input.email)
    const mensagem = sanitizeText(input.mensagem)

    const veiculoId = input.veiculo_id ? sanitizeText(input.veiculo_id) : ''
    const veiculoMarca = sanitizeText(input.veiculo_marca)
    const veiculoModelo = sanitizeText(input.veiculo_modelo)
    const veiculoPlaca = sanitizeText(input.veiculo_placa)

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
    if (!veiculoMarca) return { error: 'Informe a marca do veículo.' }
    if (!veiculoModelo) return { error: 'Informe o modelo do veículo.' }
    if (!mensagem) return { error: 'A mensagem de interesse é obrigatória.' }

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

    // Se veio veiculo_id, valida que existe
    if (veiculoId) {
      const veiculoDoc = await adminDb.collection('veiculos').doc(veiculoId).get()
      if (!veiculoDoc.exists) {
        return { error: 'Veículo selecionado não foi encontrado.' }
      }
    }

    const cpfCriptografado = encrypt(cpfDigits)

    const pecasLimpa: PropostaPecaConserto[] = (input.pecasConserto ?? [])
      .map((p) => ({
        nome: sanitizeText(p.nome),
        valor: sanitizeOptionalNumber(Number(p.valor)) ?? 0,
      }))
      .filter((p) => p.nome.length > 0)

    const docRef = adminDb.collection('propostas').doc()
    const numeroContrato =
      sanitizeText(input.numero_contrato ?? '') ||
      `#${docRef.id.slice(0, 8).toUpperCase()}`

    const clienteData = sanitizeText(input.cliente_data ?? '') || null
    const nowIso = new Date().toISOString()

    await docRef.set({
      veiculo_id: veiculoId || null,
      user_id: null,
      nome,
      cpf: cpfCriptografado,
      telefone,
      email,
      valor,
      mensagem,
      proposta_previa: propostaPreviaNum,
      status: input.status ?? 'pendente',
      cliente_data: clienteData,
      numero_contrato: numeroContrato,

      veiculo_marca: veiculoMarca,
      veiculo_modelo: veiculoModelo,
      veiculo_ano: sanitizeOptionalInt(input.veiculo_ano),
      veiculo_placa: veiculoPlaca || null,
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

      created_at: nowIso,
      updated_at: nowIso,
      origem: 'manual',
    })

    revalidatePath('/dashboard/propostas')

    return { success: 'Proposta cadastrada com sucesso!', id: docRef.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao cadastrar proposta.'
    console.error('Erro ao cadastrar proposta:', err)
    return { error: message }
  }
}
