'use server'

import { revalidatePath } from 'next/cache'
import { adminDb } from '@/utils/firebase/admin'
import { assertAlgumaAba, isAdmSupremo } from '@/utils/permissions'
import { encrypt, decrypt } from '@/utils/crypto'
import { normalizarProspeccao } from './prospeccao-parse'
import { emailValido } from './prospeccao-proposta'
import {
  OBSERVACAO_MAX,
  dataValida,
  normalizarVisitas,
  ordenarVisitas,
  resultadoValido,
} from './prospeccao-visita'
import { sendProspeccaoOfertaEmail } from '@/utils/email/send-prospeccao-oferta-email'
import type { Prospeccao, ProspeccaoInput, ProspeccaoResponse, VisitaLead } from './types'

// Prospecção de clientes do jurídico. CPF/CNPJ é gravado criptografado,
// como o CPF dos processos (ver actions.ts).

const COLLECTION = 'juridico_prospeccao'

// Os mesmos registros aparecem no Jurídico (sub-aba Prospecção) e na aba
// Leads: quem tem acesso a qualquer uma das duas faz o CRUD.
function assertAcesso() {
  return assertAlgumaAba(['juridico', 'leads'])
}

function revalidar() {
  revalidatePath('/dashboard/juridico')
  revalidatePath('/dashboard/leads')
}
const IMPORT_MAX = 400

