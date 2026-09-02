'use server'

import { revalidatePath } from 'next/cache'
import { adminDb } from '@/utils/firebase/admin'
import { assertPodeGerarContratos, getSessionUser } from '@/utils/permissions'
import {
  CATEGORIAS_CONTRATO_FIXAS,
  type ContratoCategoria,
} from './types'

const COLLECTION = 'contrato_categorias'
const ORDEM_CUSTOM = 1000
const NOME_MIN = 2
const NOME_MAX = 60

type CategoriaResult = { categoria?: ContratoCategoria; error?: string }
type SimpleResult = { success?: string; error?: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** nome → slug: sem acento, minúsculo, não-alfanumérico vira '-'. */
function slugifyCategoria(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const SLUGS_FIXOS = new Set(CATEGORIAS_CONTRATO_FIXAS.map((c) => c.slug))

async function assertAdmin() {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')
  if (user.role !== 'admin') {
    throw new Error('Acesso negado. Apenas administradores podem gerenciar categorias.')
  }
  return user
}

function serializeCategoria(
  id: string,
  data: FirebaseFirestore.DocumentData,
): ContratoCategoria {
  return {
    id,
    nome: String(data.nome ?? ''),
    slug: String(data.slug ?? ''),
    fixa: data.fixa === true,
    ordem: typeof data.ordem === 'number' ? data.ordem : ORDEM_CUSTOM,
    criadoPorUid: data.criadoPorUid ?? null,
    criadoEm: data.criadoEm ?? '',
  }
}

/** Fixas primeiro por `ordem`, depois custom por `nome` (pt-BR, case-insensitive). */
function ordenarCategorias(lista: ContratoCategoria[]): ContratoCategoria[] {
  return [...lista].sort((a, b) => {
    if (a.fixa !== b.fixa) return a.fixa ? -1 : 1
    if (a.fixa && b.fixa) return a.ordem - b.ordem
    return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
  })
}

function validarNome(nome: string): string | null {
  if (nome.length < NOME_MIN || nome.length > NOME_MAX) {
    return `O nome deve ter entre ${NOME_MIN} e ${NOME_MAX} caracteres.`
  }
  return null
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Lista as categorias de contrato. Semeia as 6 fixas (id = slug) se faltarem.
 * Gate: assertPodeGerarContratos (retorna [] se sem acesso).
 */
export async function listarCategoriasContrato(): Promise<ContratoCategoria[]> {
  try {
    await assertPodeGerarContratos()
  } catch {
    return []
  }

  try {
    const snapshot = await adminDb.collection(COLLECTION).get()
    const presentes = new Set<string>()
    const categorias: ContratoCategoria[] = snapshot.docs.map((doc) => {
      const c = serializeCategoria(doc.id, doc.data())
      presentes.add(c.slug)
      return c
    })

    const faltantes = CATEGORIAS_CONTRATO_FIXAS.filter((f) => !presentes.has(f.slug))
    if (faltantes.length > 0) {
      const now = new Date().toISOString()
      const batch = adminDb.batch()
      for (const f of faltantes) {
        const ref = adminDb.collection(COLLECTION).doc(f.slug)
        const dados = {
          nome: f.nome,
          slug: f.slug,
          fixa: true,
          ordem: f.ordem,
          criadoPorUid: null,
          criadoEm: now,
        }
        batch.set(ref, dados)
        categorias.push(serializeCategoria(f.slug, dados))
      }
      await batch.commit()
    }

    return ordenarCategorias(categorias)
  } catch (err) {
    console.error('Erro ao listar categorias de contrato:', err)
    return []
  }
}

/**
 * Cria uma categoria custom ("Outros"). Gate: admin.
 */
export async function criarCategoriaContrato(nome: string): Promise<CategoriaResult> {
  let user
  try {
    user = await assertAdmin()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  const nomeLimpo = (nome ?? '').trim()
  const erroNome = validarNome(nomeLimpo)
  if (erroNome) return { error: erroNome }

  const slug = slugifyCategoria(nomeLimpo)
  if (!slug) return { error: 'Nome inválido.' }
  if (SLUGS_FIXOS.has(slug)) {
    return { error: 'Já existe uma categoria com esse nome.' }
  }

  try {
    const existente = await adminDb
      .collection(COLLECTION)
      .where('slug', '==', slug)
      .limit(1)
      .get()
    if (!existente.empty) {
      return { error: 'Já existe uma categoria com esse nome.' }
    }

    const now = new Date().toISOString()
    const ref = adminDb.collection(COLLECTION).doc()
    const dados = {
      nome: nomeLimpo,
      slug,
      fixa: false,
      ordem: ORDEM_CUSTOM,
      criadoPorUid: user.uid,
      criadoEm: now,
    }
    await ref.set(dados)

    revalidatePath('/dashboard/contratos')
    return { categoria: serializeCategoria(ref.id, dados) }
  } catch (err) {
    console.error('Erro ao criar categoria de contrato:', err)
    return { error: 'Erro ao criar categoria.' }
  }
}

/**
 * Renomeia uma categoria custom e propaga o nome para os contratos que a usam.
 * Gate: admin. Categorias fixas não podem ser renomeadas.
 */
export async function renomearCategoriaContrato(
  id: string,
  nome: string,
): Promise<CategoriaResult> {
  try {
    await assertAdmin()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  if (!id) return { error: 'ID inválido.' }

  const nomeLimpo = (nome ?? '').trim()
  const erroNome = validarNome(nomeLimpo)
  if (erroNome) return { error: erroNome }

  const slug = slugifyCategoria(nomeLimpo)
  if (!slug) return { error: 'Nome inválido.' }
  if (SLUGS_FIXOS.has(slug)) {
    return { error: 'Já existe uma categoria com esse nome.' }
  }

  try {
    const ref = adminDb.collection(COLLECTION).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Categoria não encontrada.' }
    if (doc.data()!.fixa === true) {
      return { error: 'As categorias padrão não podem ser alteradas.' }
    }

    const colisao = await adminDb
      .collection(COLLECTION)
      .where('slug', '==', slug)
      .limit(1)
      .get()
    if (!colisao.empty && colisao.docs[0].id !== id) {
      return { error: 'Já existe uma categoria com esse nome.' }
    }

    await ref.update({ nome: nomeLimpo, slug })

    // Propaga o nome desnormalizado para os contratos que usam esta categoria.
    const contratos = await adminDb
      .collection('veiculo_contratos')
      .where('categoriaId', '==', id)
      .get()
    if (!contratos.empty) {
      const docs = contratos.docs
      for (let i = 0; i < docs.length; i += 400) {
        const batch = adminDb.batch()
        for (const c of docs.slice(i, i + 400)) {
          batch.update(c.ref, { categoriaNome: nomeLimpo })
        }
        await batch.commit()
      }
    }

    revalidatePath('/dashboard/contratos')
    return {
      categoria: serializeCategoria(id, { ...doc.data(), nome: nomeLimpo, slug }),
    }
  } catch (err) {
    console.error('Erro ao renomear categoria de contrato:', err)
    return { error: 'Erro ao renomear categoria.' }
  }
}

/**
 * Remove uma categoria custom. Gate: admin. Bloqueia se houver contrato usando
 * e se a categoria for fixa.
 */
export async function removerCategoriaContrato(id: string): Promise<SimpleResult> {
  try {
    await assertAdmin()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  if (!id) return { error: 'ID inválido.' }

  try {
    const ref = adminDb.collection(COLLECTION).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Categoria não encontrada.' }
    if (doc.data()!.fixa === true) {
      return { error: 'As categorias padrão não podem ser removidas.' }
    }

    const emUso = await adminDb
      .collection('veiculo_contratos')
      .where('categoriaId', '==', id)
      .get()
    if (emUso.size > 0) {
      return {
        error: `${emUso.size} contrato(s) usam esta categoria. Altere-os antes de apagar.`,
      }
    }

    await ref.delete()
    revalidatePath('/dashboard/contratos')
    return { success: 'Categoria removida.' }
  } catch (err) {
    console.error('Erro ao remover categoria de contrato:', err)
    return { error: 'Erro ao remover categoria.' }
  }
}

/**
 * Define/altera a categoria de um contrato já anexado. Gate: acesso a contratos.
 */
export async function definirCategoriaContrato(
  contratoId: string,
  categoriaId: string,
): Promise<SimpleResult> {
  try {
    await assertPodeGerarContratos()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  if (!contratoId || !categoriaId) return { error: 'Dados inválidos.' }

  try {
    const contratoRef = adminDb.collection('veiculo_contratos').doc(contratoId)
    const contratoDoc = await contratoRef.get()
    if (!contratoDoc.exists) return { error: 'Contrato não encontrado.' }

    const categoriaDoc = await adminDb
      .collection(COLLECTION)
      .doc(categoriaId)
      .get()
    if (!categoriaDoc.exists) return { error: 'Categoria inválida.' }

    await contratoRef.update({
      categoriaId,
      categoriaNome: String(categoriaDoc.data()!.nome ?? ''),
    })

    revalidatePath('/dashboard/contratos')
    const veiculoId = contratoDoc.data()!.veiculoId
    if (veiculoId) revalidatePath(`/veiculos/${veiculoId}`)
    return { success: 'Categoria atualizada.' }
  } catch (err) {
    console.error('Erro ao definir categoria do contrato:', err)
    return { error: 'Erro ao atualizar a categoria.' }
  }
}
