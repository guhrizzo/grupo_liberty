'use server'

import { revalidatePath } from 'next/cache'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/utils/firebase/admin'
import { assertAlgumaAba, isAdmSupremo } from '@/utils/permissions'
import { encrypt, decrypt } from '@/utils/crypto'
import { normalizarProspeccao } from './prospeccao-parse'
import { agruparEmLotes, classificarLinhas, linhasParaGravar } from './prospeccao-importacao'
import { emailValido } from './prospeccao-proposta'
import {
  OBSERVACAO_MAX,
  dataValida,
  normalizarVisitas,
  ordenarVisitas,
  resultadoValido,
} from './prospeccao-visita'
import { sendProspeccaoOfertaEmail } from '@/utils/email/send-prospeccao-oferta-email'
import type {
  LinhaImportacao,
  Prospeccao,
  ProspeccaoInput,
  ProspeccaoResponse,
  VisitaLead,
} from './types'

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
    vinculados: Array.isArray(data.vinculados)
      ? data.vinculados.filter((x: unknown): x is string => typeof x === 'string' && !!x)
      : [],
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
        vinculados: [],
        created_at: now,
        updated_at: now,
      },
    }
  } catch (error) {
    return { error: `Erro ao salvar: ${erroMsg(error, 'erro inesperado')}` }
  }
}

function resumoImportacao(importados: number, duplicados: number, pendentes: number): string {
  return [
    importados ? `${importados} importado(s).` : 'Nenhum lead importado.',
    duplicados ? `${duplicados} já cadastrado(s) ignorado(s).` : '',
    pendentes ? `${pendentes} divergente(s) sem confirmação não importado(s).` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

type OpLote = (b: FirebaseFirestore.WriteBatch) => void

/** Executa operações em lotes (o Firestore aceita até 500 por batch). */
async function emLotes(ops: OpLote[]) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = adminDb.batch()
    ops.slice(i, i + 400).forEach((op) => op(batch))
    await batch.commit()
  }
}

/**
 * Importa linhas da planilha (arquivo ou colar). O servidor reclassifica tudo
 * contra o cadastro (não confia na prévia): duplicados são ignorados;
 * divergentes só entram com `confirmado` e entram ligados (nos dois sentidos)
 * aos leads com que batem.
 */