function erroMsg(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

function decryptOrRaw(value: string | null | undefined): string {
  if (!value) return ''
  if (!value.includes(':')) return value
  return decrypt(value) || value
}

function paraGravar(dados: ProspeccaoInput) {
  return { ...dados, cpfCnpj: dados.cpfCnpj ? encrypt(dados.cpfCnpj) : '' }
}

function serializar(id: string, data: FirebaseFirestore.DocumentData): Prospeccao {
  return {
    id,
    ...normalizarProspeccao({ ...data, cpfCnpj: decryptOrRaw(data.cpfCnpj) }),
    visitas: normalizarVisitas(data.visitas),
    ultimoEmailEm: data.ultimoEmailEm ?? null,
    ultimoEmailValor: typeof data.ultimoEmailValor === 'number' ? data.ultimoEmailValor : null,
    created_at: data.created_at ?? '',
    updated_at: data.updated_at ?? data.created_at ?? '',
  }
}

/** Lista as prospecções, mais recentes primeiro. */
export async function getProspeccoes(): Promise<Prospeccao[]> {
  try {
    await assertAcesso()
  } catch {
    return []
  }
  try {
    const snapshot = await adminDb.collection(COLLECTION).orderBy('created_at', 'desc').get()
    return snapshot.docs.map((d) => serializar(d.id, d.data()))
  } catch (error) {
    console.error('Erro ao buscar prospecções:', error)
    return []
  }
}

/** Cria (id nulo) ou atualiza uma prospecção. */
export async function salvarProspeccao(
  id: string | null,
  raw: Partial<Record<keyof ProspeccaoInput, unknown>>,
): Promise<ProspeccaoResponse> {
  let user
  try {
    user = await assertAcesso()
  } catch (err) {
    return { error: erroMsg(err, 'Acesso negado.') }
  }

  const dados = normalizarProspeccao(raw)
  if (!dados.nomeExecutado) return { error: 'Informe o nome do executado.' }

  try {
    const now = new Date().toISOString()
    if (id) {
      const ref = adminDb.collection(COLLECTION).doc(id)
      const doc = await ref.get()
      if (!doc.exists) return { error: 'Registro não encontrado.' }
      await ref.update({ ...paraGravar(dados), updated_at: now })
      revalidar()
      return {
        success: 'Prospecção atualizada.',
        prospeccao: { ...serializar(id, doc.data()!), ...dados, updated_at: now },
      }
    }

    const ref = adminDb.collection(COLLECTION).doc()
    await ref.set({ ...paraGravar(dados), created_by: user.uid, created_at: now, updated_at: now })
    revalidar()
    return {
      success: 'Prospecção cadastrada.',
      prospeccao: {
        id: ref.id,
        ...dados,
        visitas: [],
        ultimoEmailEm: null,
        ultimoEmailValor: null,
        created_at: now,
        updated_at: now,
      },
    }
  } catch (error) {
    return { error: `Erro ao salvar: ${erroMsg(error, 'erro inesperado')}` }
  }
}

/** Importa várias linhas coladas da planilha de uma vez. */
export async function importarProspeccoes(
  linhas: Partial<Record<keyof ProspeccaoInput, unknown>>[],
): Promise<{ success?: string; error?: string; importados?: number }> {
  let user
  try {
    user = await assertAcesso()
  } catch (err) {
    return { error: erroMsg(err, 'Acesso negado.') }
  }

  if (!Array.isArray(linhas) || linhas.length === 0) return { error: 'Nenhuma linha para importar.' }
  if (linhas.length > IMPORT_MAX) {
    return { error: `Importe no máximo ${IMPORT_MAX} linhas por vez.` }
  }

  const validos = linhas.map(normalizarProspeccao).filter((d) => d.nomeExecutado)
  if (validos.length === 0) return { error: 'Nenhuma linha com nome do executado.' }

  try {
    const batch = adminDb.batch()
    // Mantém a ordem da planilha na listagem (mais recente primeiro): cada
    // linha recebe um created_at 1ms menor que a anterior.
    const base = Date.now()
    validos.forEach((dados, i) => {
      const ts = new Date(base - i).toISOString()
      batch.set(adminDb.collection(COLLECTION).doc(), {
        ...paraGravar(dados),
        created_by: user.uid,
        created_at: ts,
        updated_at: ts,
      })
    })
    await batch.commit()
    revalidar()
    return {
      success: `${validos.length} registro(s) importado(s).`,
      importados: validos.length,
    }
  } catch (error) {
    return { error: `Erro ao importar: ${erroMsg(error, 'erro inesperado')}` }
  }
}

/** Remove uma prospecção. */
export async function deleteProspeccao(id: string): Promise<{ success?: string; error?: string }> {
  try {
    await assertAcesso()
  } catch (err) {
    return { error: erroMsg(err, 'Acesso negado.') }
  }
  if (!id) return { error: 'ID inválido.' }
  try {
    const ref = adminDb.collection(COLLECTION).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Registro não encontrado.' }
    await ref.delete()
    revalidar()
    return { success: 'Prospecção removida.' }
  } catch (error) {
    return { error: `Erro ao remover: ${erroMsg(error, 'erro inesperado')}` }
  }
}

/** Remove várias prospecções de uma vez (seleção ou "excluir tudo"). */
export async function deleteProspeccoes(
  ids: string[],
): Promise<{ success?: string; error?: string; removidos?: number }> {
  try {
    await assertAcesso()
  } catch (err) {
    return { error: erroMsg(err, 'Acesso negado.') }
  }
  const unicos = [...new Set((Array.isArray(ids) ? ids : []).filter((x) => typeof x === 'string' && x))]
  if (unicos.length === 0) return { error: 'Nenhum registro selecionado.' }
  try {
    // Firestore aceita até 500 operações por batch.
    for (let i = 0; i < unicos.length; i += 400) {
      const batch = adminDb.batch()
      for (const id of unicos.slice(i, i + 400)) {
        batch.delete(adminDb.collection(COLLECTION).doc(id))
      }
      await batch.commit()
    }
    revalidar()
    return { success: `${unicos.length} registro(s) removido(s).`, removidos: unicos.length }
  } catch (error) {
    return { error: `Erro ao remover: ${erroMsg(error, 'erro inesperado')}` }
  }
}

/**
 * Uma prospecção pelo id — usada para preencher /dashboard/propostas/nova
 * (?prospeccao=<id>). Exige acesso ao Jurídico ou a Leads; sem ele, devolve null.
 */
export async function getProspeccao(id: string): Promise<Prospeccao | null> {
  try {
    await assertAcesso()
  } catch {
    return null
  }
  if (!id) return null
  try {
    const doc = await adminDb.collection(COLLECTION).doc(id).get()
    return doc.exists ? serializar(doc.id, doc.data()!) : null
  } catch (error) {
    console.error('Erro ao buscar prospecção:', error)
    return null
  }
}

/**
 * Envia por e-mail uma oferta pelo veículo do executado. O destinatário é
 * sempre o e-mail salvo na prospecção (não vem do navegador). Grava data e
 * valor do envio para a tabela mostrar quando o último e-mail saiu.
 */
export async function enviarOfertaEmail(
  id: string,
  dados: { valor: number; assunto: string; mensagem: string },
): Promise<{ success?: string; error?: string; prospeccao?: Prospeccao }> {
  try {
    await assertAcesso()
  } catch (err) {
    return { error: erroMsg(err, 'Acesso negado.') }
  }

  const valor = Number(dados?.valor)
  const assunto = String(dados?.assunto ?? '').trim().slice(0, 200)
  const mensagem = String(dados?.mensagem ?? '').trim()
  if (!id) return { error: 'ID inválido.' }
  if (!Number.isFinite(valor) || valor <= 0) return { error: 'Informe o valor da oferta.' }
  if (!assunto) return { error: 'Informe o assunto.' }
  if (!mensagem) return { error: 'Escreva a mensagem.' }
  if (mensagem.length > 5000) return { error: 'A mensagem passa de 5000 caracteres.' }

  try {
    const ref = adminDb.collection(COLLECTION).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Registro não encontrado.' }
    const atual = serializar(doc.id, doc.data()!)
    if (!emailValido(atual.email)) return { error: 'Este registro não tem e-mail válido.' }

    const envio = await sendProspeccaoOfertaEmail({
      para: atual.email,
      assunto,
      mensagem,
      veiculo: [atual.veiculo, atual.anoModelo].filter(Boolean).join(' · ') || 'seu veículo',
      valorOferta: valor,
    })
    if (!envio.ok) return { error: `E-mail não enviado: ${envio.erro}` }

    const now = new Date().toISOString()
    await ref.update({ ultimoEmailEm: now, ultimoEmailValor: valor })
    revalidar()
    return {
      success: `E-mail enviado para ${atual.email}.`,
      prospeccao: { ...atual, ultimoEmailEm: now, ultimoEmailValor: valor },
    }
  } catch (error) {
    return { error: `Erro ao enviar: ${erroMsg(error, 'erro inesperado')}` }
  }
}

/**
 * Registra o resultado de uma visita do vendedor ao cliente. O histórico fica
 * no próprio documento do lead (campo `visitas`).
 */
export async function registrarVisita(
  id: string,
  raw: { resultado?: unknown; data?: unknown; retornoEm?: unknown; observacao?: unknown },
): Promise<ProspeccaoResponse> {
  let user
  try {
    user = await assertAcesso()
  } catch (err) {
    return { error: erroMsg(err, 'Acesso negado.') }
  }

  if (!resultadoValido(raw.resultado)) return { error: 'Escolha o resultado da visita.' }
  if (!dataValida(raw.data)) return { error: 'Informe a data da visita.' }
  const resultado = raw.resultado
  const data = raw.data
  let retornoEm: string | null = null
  if (resultado === 'retornar') {
    if (!dataValida(raw.retornoEm)) return { error: 'Informe quando retornar ao cliente.' }
    if (raw.retornoEm < data) return { error: 'O retorno não pode ser antes da visita.' }
    retornoEm = raw.retornoEm
  }
  const observacao = String(raw.observacao ?? '').trim().slice(0, OBSERVACAO_MAX)

  const visita: VisitaLead = {
    id: crypto.randomUUID(),
    resultado,
    data,
    retornoEm,
    observacao,
    vendedorUid: user.uid,
    vendedorNome: user.name || user.email || 'Usuário',
    criadoEm: new Date().toISOString(),
  }

  try {
    const ref = adminDb.collection(COLLECTION).doc(id)
    const atualizado = await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(ref)
      if (!doc.exists) return null
      const visitas = ordenarVisitas([...normalizarVisitas(doc.data()!.visitas), visita])
      tx.update(ref, { visitas })
      return serializar(id, { ...doc.data()!, visitas })
    })
    if (!atualizado) return { error: 'Registro não encontrado.' }
    revalidar()
    return { success: 'Visita registrada.', prospeccao: atualizado }
  } catch (error) {
    return { error: `Erro ao registrar a visita: ${erroMsg(error, 'erro inesperado')}` }
  }
}

