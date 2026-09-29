'use server'

import { revalidatePath } from 'next/cache'
import { adminDb } from '@/utils/firebase/admin'
import { assertPageAccess } from '@/utils/permissions'
import { encrypt, decrypt } from '@/utils/crypto'
import { normalizarProspeccao } from './prospeccao-parse'
import type { Prospeccao, ProspeccaoInput, ProspeccaoResponse } from './types'

// Prospecção de clientes do jurídico. CPF/CNPJ é gravado criptografado,
// como o CPF dos processos (ver actions.ts).

const COLLECTION = 'juridico_prospeccao'
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
    created_at: data.created_at ?? '',
    updated_at: data.updated_at ?? data.created_at ?? '',
  }
}

/** Lista as prospecções, mais recentes primeiro. */
export async function getProspeccoes(): Promise<Prospeccao[]> {
  try {
    await assertPageAccess('juridico')
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
    user = await assertPageAccess('juridico')
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
      revalidatePath('/dashboard/juridico')
      return {
        success: 'Prospecção atualizada.',
        prospeccao: { id, ...dados, created_at: doc.data()?.created_at ?? now, updated_at: now },
      }
    }

    const ref = adminDb.collection(COLLECTION).doc()
    await ref.set({ ...paraGravar(dados), created_by: user.uid, created_at: now, updated_at: now })
    revalidatePath('/dashboard/juridico')
    return {
      success: 'Prospecção cadastrada.',
      prospeccao: { id: ref.id, ...dados, created_at: now, updated_at: now },
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
    user = await assertPageAccess('juridico')
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
    revalidatePath('/dashboard/juridico')
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
    await assertPageAccess('juridico')
  } catch (err) {
    return { error: erroMsg(err, 'Acesso negado.') }
  }
  if (!id) return { error: 'ID inválido.' }
  try {
    const ref = adminDb.collection(COLLECTION).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Registro não encontrado.' }
    await ref.delete()
    revalidatePath('/dashboard/juridico')
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
    await assertPageAccess('juridico')
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
    revalidatePath('/dashboard/juridico')
    return { success: `${unicos.length} registro(s) removido(s).`, removidos: unicos.length }
  } catch (error) {
    return { error: `Erro ao remover: ${erroMsg(error, 'erro inesperado')}` }
  }
}

/**
 * Uma prospecção pelo id — usada para preencher /dashboard/propostas/nova
 * (?prospeccao=<id>). Exige acesso ao jurídico; sem ele, devolve null.
 */
export async function getProspeccao(id: string): Promise<Prospeccao | null> {
  try {
    await assertPageAccess('juridico')
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
