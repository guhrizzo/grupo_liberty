'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { adminDb, adminStorage } from '@/utils/firebase/admin'
import { decrypt, encrypt } from '@/utils/crypto'
import { onlyDigits } from '@/utils/masks'
import { validarCPF } from '@/utils/validadorCpf'
import { getSessionUser, hasPageAccess, type SessionUser } from '@/utils/permissions'
import { getVehicles } from '../veiculos/actions'
import {
  ANEXO_TAMANHO_MAX,
  ANEXO_TIPOS,
  FICHA_TEXTO_MAX,
  QUITACAO_OBS_MAX,
  TIPOS_ANEXO,
  extensaoAnexo,
  type AnexoQuitacao,
  type AnexosPorVeiculo,
  type TipoAnexo,
  type FichaInput,
  type FichaQuitacao,
  type VeiculoTerceiroInput,
  type Quitacao,
  type QuitacaoInput,
  type QuitacaoLoteInput,
  type UltimaQuitacao,
  type VeiculoQuitacaoOpcao,
} from './types'

const COLECAO = 'quitacoes'
const COL_FICHAS = 'quitacao_fichas'
const COL_TERCEIROS = 'quitacao_terceiros'
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

type Resultado = { success?: string; error?: string }

// Quitações seguem o acesso à aba Veículos (regra única de permissões).
async function checarAcesso(): Promise<{ user: SessionUser } | { error: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!hasPageAccess(user, 'veiculos')) return { error: 'Acesso negado.' }
  return { user }
}

function serialize(id: string, d: FirebaseFirestore.DocumentData): Quitacao {
  return {
    id,
    veiculoId: d.veiculoId ?? '',
    valor: Number(d.valor) || 0,
    data: d.data ?? '',
    observacao: d.observacao ?? '',
    criadoPorNome: d.criadoPorNome ?? 'Usuário',
    criadoEm: d.criadoEm ?? '',
  }
}

/** Mais recente primeiro: pela data da negociação e, em empate, pelo registro. */
function maisRecente(a: Quitacao, b: Quitacao): number {
  return b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)
}

function validar(input: QuitacaoInput): { error: string } | { valor: number; data: string; observacao: string } {
  const valor = Number(input.valor)
  if (!Number.isFinite(valor) || valor <= 0) return { error: 'Informe o valor da quitação.' }
  const data = String(input.data ?? '')
  if (!DATA_RE.test(data) || Number.isNaN(new Date(`${data}T00:00:00`).getTime())) {
    return { error: 'Informe a data da negociação.' }
  }
  const observacao = String(input.observacao ?? '').trim()
  if (observacao.length > QUITACAO_OBS_MAX) return { error: `Observação: máximo de ${QUITACAO_OBS_MAX} caracteres.` }
  return { valor: Math.round(valor * 100) / 100, data, observacao }
}

export async function listarQuitacoes(): Promise<Quitacao[]> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return []
  const snap = await adminDb.collection(COLECAO).get()
  return snap.docs.map((d) => serialize(d.id, d.data())).sort(maisRecente)
}

export async function listarVeiculosParaQuitacao(): Promise<VeiculoQuitacaoOpcao[]> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return []
  const [veiculos, terceirosSnap] = await Promise.all([getVehicles(), adminDb.collection(COL_TERCEIROS).get()])
  const proprios: VeiculoQuitacaoOpcao[] = veiculos.map((v) => ({
    id: v.id,
    marca: v.marca,
    modelo: v.modelo,
    ano: v.ano,
    placa: v.placa,
    foto: v.fotos?.[0] ?? null,
    terceiro: false,
    criadoEm: v.created_at ?? '',
    sugestao: {
      nome: v.nomeCliente,
      cpf: v.cpfCliente,
      endereco: v.enderecoCliente,
      banco: v.banco,
      valorParcela: v.valorParcela,
    },
  }))
  const terceiros: VeiculoQuitacaoOpcao[] = terceirosSnap.docs.map((d) => {
    const t = d.data()
    return {
      id: d.id,
      marca: String(t.marca ?? ''),
      modelo: String(t.modelo ?? ''),
      ano: Number(t.ano) || 0,
      placa: t.placa ? String(t.placa) : null,
      foto: null,
      terceiro: true,
      criadoEm: String(t.criadoEm ?? ''),
      sugestao: { nome: null, cpf: null, endereco: null, banco: null, valorParcela: null },
    }
  })
  return [...proprios, ...terceiros]
}