/** Exclui uma visita — só quem registrou ou o ADM supremo. */
export async function excluirVisita(id: string, visitaId: string): Promise<ProspeccaoResponse> {
  let user
  try {
    user = await assertAcesso()
  } catch (err) {
    return { error: erroMsg(err, 'Acesso negado.') }
  }

  try {
    const ref = adminDb.collection(COLLECTION).doc(id)
    const res = await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(ref)
      if (!doc.exists) return { error: 'Registro não encontrado.' }
      const visitas = normalizarVisitas(doc.data()!.visitas)
      const alvo = visitas.find((v) => v.id === visitaId)
      if (!alvo) return { error: 'Visita não encontrada.' }
      if (alvo.vendedorUid !== user.uid && !isAdmSupremo(user)) {
        return { error: 'Só quem registrou a visita pode excluí-la.' }
      }
      const restantes = visitas.filter((v) => v.id !== visitaId)
      tx.update(ref, { visitas: restantes })
      return { prospeccao: serializar(id, { ...doc.data()!, visitas: restantes }) }
    })
    if ('error' in res) return { error: res.error }
    revalidar()
    return { success: 'Visita excluída.', prospeccao: res.prospeccao }
  } catch (error) {
    return { error: `Erro ao excluir a visita: ${erroMsg(error, 'erro inesperado')}` }
  }
}