export async function importarProspeccoes(linhas: LinhaImportacao[]): Promise<{
  success?: string
  error?: string
  importados?: number
  duplicados?: number
  pendentes?: number
}> {
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

  const entradas = linhas
    .map((l) => ({
      dados: normalizarProspeccao(l && typeof l.dados === 'object' && l.dados ? l.dados : {}),
      confirmado: l?.confirmado === true,
    }))
    .filter((e) => e.dados.nomeExecutado)
  if (entradas.length === 0) return { error: 'Nenhuma linha com nome do executado.' }

  let gravados = 0

  try {
    const snap = await adminDb.collection(COLLECTION).get()
    const existentes = snap.docs.map((d) => ({
      id: d.id,
      dados: normalizarProspeccao({ ...d.data(), cpfCnpj: decryptOrRaw(d.data().cpfCnpj) }),
    }))
    const classificadas = classificarLinhas(
      entradas.map((e) => e.dados),
      existentes,
    )
    const confirmados = new Set(entradas.flatMap((e, i) => (e.confirmado ? [i] : [])))
    const gravar = linhasParaGravar(classificadas, confirmados)
    const duplicados = classificadas.filter((l) => l.classe === 'duplicado').length
    const pendentes = classificadas.filter(
      (l) => l.classe === 'divergente' && !confirmados.has(l.indice),
    ).length

    if (gravar.length === 0) {
      return { error: resumoImportacao(0, duplicados, pendentes), duplicados, pendentes }
    }

    const col = adminDb.collection(COLLECTION)
    const refs = new Map(gravar.map((i) => [i, col.doc()]))
    const vinculos = new Map<number, Set<string>>(gravar.map((i) => [i, new Set<string>()]))
    // Leads cadastrados que cada linha liga (recebem o id novo de volta).
    const ligaExistentes = new Map<number, string[]>(gravar.map((i) => [i, []]))

    // Confere logo antes de gravar se os leads a ligar ainda existem: um
    // update num doc apagado nesse meio-tempo derrubaria o lote inteiro.
    const alvos = [
      ...new Set(
        gravar.flatMap((i) =>
          classificadas[i].correspondencias.flatMap((c) => (c.ref.tipo === 'existente' ? [c.ref.id] : [])),
        ),
      ),
    ]
    const aindaExistem = new Set<string>()
    for (let k = 0; k < alvos.length; k += 300) {
      const docs = await adminDb.getAll(...alvos.slice(k, k + 300).map((id) => col.doc(id)))
      for (const d of docs) if (d.exists) aindaExistem.add(d.id)
    }

    for (const i of gravar) {
      const id = refs.get(i)!.id
      for (const c of classificadas[i].correspondencias) {
        if (c.ref.tipo === 'existente') {
          if (!aindaExistem.has(c.ref.id)) continue
          vinculos.get(i)!.add(c.ref.id)
          ligaExistentes.get(i)!.push(c.ref.id)
        } else {
          // Linha do próprio lote: liga só se ela também está sendo gravada.
          const outra = refs.get(c.ref.indice)
          if (!outra) continue
          vinculos.get(i)!.add(outra.id)
          vinculos.get(c.ref.indice)!.add(id)
        }
      }
    }

    // Mantém a ordem da planilha na listagem (mais recente primeiro): cada
    // linha recebe um created_at 1ms menor que a anterior.
    const base = Date.now()
    const ordem = new Map(gravar.map((i, n) => [i, n]))
    // Cada linha vai inteira (o lead novo + as ligações de volta) num lote:
    // se um lote falhar, as linhas dos anteriores já estão completas.
    const lotes = agruparEmLotes(gravar, (i) => 1 + ligaExistentes.get(i)!.length, 400)
    for (const lote of lotes) {
      const batch = adminDb.batch()
      for (const i of lote) {
        const ts = new Date(base - ordem.get(i)!).toISOString()
        const novoId = refs.get(i)!.id
        batch.set(refs.get(i)!, {
          ...paraGravar(entradas[i].dados),
          vinculados: [...vinculos.get(i)!],
          created_by: user.uid,
          created_at: ts,
          updated_at: ts,
        })
        for (const alvo of ligaExistentes.get(i)!) {
          batch.update(col.doc(alvo), { vinculados: FieldValue.arrayUnion(novoId) })
        }
      }
      await batch.commit()
      gravados += lote.length
    }
    revalidar()
    return {
      success: resumoImportacao(gravados, duplicados, pendentes),
      importados: gravados,
      duplicados,
      pendentes,
    }
  } catch (error) {
    if (gravados > 0) revalidar()
    return {
      error: `Erro ao importar: ${erroMsg(error, 'erro inesperado')}${
        gravados ? ` ${gravados} lead(s) foram gravados antes do erro.` : ''
      }`,
      importados: gravados,
    }
  }
}

/**
 * Antes de apagar leads, tira os ids deles dos `vinculados` dos leads que
 * continuam (os que eles listam e os que os listam).
 */
async function desvincular(ids: string[]) {
  const apagados = new Set(ids)
  const col = adminDb.collection(COLLECTION)
  const remover = new Map<string, Set<string>>()
  const marcar = (alvo: string, apagado: string) => {
    if (apagados.has(alvo)) return
    const s = remover.get(alvo) ?? new Set<string>()
    s.add(apagado)
    remover.set(alvo, s)
  }
  for (let i = 0; i < ids.length; i += 300) {
    const docs = await adminDb.getAll(...ids.slice(i, i + 300).map((id) => col.doc(id)))
    for (const d of docs) {
      const v = d.data()?.vinculados
      if (!Array.isArray(v)) continue
      for (const alvo of v) if (typeof alvo === 'string') marcar(alvo, d.id)
    }
  }
  // Ligação gravada só de um lado (dado inconsistente): procura quem aponta
  // para os apagados.
  for (let i = 0; i < ids.length; i += 30) {
    const q = await col.where('vinculados', 'array-contains-any', ids.slice(i, i + 30)).get()
    for (const d of q.docs) {
      for (const v of d.data().vinculados as string[]) if (apagados.has(v)) marcar(d.id, v)
    }
  }
  if (remover.size === 0) return
  const alvos = [...remover.keys()]
  const existentes = new Set<string>()
  for (let i = 0; i < alvos.length; i += 300) {
    const docs = await adminDb.getAll(...alvos.slice(i, i + 300).map((id) => col.doc(id)))
    for (const d of docs) if (d.exists) existentes.add(d.id)
  }
  await emLotes(
    alvos
      .filter((id) => existentes.has(id))
      .map<OpLote>((id) => (b) =>
        b.update(col.doc(id), { vinculados: FieldValue.arrayRemove(...remover.get(id)!) }),
      ),
  )
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
    await desvincular([id])
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
    await desvincular(unicos)
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