/** O id é de um veículo do estoque ou de um veículo de terceiro cadastrado aqui. */
async function veiculoExiste(id: string): Promise<boolean> {
  const [proprio, terceiro] = await Promise.all([
    adminDb.collection('veiculos').doc(id).get(),
    adminDb.collection(COL_TERCEIROS).doc(id).get(),
  ])
  return proprio.exists || terceiro.exists
}

/** Última quitação (a mais recente) de cada veículo — usada na aba Veículos. */
export async function getUltimasQuitacoes(): Promise<Record<string, UltimaQuitacao>> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return {}
  const snap = await adminDb.collection(COLECAO).get()
  const todas = snap.docs.map((d) => serialize(d.id, d.data())).sort(maisRecente)
  const mapa: Record<string, UltimaQuitacao> = {}
  for (const q of todas) {
    if (q.veiculoId && !mapa[q.veiculoId]) mapa[q.veiculoId] = { valor: q.valor, data: q.data }
  }
  return mapa
}

export async function criarQuitacao(input: QuitacaoInput): Promise<Resultado> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }
  const dados = validar(input)
  if ('error' in dados) return { error: dados.error }

  const veiculoId = String(input.veiculoId ?? '')
  if (!veiculoId) return { error: 'Escolha o veículo.' }
  if (!(await veiculoExiste(veiculoId))) return { error: 'Veículo não encontrado.' }

  await adminDb.collection(COLECAO).add({
    veiculoId,
    ...dados,
    criadoPorUid: acesso.user.uid,
    criadoPorNome: acesso.user.name || acesso.user.email || 'Usuário',
    criadoEm: new Date().toISOString(),
  })
  revalidatePath('/dashboard/quitacoes')
  revalidatePath('/dashboard/veiculos')
  return { success: 'Quitação registrada.' }
}

/** Registra de uma vez o valor da semana de vários veículos (um novo registro por veículo). */
export async function criarQuitacoesLote(input: QuitacaoLoteInput): Promise<Resultado> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }

  const data = String(input.data ?? '')
  if (!DATA_RE.test(data) || Number.isNaN(new Date(`${data}T00:00:00`).getTime())) {
    return { error: 'Informe a data da negociação.' }
  }
  const itens = Array.isArray(input.itens) ? input.itens : []
  if (itens.length === 0) return { error: 'Informe o valor de pelo menos um veículo.' }
  if (itens.length > 500) return { error: 'Muitos veículos de uma vez.' }

  const vistos = new Set<string>()
  const validos: { veiculoId: string; valor: number }[] = []
  for (const item of itens) {
    const veiculoId = String(item.veiculoId ?? '')
    const valor = Number(item.valor)
    if (!veiculoId || vistos.has(veiculoId)) return { error: 'Lista de veículos inválida.' }
    if (!Number.isFinite(valor) || valor <= 0) return { error: 'Há um valor inválido na lista.' }
    vistos.add(veiculoId)
    validos.push({ veiculoId, valor: Math.round(valor * 100) / 100 })
  }

  const existem = await Promise.all(validos.map((i) => veiculoExiste(i.veiculoId)))
  if (existem.some((ok) => !ok)) return { error: 'Algum veículo não foi encontrado.' }

  const criadoEm = new Date().toISOString()
  const criadoPorNome = acesso.user.name || acesso.user.email || 'Usuário'
  const batch = adminDb.batch()
  for (const { veiculoId, valor } of validos) {
    batch.set(adminDb.collection(COLECAO).doc(), {
      veiculoId,
      valor,
      data,
      observacao: '',
      criadoPorUid: acesso.user.uid,
      criadoPorNome,
      criadoEm,
    })
  }
  await batch.commit()
  revalidatePath('/dashboard/quitacoes')
  revalidatePath('/dashboard/veiculos')
  return { success: `${validos.length} ${validos.length === 1 ? 'valor registrado' : 'valores registrados'}.` }
}

export async function atualizarQuitacao(id: string, input: QuitacaoInput): Promise<Resultado> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }
  const dados = validar(input)
  if ('error' in dados) return { error: dados.error }
  const ref = adminDb.collection(COLECAO).doc(id)
  if (!(await ref.get()).exists) return { error: 'Quitação não encontrada.' }
  await ref.update({ ...dados, atualizadoEm: new Date().toISOString() })
  revalidatePath('/dashboard/quitacoes')
  revalidatePath('/dashboard/veiculos')
  return { success: 'Quitação atualizada.' }
}

export async function excluirQuitacao(id: string): Promise<Resultado> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }
  const ref = adminDb.collection(COLECAO).doc(id)
  if (!(await ref.get()).exists) return { error: 'Quitação não encontrada.' }
  await ref.delete()
  revalidatePath('/dashboard/quitacoes')
  revalidatePath('/dashboard/veiculos')
  return { success: 'Quitação excluída.' }
}

// ─── Ficha do cliente, situação (quitado) e veículos de terceiros ───────────

const DATA_OPCIONAL_RE = /^(\d{4}-\d{2}-\d{2})?$/

function fichaSerialize(id: string, d: FirebaseFirestore.DocumentData): FichaQuitacao {
  let cpf = ''
  if (d.cpf) {
    cpf = String(d.cpf).includes(':') ? decrypt(String(d.cpf)) || '' : String(d.cpf)
  }
  return {
    veiculoId: id,
    quitado: d.quitado === true,
    quitadoEm: d.quitadoEm ?? null,
    nome: d.nome ?? '',
    nomePai: d.nomePai ?? '',
    nomeMae: d.nomeMae ?? '',
    cpf,
    endereco: d.endereco ?? '',
    dataNascimento: d.dataNascimento ?? '',
    banco: d.banco ?? '',
    numeroContrato: d.numeroContrato ?? '',
    vencimentoParcela: d.vencimentoParcela ?? '',
    valorParcela: Number(d.valorParcela) || 0,
  }
}

/** Ficha (dados do cliente + situação) de cada veículo que já tem uma, por id do veículo. */
export async function listarFichas(): Promise<Record<string, FichaQuitacao>> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return {}
  const snap = await adminDb.collection(COL_FICHAS).get()
  const mapa: Record<string, FichaQuitacao> = {}
  for (const d of snap.docs) mapa[d.id] = fichaSerialize(d.id, d.data())
  return mapa
}

export async function salvarFicha(input: FichaInput): Promise<Resultado> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }
  const veiculoId = String(input.veiculoId ?? '')
  if (!veiculoId || !(await veiculoExiste(veiculoId))) return { error: 'Veículo não encontrado.' }

  const texto = (v: unknown) => String(v ?? '').trim()
  const campos = {
    nome: texto(input.nome),
    nomePai: texto(input.nomePai),
    nomeMae: texto(input.nomeMae),
    endereco: texto(input.endereco),
    banco: texto(input.banco),
    numeroContrato: texto(input.numeroContrato),
  }
  if (Object.values(campos).some((v) => v.length > FICHA_TEXTO_MAX)) {
    return { error: `Cada campo aceita no máximo ${FICHA_TEXTO_MAX} caracteres.` }
  }
  const cpf = onlyDigits(texto(input.cpf))
  if (cpf && !validarCPF(cpf)) return { error: 'CPF inválido.' }
  const dataNascimento = texto(input.dataNascimento)
  const vencimentoParcela = texto(input.vencimentoParcela)
  if (!DATA_OPCIONAL_RE.test(dataNascimento) || !DATA_OPCIONAL_RE.test(vencimentoParcela)) {
    return { error: 'Data inválida.' }
  }
  if (dataNascimento && new Date(`${dataNascimento}T00:00:00`).getTime() > Date.now()) {
    return { error: 'A data de nascimento não pode estar no futuro.' }
  }
  const valorParcela = Number(input.valorParcela) || 0
  if (valorParcela < 0) return { error: 'O valor da parcela não pode ser negativo.' }

  await adminDb
    .collection(COL_FICHAS)
    .doc(veiculoId)
    .set(
      {
        ...campos,
        cpf: cpf ? encrypt(cpf) : '',
        dataNascimento,
        vencimentoParcela,
        valorParcela: Math.round(valorParcela * 100) / 100,
        atualizadoEm: new Date().toISOString(),
        atualizadoPorUid: acesso.user.uid,
      },
      { merge: true },
    )
  revalidatePath('/dashboard/quitacoes')
  return { success: 'Dados do cliente salvos.' }
}

/** Marca (ou desmarca) o veículo como quitado com o banco. */
export async function definirQuitado(veiculoId: string, quitado: boolean): Promise<Resultado> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }
  if (!veiculoId || !(await veiculoExiste(veiculoId))) return { error: 'Veículo não encontrado.' }
  const hoje = new Date()
  const quitadoEm = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  await adminDb
    .collection(COL_FICHAS)
    .doc(veiculoId)
    .set(
      {
        quitado: quitado === true,
        quitadoEm: quitado ? quitadoEm : null,
        atualizadoEm: new Date().toISOString(),
        atualizadoPorUid: acesso.user.uid,
      },
      { merge: true },
    )
  revalidatePath('/dashboard/quitacoes')
  return { success: quitado ? 'Veículo marcado como quitado.' : 'Veículo voltou para não quitado.' }
}

export async function criarVeiculoTerceiro(input: VeiculoTerceiroInput): Promise<Resultado & { id?: string }> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }
  const marca = String(input.marca ?? '').trim()
  const modelo = String(input.modelo ?? '').trim()
  const ano = Number(input.ano)
  const placa = String(input.placa ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (!marca || !modelo) return { error: 'Informe a marca e o modelo.' }
  if (marca.length > 60 || modelo.length > 60) return { error: 'Marca ou modelo muito longo.' }
  if (!Number.isInteger(ano) || ano < 1950 || ano > new Date().getFullYear() + 1) return { error: 'Ano inválido.' }
  if (placa && placa.length !== 7) return { error: 'Placa inválida.' }
  const ref = await adminDb.collection(COL_TERCEIROS).add({
    marca,
    modelo,
    ano,
    placa: placa || null,
    criadoPorUid: acesso.user.uid,
    criadoEm: new Date().toISOString(),
  })
  revalidatePath('/dashboard/quitacoes')
  return { success: 'Veículo de terceiro cadastrado.', id: ref.id }
}

// ─── Contratos anexados (do cliente e de prestação de serviços) ─────────────
// Upload direto do navegador para o Storage (a Vercel limita o corpo a ~4,5MB):
//   1. iniciarUploadAnexoAction → valida e abre uma sessão resumível;
//   2. o navegador faz PUT do arquivo na URL;
//   3. concluirUploadAnexoAction → confere o arquivo e grava o documento.
// Um anexo de cada tipo por veículo; enviar de novo substitui o anterior.

const COL_ANEXOS = 'quitacao_anexos'
const ID_RE = /^[A-Za-z0-9_-]+$/

const tipoValido = (t: unknown): t is TipoAnexo => TIPOS_ANEXO.some((x) => x.id === t)
const anexoDocId = (veiculoId: string, tipo: TipoAnexo) => `${veiculoId}_${tipo}`
const anexoPath = (veiculoId: string, tipo: TipoAnexo, uploadId: string, ext: string) =>
  `quitacoes/${veiculoId}/${tipo}-${uploadId}.${ext}`

function anexoSerialize(d: FirebaseFirestore.DocumentData): AnexoQuitacao {
  return {
    veiculoId: String(d.veiculoId ?? ''),
    tipo: d.tipo as TipoAnexo,
    fileName: String(d.fileName ?? ''),
    size: Number(d.size) || 0,
    uploadedAt: String(d.uploadedAt ?? ''),
  }
}

export async function listarAnexos(): Promise<AnexosPorVeiculo> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return {}
  const snap = await adminDb.collection(COL_ANEXOS).get()
  const mapa: AnexosPorVeiculo = {}
  for (const d of snap.docs) {
    const a = anexoSerialize(d.data())
    if (!a.veiculoId || !tipoValido(a.tipo)) continue
    ;(mapa[a.veiculoId] ??= {})[a.tipo] = a
  }
  return mapa
}

export async function iniciarUploadAnexoAction(input: {
  veiculoId: string
  tipo: TipoAnexo
  fileName: string
  size: number
}): Promise<{ error: string } | { uploadId: string; uploadUrl: string; contentType: string }> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return acesso

  const veiculoId = String(input?.veiculoId ?? '')
  const fileName = String(input?.fileName ?? '')
  const ext = extensaoAnexo(fileName)
  const size = Number(input?.size)
  if (!ID_RE.test(veiculoId) || !tipoValido(input?.tipo)) return { error: 'Dados inválidos.' }
  if (!ext) return { error: 'Envie um PDF ou uma imagem (JPG, PNG ou WebP).' }
  if (!Number.isFinite(size) || size <= 0) return { error: 'Arquivo vazio.' }
  if (size > ANEXO_TAMANHO_MAX) return { error: 'Arquivo excede o limite de 10MB.' }
  if (!(await veiculoExiste(veiculoId))) return { error: 'Veículo não encontrado.' }

  try {
    const uploadId = adminDb.collection(COL_ANEXOS).doc().id
    const contentType = ANEXO_TIPOS[ext]
    const origin = (await headers()).get('origin') ?? undefined
    const [uploadUrl] = await adminStorage
      .bucket()
      .file(anexoPath(veiculoId, input.tipo, uploadId, ext))
      .createResumableUpload({
        origin,
        metadata: { contentType, metadata: { veiculoId, tipo: input.tipo, uploadedBy: acesso.user.uid } },
      })
    return { uploadId, uploadUrl, contentType }
  } catch (err) {
    console.error('[iniciarUploadAnexoAction]', err)
    return { error: 'Erro ao preparar o envio do contrato.' }
  }
}

export async function concluirUploadAnexoAction(input: {
  veiculoId: string
  tipo: TipoAnexo
  uploadId: string
  fileName: string
}): Promise<Resultado & { anexo?: AnexoQuitacao }> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return acesso

  const veiculoId = String(input?.veiculoId ?? '')
  const uploadId = String(input?.uploadId ?? '')
  const fileName = String(input?.fileName ?? '').slice(0, 200)
  const ext = extensaoAnexo(fileName)
  // Os ids viram caminho no Storage — nada de "/" ou "..".
  if (!ID_RE.test(veiculoId) || !/^[A-Za-z0-9]+$/.test(uploadId) || !tipoValido(input?.tipo) || !ext) {
    return { error: 'Dados inválidos.' }
  }

  const storagePath = anexoPath(veiculoId, input.tipo, uploadId, ext)
  const fileRef = adminStorage.bucket().file(storagePath)
  try {
    const [existe] = await fileRef.exists()
    if (!existe) return { error: 'O arquivo não chegou ao servidor. Tente de novo.' }

    // Metadados vêm da sessão aberta no passo 1 — o navegador não os altera.
    const [meta] = await fileRef.getMetadata()
    const size = Number(meta.size)
    if (meta.metadata?.uploadedBy !== acesso.user.uid) return { error: 'Acesso negado.' }
    if (!Number.isFinite(size) || size <= 0 || size > ANEXO_TAMANHO_MAX) {
      await fileRef.delete().catch(() => {})
      return { error: 'Arquivo excede o limite de 10MB.' }
    }

    const ref = adminDb.collection(COL_ANEXOS).doc(anexoDocId(veiculoId, input.tipo))
    const anterior = (await ref.get()).data()?.storagePath as string | undefined
    const dados = {
      veiculoId,
      tipo: input.tipo,
      fileName,
      contentType: ANEXO_TIPOS[ext],
      size,
      storagePath,
      uploadedByUid: acesso.user.uid,
      uploadedAt: new Date().toISOString(),
    }
    await ref.set(dados)
    if (anterior && anterior !== storagePath) {
      await adminStorage.bucket().file(anterior).delete().catch(() => {})
    }
    revalidatePath('/dashboard/quitacoes')
    return { success: 'Contrato anexado.', anexo: anexoSerialize(dados) }
  } catch (err) {
    console.error('[concluirUploadAnexoAction]', err)
    return { error: 'Erro ao salvar o contrato.' }
  }
}

export async function excluirAnexoAction(veiculoId: string, tipo: TipoAnexo): Promise<Resultado> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }
  if (!ID_RE.test(String(veiculoId ?? '')) || !tipoValido(tipo)) return { error: 'Dados inválidos.' }
  const ref = adminDb.collection(COL_ANEXOS).doc(anexoDocId(veiculoId, tipo))
  const doc = await ref.get()
  if (!doc.exists) return { error: 'Contrato não encontrado.' }
  const storagePath = doc.data()?.storagePath as string | undefined
  if (storagePath) await adminStorage.bucket().file(storagePath).delete().catch(() => {})
  await ref.delete()
  revalidatePath('/dashboard/quitacoes')
  return { success: 'Contrato removido.' }
}

/** Remove um veículo de terceiro junto com a ficha e o histórico de quitações dele. */
export async function excluirVeiculoTerceiro(id: string): Promise<Resultado> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }
  const ref = adminDb.collection(COL_TERCEIROS).doc(id)
  if (!(await ref.get()).exists) return { error: 'Veículo não encontrado.' }
  const historico = await adminDb.collection(COLECAO).where('veiculoId', '==', id).get()
  const batch = adminDb.batch()
  historico.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(adminDb.collection(COL_FICHAS).doc(id))
  for (const t of TIPOS_ANEXO) {
    const anexoRef = adminDb.collection(COL_ANEXOS).doc(anexoDocId(id, t.id))
    const storagePath = (await anexoRef.get()).data()?.storagePath as string | undefined
    if (storagePath) await adminStorage.bucket().file(storagePath).delete().catch(() => {})
    batch.delete(anexoRef)
  }
  batch.delete(ref)
  await batch.commit()
  revalidatePath('/dashboard/quitacoes')
  return { success: 'Veículo de terceiro removido.' }
}
