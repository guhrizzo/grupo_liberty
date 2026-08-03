'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb, adminStorage } from '@/utils/firebase/admin'
import { encrypt, decrypt } from '@/utils/crypto'

// ─── Types ───────────────────────────────────────────────────────────────────

export type LocalizacaoVeiculo = string

interface DebitoItemPersistido {
  chave: string
  valor: number
  label?: string
}

function parseDebitosItens(value: unknown): DebitoItemPersistido[] {
  if (!value) return []
  let raw: unknown = value
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(raw)) return []
  const out: DebitoItemPersistido[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const chave = String(obj.chave ?? '').trim()
    const valorNum =
      typeof obj.valor === 'number'
        ? obj.valor
        : obj.valor != null
          ? Number(obj.valor)
          : 0
    if (!chave) continue
    out.push({
      chave,
      valor: Number.isFinite(valorNum) && valorNum > 0 ? valorNum : 0,
      label: obj.label ? String(obj.label) : undefined,
    })
  }
  return out
}

export type DebitoItem = DebitoItemPersistido

/**
 * Descriptografa um CPF salvo. Registros gravados antes da criptografia
 * (texto plano, sem o separador ':' do formato 'ivHex:encryptedHex') caem no
 * fallback e retornam o valor bruto, para não quebrar veículos já cadastrados.
 */
function decryptCpfOrRaw(value: string | null | undefined): string {
  if (!value) return ''
  if (!value.includes(':')) return value
  return decrypt(value) || value
}

/**
 * Extrai o caminho do objeto dentro do bucket do Firebase Storage a partir de
 * uma URL pública. Cobre os dois formatos que o Firebase Storage gera
 * (`storage.googleapis.com/<bucket>/<path>` e `<bucket>.firebasestorage.app/<path>`).
 * Retorna `null` para URLs de outro provedor (ex.: Supabase, configurado em
 * next.config.ts mas sem suporte a exclusão aqui) — o chamador deve logar em
 * vez de ignorar a falha em silêncio.
 */
function extractFirebaseStoragePath(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'storage.googleapis.com') {
      const segments = parsed.pathname.replace(/^\//, '').split('/')
      segments.shift() // remove o nome do bucket
      const path = segments.join('/')
      return path || null
    }
    if (parsed.hostname.endsWith('.firebasestorage.app')) {
      const path = parsed.pathname.replace(/^\//, '')
      return path || null
    }
    return null
  } catch {
    return null
  }
}

export interface Veiculo {
  id: string
  marca: string
  modelo: string
  ano: number
  cor: string | null
  quilometragem: number | null
  preco: number | null
  precoComDesconto: number | null
  tabelaFipe: number | null
  cambio: string
  combustivel: string
  placa: string | null
  renavam: string | null
  descricao: string | null
  fotos: string[]
  localizacao: string
  /** Visível no site público. Controlado pelo toggle Público/Privado — todo veículo fica no mesmo estoque. */
  publico: boolean
  cpfCliente: string | null
  telefoneCliente: string | null
  telefoneAcessoria: string | null
  valorParcela: number | null
  custoAcumulado: number | null
  debitos: number | null
  /** Débitos detalhados por categoria. Calcula o total que aparece em `debitos`. */
  debitosItens?: Array<{ chave: string; valor: number; label?: string | null }> | null
  parcelasRestantes: number | null
  // Financiamento — projeção de quitação
  /** Banco do financiamento (texto livre). Mantido por compat com cadastros antigos. */
  banco: string | null
  /** Código curto do banco (santander/bradesco/itau/bv/caixa/c6/outro). Opcional. */
  bancoCodigo: string | null
  /** Percentual de quitação do banco (0-100). Vem da tabela de bancos. */
  quitacaoPercent: number | null
  /** Percentual de desconto do banco (0-100). Vem da tabela de bancos. */
  descontoPercent: number | null
  /** Lista de CNPJs do banco (copiada da tabela; user pode complementar). */
  bancoCnpjs: string[]
  /** Taxa de juros em % (não fração). */
  taxaJuros: number | null
  /** Em qual periodicidade a taxaJuros foi informada. */
  taxaPeriodicidade: 'mensal' | 'anual' | null
  /** Valor de entrada (R$). */
  valorEntrada: number | null
  // Dados do vendedor
  sellerName: string | null
  sellerCpf: string | null
  sellerBirthDate: string | null
  sellerCity: string | null
  isVehicleInSellersName: boolean | null
  registeredOwnerName: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export type VeiculoFieldErrors = {
  marca?: string
  modelo?: string
  ano?: string
  preco?: string
  precoComDesconto?: string
  tabelaFipe?: string
  placa?: string
  renavam?: string
  quilometragem?: string
  cpfCliente?: string
  telefoneCliente?: string
  telefoneAcessoria?: string
  valorParcela?: string
  custoAcumulado?: string
  debitos?: string
  parcelasRestantes?: string
  taxaJuros?: string
  valorEntrada?: string
}

export type VeiculoResponse = {
  success?: string
  error?: string
  fieldErrors?: VeiculoFieldErrors
  veiculo?: Veiculo
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getSessionUser() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) return null

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(session, true)
    return decodedClaims
  } catch (error) {
    return null
  }
}

async function assertAdmin() {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')

  const claims: any = user
  const isAdminByClaim = claims.admin === true || claims.role === 'admin'

  if (isAdminByClaim) return { user }

  const profileDoc = await adminDb.collection('profiles').doc(user.uid).get()
  const profile = profileDoc.data()

  if (!profileDoc.exists || profile?.role !== 'admin') {
    throw new Error('Acesso negado. Você precisa ser administrador para realizar esta ação.')
  }

  return { user }
}
// ─── Server Actions ──────────────────────────────────────────────────────────

/**
 * Busca todos os veículos cadastrados.
 */
export async function getVehicles(): Promise<Veiculo[]> {
  try {
    const snapshot = await adminDb.collection('veiculos')
      .orderBy('created_at', 'desc')
      .get()

    const vehicles: Veiculo[] = []
    snapshot.forEach((doc: any) => {
      const data = doc.data()
      const loc = data.localizacao
      const localizacao = loc === 'jau' ? 'Jaú/SP' : loc === 'bauru' ? 'Bauru/SP' : (loc || 'Jaú/SP')
      vehicles.push({
        id: doc.id,
        marca: data.marca,
        modelo: data.modelo,
        ano: data.ano,
        cor: data.cor || null,
        quilometragem: data.quilometragem || null,
        preco: data.preco ?? null,
        precoComDesconto: data.precoComDesconto ?? null,
        tabelaFipe: data.tabelaFipe ?? null,
        cambio: data.cambio,
        combustivel: data.combustivel,
        placa: data.placa || null,
        renavam: data.renavam || null,
        descricao: data.descricao || null,
        fotos: data.fotos || [],
        localizacao,
        // Migração: veículos salvos antes desse campo existir usam a antiga
        // 'finalidade' como fallback — 'venda' (ou ausente) permanece público,
        // 'pessoal' permanece privado, preservando a visibilidade que já tinham.
        publico:
          typeof data.publico === 'boolean' ? data.publico : data.finalidade !== 'pessoal',
        cpfCliente: decryptCpfOrRaw(data.cpfCliente) || null,
        telefoneCliente: data.telefoneCliente || null,
        telefoneAcessoria: data.telefoneAcessoria || null,
        valorParcela: data.valorParcela ?? null,
        custoAcumulado: data.custoAcumulado ?? null,
        debitos: data.debitos ?? null,
        debitosItens: Array.isArray(data.debitosItens)
          ? (data.debitosItens as Array<{
              chave: string
              valor: number
              label?: string
            }>)
          : null,
        parcelasRestantes: data.parcelasRestantes ?? null,
        banco: data.banco || null,
        bancoCodigo: data.bancoCodigo || null,
        quitacaoPercent:
          typeof data.quitacaoPercent === 'number' ? data.quitacaoPercent : null,
        descontoPercent:
          typeof data.descontoPercent === 'number' ? data.descontoPercent : null,
        bancoCnpjs: Array.isArray(data.bancoCnpjs) ? (data.bancoCnpjs as string[]) : [],
        taxaJuros: data.taxaJuros ?? null,
        taxaPeriodicidade:
          data.taxaPeriodicidade === 'anual' || data.taxaPeriodicidade === 'mensal'
            ? data.taxaPeriodicidade
            : null,
        valorEntrada: data.valorEntrada ?? null,
        sellerName: data.sellerName || null,
        sellerCpf: decryptCpfOrRaw(data.sellerCpf) || null,
        sellerBirthDate: data.sellerBirthDate || null,
        sellerCity: data.sellerCity || null,
        isVehicleInSellersName: data.isVehicleInSellersName ?? null,
        registeredOwnerName: data.registeredOwnerName || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        created_by: data.created_by || null,
      })
    })

    return vehicles
  } catch (error) {
    console.error('Erro ao buscar veículos:', error)
    return []
  }
}

/**
 * Faz upload das fotos para o Firebase Storage e retorna as URLs públicas.
 */
export async function uploadVehiclePhotos(formData: FormData): Promise<{ urls?: string[]; error?: string }> {
  try {
    await assertAdmin()
  } catch (err: any) {
    return { error: err.message }
  }

  const files = formData.getAll('photos') as File[]
  if (!files.length) return { urls: [] }

  const uploadedUrls: string[] = []
  const bucket = adminStorage.bucket()

  for (const file of files) {
    if (!file.size) continue

    // Gerar nome único baseado em timestamp + random
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`
    const filePath = `fotos/${fileName}`

    try {
      const fileRef = bucket.file(filePath)
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      await fileRef.save(buffer, {
        metadata: { contentType: file.type || 'image/jpeg' },
      })

      await fileRef.makePublic()
      uploadedUrls.push(fileRef.publicUrl())
    } catch (uploadError: any) {
      console.error('Erro no upload do Firebase:', uploadError)
      return { error: `Falha ao enviar foto "${file.name}": ${uploadError.message}` }
    }
  }

  return { urls: uploadedUrls }
}

/**
 * Cria um veículo no banco de dados.
 */
export async function createVehicle(formData: FormData): Promise<VeiculoResponse> {
  let user: any
  try {
    const res = await assertAdmin()
    user = res.user
  } catch (err: any) {
    return { error: err.message }
  }

  // Extrair campos
  const marca = ((formData.get('marca') as string) || '').trim()
  const modelo = ((formData.get('modelo') as string) || '').trim()
  const anoRaw = (formData.get('ano') as string) || ''
  const ano = parseInt(anoRaw, 10)
  const cor = ((formData.get('cor') as string) || '').trim() || null
  const quilometragemRaw = (formData.get('quilometragem') as string) || ''
  const quilometragem = quilometragemRaw ? parseInt(quilometragemRaw, 10) : null
  const precoRaw = (formData.get('preco') as string) || ''
  const preco = parseFloat(precoRaw)
  const precoComDescontoRaw = (formData.get('precoComDesconto') as string) || ''
  const precoComDescontoParsed = precoComDescontoRaw ? parseFloat(precoComDescontoRaw) : null
  const tabelaFipeRaw = (formData.get('tabelaFipe') as string) || ''
  const tabelaFipe = tabelaFipeRaw ? parseFloat(tabelaFipeRaw) : null
  const cambio = (formData.get('cambio') as string) || 'manual'
  const combustivel = (formData.get('combustivel') as string) || 'flex'
  const placa = ((formData.get('placa') as string) || '').trim().toUpperCase() || null
  const renavam = ((formData.get('renavam') as string) || '').trim() || null
  const descricao = ((formData.get('descricao') as string) || '').trim() || null
  const fotosJson = formData.get('fotos') as string
  const fotos: string[] = fotosJson ? JSON.parse(fotosJson) : []
  const localizacaoRaw = ((formData.get('localizacao') as string) || '').trim()
  const localizacao = localizacaoRaw === 'bauru' ? 'Bauru/SP' : localizacaoRaw === 'jau' ? 'Jaú/SP' : (localizacaoRaw || 'Jaú/SP')
  // Todo veículo fica no mesmo estoque; o toggle Público/Privado só controla
  // se ele aparece no site (padrão: público).
  const publicoRaw = formData.get('publico') as string | null
  const publico = publicoRaw !== 'false'

  // Campos opcionais de cliente / financiamento
  const cpfCliente = ((formData.get('cpfCliente') as string) || '').trim()
  const telefoneCliente = ((formData.get('telefoneCliente') as string) || '').trim()
  const telefoneAcessoria = ((formData.get('telefoneAcessoria') as string) || '').trim()
  const valorParcelaRaw = (formData.get('valorParcela') as string) || ''
  const valorParcela = valorParcelaRaw ? parseFloat(valorParcelaRaw) : null
  const custoAcumuladoRaw = (formData.get('custoAcumulado') as string) || ''
  const custoAcumulado = custoAcumuladoRaw ? parseFloat(custoAcumuladoRaw) : null
  const debitosItens = parseDebitosItens(formData.get('debitosItens'))
  const debitosCalculado = debitosItens.reduce((acc, i) => acc + i.valor, 0)
  const debitosRaw = (formData.get('debitos') as string) || ''
  const debitosManual = debitosRaw ? parseFloat(debitosRaw) : null
  const debitos =
    debitosItens.length > 0
      ? debitosCalculado
      : debitosManual !== null
        ? debitosManual
        : null
  const parcelasRestantesRaw = (formData.get('parcelasRestantes') as string) || ''
  const parcelasRestantes = parcelasRestantesRaw ? parseInt(parcelasRestantesRaw, 10) : null
  // Financiamento — projeção de quitação
  const bancoRaw = ((formData.get('banco') as string) || '').trim()
  const bancoCodigoRaw = ((formData.get('bancoCodigo') as string) || '').trim().toLowerCase()
  const bancoCodigo = bancoCodigoRaw || null
  const banco = bancoRaw || null
  const quitacaoPercentRaw = ((formData.get('quitacaoPercent') as string) || '').trim().replace(',', '.')
  const quitacaoPercent = quitacaoPercentRaw ? parseFloat(quitacaoPercentRaw) : null
  const descontoPercentRaw = ((formData.get('descontoPercent') as string) || '').trim().replace(',', '.')
  const descontoPercent = descontoPercentRaw ? parseFloat(descontoPercentRaw) : null
  const bancoCnpjsRaw = ((formData.get('bancoCnpjs') as string) || '').trim()
  const bancoCnpjs = bancoCnpjsRaw
    ? bancoCnpjsRaw
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  const taxaJurosRaw = (formData.get('taxaJuros') as string) || ''
  const taxaJuros = taxaJurosRaw ? parseFloat(taxaJurosRaw.replace(',', '.')) : null
  const taxaPeriodicidadeRaw = ((formData.get('taxaPeriodicidade') as string) || '').trim()
  const taxaPeriodicidade: 'mensal' | 'anual' | null =
    taxaPeriodicidadeRaw === 'anual'
      ? 'anual'
      : taxaPeriodicidadeRaw === 'mensal'
        ? 'mensal'
        : null
  const valorEntradaRaw = (formData.get('valorEntrada') as string) || ''
  const valorEntrada = valorEntradaRaw ? parseFloat(valorEntradaRaw) : null
  // Dados do vendedor
  const sellerName = ((formData.get('sellerName') as string) || '').trim() || null
  const sellerCpf = ((formData.get('sellerCpf') as string) || '').trim() || null
  const sellerBirthDate = ((formData.get('sellerBirthDate') as string) || '').trim() || null
  const sellerCity = ((formData.get('sellerCity') as string) || '').trim() || null
  const isVehicleInSellersNameRaw = formData.get('isVehicleInSellersName') as string | null
  const isVehicleInSellersName = isVehicleInSellersNameRaw === 'true' ? true : isVehicleInSellersNameRaw === 'false' ? false : null
  const registeredOwnerName = ((formData.get('registeredOwnerName') as string) || '').trim() || null

  // Validações por campo.
  const fieldErrors: VeiculoFieldErrors = {}
  if (!marca) fieldErrors.marca = 'Informe a marca.'
  if (!modelo) fieldErrors.modelo = 'Informe o modelo.'

  if (!anoRaw) {
    fieldErrors.ano = 'Informe o ano.'
  } else if (Number.isNaN(ano) || ano < 1900 || ano > new Date().getFullYear() + 1) {
    fieldErrors.ano = `Ano deve estar entre 1900 e ${new Date().getFullYear() + 1}.`
  }

  if (precoRaw && (Number.isNaN(preco) || preco <= 0)) {
    fieldErrors.preco = 'Valor da venda inválido.'
  }

  if (precoComDescontoRaw) {
    if (precoComDescontoParsed === null || Number.isNaN(precoComDescontoParsed) || precoComDescontoParsed <= 0) {
      fieldErrors.precoComDesconto = 'Preço com desconto inválido.'
    } else if (preco == null || Number.isNaN(preco)) {
      fieldErrors.precoComDesconto = 'Informe o valor de venda para definir um desconto.'
    } else if (precoComDescontoParsed >= preco) {
      fieldErrors.precoComDesconto = 'O preço com desconto deve ser menor que o valor de venda.'
    }
  }

  if (quilometragem !== null && (Number.isNaN(quilometragem) || quilometragem < 0)) {
    fieldErrors.quilometragem = 'Quilometragem inválida.'
  }

  if (placa && !/^[A-Z]{3}-?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/.test(placa)) {
    fieldErrors.placa = 'Placa inválida. Use o formato ABC-1234 ou ABC1D23.'
  }

  if (renavam && !/^\d{9,11}$/.test(renavam.replace(/\D/g, ''))) {
    fieldErrors.renavam = 'Renavam inválido.'
  }

  if (cpfCliente && cpfCliente.replace(/\D/g, '').length < 11) {
    fieldErrors.cpfCliente = 'CPF incompleto.'
  }

  if (telefoneCliente && telefoneCliente.replace(/\D/g, '').length < 10) {
    fieldErrors.telefoneCliente = 'Telefone incompleto.'
  }

  if (telefoneAcessoria && telefoneAcessoria.replace(/\D/g, '').length < 10) {
    fieldErrors.telefoneAcessoria = 'Telefone da acessória incompleto.'
  }

  if (valorParcela !== null && (Number.isNaN(valorParcela) || valorParcela < 0)) {
    fieldErrors.valorParcela = 'Valor da parcela inválido.'
  }
  if (custoAcumulado !== null && (Number.isNaN(custoAcumulado) || custoAcumulado < 0)) {
    fieldErrors.custoAcumulado = 'Custo acumulado inválido.'
  }
  if (debitos !== null && (Number.isNaN(debitos) || debitos < 0)) {
    fieldErrors.debitos = 'Débitos inválido.'
  }
  if (parcelasRestantes !== null && (Number.isNaN(parcelasRestantes) || parcelasRestantes < 0)) {
    fieldErrors.parcelasRestantes = 'Parcelas inválidas.'
  }

  if (taxaJuros !== null && (Number.isNaN(taxaJuros) || taxaJuros < 0 || taxaJuros > 50)) {
    fieldErrors.taxaJuros = 'Taxa de juros inválida (0 a 50%).'
  }
  if (valorEntrada !== null && (Number.isNaN(valorEntrada) || valorEntrada < 0)) {
    fieldErrors.valorEntrada = 'Entrada inválida.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Verifique os campos destacados.', fieldErrors }
  }

  // Sem preço informado, armazena como null (fica no estoque sem valor exibido).
  const precoFinal: number | null = precoRaw ? preco : null

  try {
    const docRef = adminDb.collection('veiculos').doc()
    const now = new Date().toISOString()

    const novoVeiculo = {
      marca,
      modelo,
      ano,
      cor,
      quilometragem,
      preco: precoFinal,
      precoComDesconto: precoComDescontoRaw ? precoComDescontoParsed : null,
      tabelaFipe,
      cambio,
      combustivel,
      placa,
      renavam,
      descricao,
      fotos,
      localizacao,
      publico,
      cpfCliente: cpfCliente ? encrypt(cpfCliente) : null,
      telefoneCliente: telefoneCliente || null,
      telefoneAcessoria: telefoneAcessoria || null,
      valorParcela,
      custoAcumulado,
      debitos,
      debitosItens,
      parcelasRestantes,
      banco,
      bancoCodigo,
      quitacaoPercent,
      descontoPercent,
      bancoCnpjs,
      taxaJuros,
      taxaPeriodicidade,
      valorEntrada,
      sellerName,
      sellerCpf: sellerCpf ? encrypt(sellerCpf) : null,
      sellerBirthDate,
      sellerCity,
      isVehicleInSellersName,
      registeredOwnerName,
      created_by: user.uid,
      created_at: now,
      updated_at: now,
    }

    await docRef.set(novoVeiculo)

    revalidatePath('/dashboard/veiculos')
    return {
      success: 'Veículo cadastrado com sucesso!',
      veiculo: { id: docRef.id, ...novoVeiculo }
    }
  } catch (error: any) {
    return { error: `Erro ao cadastrar veículo: ${error.message}` }
  }
}

/**
 * Remove um veículo e suas fotos do Storage.
 */
export async function deleteVehicle(id: string): Promise<{ success?: string; error?: string }> {
  try {
    await assertAdmin()
  } catch (err: any) {
    return { error: err.message }
  }

  try {
    // 1. Buscar veículo para pegar as fotos
    const docRef = adminDb.collection('veiculos').doc(id)
    const doc = await docRef.get()
    
    if (!doc.exists) {
      return { error: 'Veículo não encontrado.' }
    }

    const veiculo = doc.data()
    const bucket = adminStorage.bucket()

    // 2. Remover fotos do Storage
    if (veiculo?.fotos?.length) {
      for (const url of veiculo.fotos) {
        const filePath = extractFirebaseStoragePath(url)
        if (!filePath) {
          console.warn(`Foto com URL de provedor não suportado para exclusão automática: ${url}`)
          continue
        }
        try {
          await bucket.file(filePath).delete()
        } catch (deleteFileErr) {
          console.error(`Erro ao deletar arquivo ${filePath} do Firebase Storage:`, deleteFileErr)
        }
      }
    }

    // 2.5 Remover contratos anexados (PDFs) e seus arquivos no Storage
    const contratosSnap = await adminDb
      .collection('veiculo_contratos')
      .where('veiculoId', '==', id)
      .get()

    if (!contratosSnap.empty) {
      const batch = adminDb.batch()
      for (const cDoc of contratosSnap.docs) {
        const cData = cDoc.data() as { storagePath?: string }
        if (cData.storagePath) {
          try {
            await bucket.file(cData.storagePath).delete()
          } catch (storageErr) {
            console.error(
              `Erro ao deletar contrato ${cDoc.id} do Storage:`,
              storageErr,
            )
          }
        }
        batch.delete(cDoc.ref)
      }
      await batch.commit()
    }

    // 3. Deletar do banco
    await docRef.delete()

    revalidatePath('/dashboard/veiculos')
    return { success: 'Veículo removido com sucesso!' }
  } catch (error: any) {
    return { error: `Erro ao deletar veículo: ${error.message}` }
  }
}

/**
 * Atualiza um veículo existente no banco de dados.
 */
export async function updateVehicle(id: string, formData: FormData): Promise<VeiculoResponse> {
  try {
    await assertAdmin()
  } catch (err: any) {
    return { error: err.message }
  }

  // Extrair campos
  const marca = ((formData.get('marca') as string) || '').trim()
  const modelo = ((formData.get('modelo') as string) || '').trim()
  const anoRaw = (formData.get('ano') as string) || ''
  const ano = parseInt(anoRaw, 10)
  const cor = ((formData.get('cor') as string) || '').trim() || null
  const quilometragemRaw = (formData.get('quilometragem') as string) || ''
  const quilometragem = quilometragemRaw ? parseInt(quilometragemRaw, 10) : null
  const precoRaw = (formData.get('preco') as string) || ''
  const preco = parseFloat(precoRaw)
  const precoComDescontoRaw = (formData.get('precoComDesconto') as string) || ''
  const precoComDescontoParsed = precoComDescontoRaw ? parseFloat(precoComDescontoRaw) : null
  const tabelaFipeRaw = (formData.get('tabelaFipe') as string) || ''
  const tabelaFipe = tabelaFipeRaw ? parseFloat(tabelaFipeRaw) : null
  const cambio = (formData.get('cambio') as string) || 'manual'
  const combustivel = (formData.get('combustivel') as string) || 'flex'
  const placa = ((formData.get('placa') as string) || '').trim().toUpperCase() || null
  const renavam = ((formData.get('renavam') as string) || '').trim() || null
  const descricao = ((formData.get('descricao') as string) || '').trim() || null
  const fotosJson = formData.get('fotos') as string
  const fotosFinal: string[] = fotosJson ? JSON.parse(fotosJson) : []
  const localizacaoRaw = ((formData.get('localizacao') as string) || '').trim()
  const localizacao = localizacaoRaw === 'bauru' ? 'Bauru/SP' : localizacaoRaw === 'jau' ? 'Jaú/SP' : (localizacaoRaw || 'Jaú/SP')
  // Todo veículo fica no mesmo estoque; o toggle Público/Privado só controla
  // se ele aparece no site (padrão: público).
  const publicoRaw = formData.get('publico') as string | null
  const publico = publicoRaw !== 'false'

  // Campos opcionais de cliente / financiamento
  const cpfCliente = ((formData.get('cpfCliente') as string) || '').trim()
  const telefoneCliente = ((formData.get('telefoneCliente') as string) || '').trim()
  const telefoneAcessoria = ((formData.get('telefoneAcessoria') as string) || '').trim()
  const valorParcelaRaw = (formData.get('valorParcela') as string) || ''
  const valorParcela = valorParcelaRaw ? parseFloat(valorParcelaRaw) : null
  const custoAcumuladoRaw = (formData.get('custoAcumulado') as string) || ''
  const custoAcumulado = custoAcumuladoRaw ? parseFloat(custoAcumuladoRaw) : null
  const debitosItens = parseDebitosItens(formData.get('debitosItens'))
  const debitosCalculado = debitosItens.reduce((acc, i) => acc + i.valor, 0)
  const debitosRaw = (formData.get('debitos') as string) || ''
  const debitosManual = debitosRaw ? parseFloat(debitosRaw) : null
  const debitos =
    debitosItens.length > 0
      ? debitosCalculado
      : debitosManual !== null
        ? debitosManual
        : null
  const parcelasRestantesRaw = (formData.get('parcelasRestantes') as string) || ''
  const parcelasRestantes = parcelasRestantesRaw ? parseInt(parcelasRestantesRaw, 10) : null
  // Financiamento — projeção de quitação
  const bancoRaw = ((formData.get('banco') as string) || '').trim()
  const bancoCodigoRaw = ((formData.get('bancoCodigo') as string) || '').trim().toLowerCase()
  const bancoCodigo = bancoCodigoRaw || null
  const banco = bancoRaw || null
  const quitacaoPercentRaw = ((formData.get('quitacaoPercent') as string) || '').trim().replace(',', '.')
  const quitacaoPercent = quitacaoPercentRaw ? parseFloat(quitacaoPercentRaw) : null
  const descontoPercentRaw = ((formData.get('descontoPercent') as string) || '').trim().replace(',', '.')
  const descontoPercent = descontoPercentRaw ? parseFloat(descontoPercentRaw) : null
  const bancoCnpjsRaw = ((formData.get('bancoCnpjs') as string) || '').trim()
  const bancoCnpjs = bancoCnpjsRaw
    ? bancoCnpjsRaw
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  const taxaJurosRaw = (formData.get('taxaJuros') as string) || ''
  const taxaJuros = taxaJurosRaw ? parseFloat(taxaJurosRaw.replace(',', '.')) : null
  const taxaPeriodicidadeRaw = ((formData.get('taxaPeriodicidade') as string) || '').trim()
  const taxaPeriodicidade: 'mensal' | 'anual' | null =
    taxaPeriodicidadeRaw === 'anual'
      ? 'anual'
      : taxaPeriodicidadeRaw === 'mensal'
        ? 'mensal'
        : null
  const valorEntradaRaw = (formData.get('valorEntrada') as string) || ''
  const valorEntrada = valorEntradaRaw ? parseFloat(valorEntradaRaw) : null
  // Dados do vendedor
  const sellerName = ((formData.get('sellerName') as string) || '').trim() || null
  const sellerCpf = ((formData.get('sellerCpf') as string) || '').trim() || null
  const sellerBirthDate = ((formData.get('sellerBirthDate') as string) || '').trim() || null
  const sellerCity = ((formData.get('sellerCity') as string) || '').trim() || null
  const isVehicleInSellersNameRaw = formData.get('isVehicleInSellersName') as string | null
  const isVehicleInSellersName = isVehicleInSellersNameRaw === 'true' ? true : isVehicleInSellersNameRaw === 'false' ? false : null
  const registeredOwnerName = ((formData.get('registeredOwnerName') as string) || '').trim() || null

  // Validações
  const fieldErrors: VeiculoFieldErrors = {}
  if (!marca) fieldErrors.marca = 'Informe a marca.'
  if (!modelo) fieldErrors.modelo = 'Informe o modelo.'

  if (!anoRaw) {
    fieldErrors.ano = 'Informe o ano.'
  } else if (Number.isNaN(ano) || ano < 1900 || ano > new Date().getFullYear() + 1) {
    fieldErrors.ano = `Ano deve estar entre 1900 e ${new Date().getFullYear() + 1}.`
  }

  if (precoRaw && (Number.isNaN(preco) || preco <= 0)) {
    fieldErrors.preco = 'Valor da venda inválido.'
  }

  if (precoComDescontoRaw) {
    if (precoComDescontoParsed === null || Number.isNaN(precoComDescontoParsed) || precoComDescontoParsed <= 0) {
      fieldErrors.precoComDesconto = 'Preço com desconto inválido.'
    } else if (preco == null || Number.isNaN(preco)) {
      fieldErrors.precoComDesconto = 'Informe o valor de venda para definir um desconto.'
    } else if (precoComDescontoParsed >= preco) {
      fieldErrors.precoComDesconto = 'O preço com desconto deve ser menor que o valor de venda.'
    }
  }

  if (quilometragem !== null && (Number.isNaN(quilometragem) || quilometragem < 0)) {
    fieldErrors.quilometragem = 'Quilometragem inválida.'
  }

  if (placa && !/^[A-Z]{3}-?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/.test(placa)) {
    fieldErrors.placa = 'Placa inválida.'
  }

  if (renavam && !/^\d{9,11}$/.test(renavam.replace(/\D/g, ''))) {
    fieldErrors.renavam = 'Renavam inválido.'
  }

  if (cpfCliente && cpfCliente.replace(/\D/g, '').length < 11) {
    fieldErrors.cpfCliente = 'CPF incompleto.'
  }

  if (telefoneCliente && telefoneCliente.replace(/\D/g, '').length < 10) {
    fieldErrors.telefoneCliente = 'Telefone incompleto.'
  }

  if (telefoneAcessoria && telefoneAcessoria.replace(/\D/g, '').length < 10) {
    fieldErrors.telefoneAcessoria = 'Telefone da acessória incompleto.'
  }

  if (valorParcela !== null && (Number.isNaN(valorParcela) || valorParcela < 0)) {
    fieldErrors.valorParcela = 'Valor da parcela inválido.'
  }
  if (custoAcumulado !== null && (Number.isNaN(custoAcumulado) || custoAcumulado < 0)) {
    fieldErrors.custoAcumulado = 'Custo acumulado inválido.'
  }
  if (debitos !== null && (Number.isNaN(debitos) || debitos < 0)) {
    fieldErrors.debitos = 'Débitos inválido.'
  }
  if (parcelasRestantes !== null && (Number.isNaN(parcelasRestantes) || parcelasRestantes < 0)) {
    fieldErrors.parcelasRestantes = 'Parcelas inválidas.'
  }

  if (taxaJuros !== null && (Number.isNaN(taxaJuros) || taxaJuros < 0 || taxaJuros > 50)) {
    fieldErrors.taxaJuros = 'Taxa de juros inválida (0 a 50%).'
  }
  if (valorEntrada !== null && (Number.isNaN(valorEntrada) || valorEntrada < 0)) {
    fieldErrors.valorEntrada = 'Entrada inválida.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Verifique os campos destacados.', fieldErrors }
  }

  // Sem preço informado, armazena como null (fica no estoque sem valor exibido).
  const precoFinal: number | null = precoRaw ? preco : null

  try {
    const docRef = adminDb.collection('veiculos').doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
      return { error: 'Veículo não encontrado.' }
    }

    const veiculoAntigo = doc.data()
    const bucket = adminStorage.bucket()

    // Apagar fotos removidas do Storage
    if (veiculoAntigo?.fotos?.length) {
      for (const url of veiculoAntigo.fotos) {
        if (fotosFinal.includes(url)) continue
        const filePath = extractFirebaseStoragePath(url)
        if (!filePath) {
          console.warn(`Foto com URL de provedor não suportado para exclusão automática: ${url}`)
          continue
        }
        try {
          await bucket.file(filePath).delete()
        } catch (err) {
          console.error(`Erro ao deletar arquivo removido ${filePath}:`, err)
        }
      }
    }

    const now = new Date().toISOString()
    const atualizacao = {
      marca,
      modelo,
      ano,
      cor,
      quilometragem,
      preco: precoFinal,
      precoComDesconto: precoComDescontoRaw ? precoComDescontoParsed : null,
      tabelaFipe,
      cambio,
      combustivel,
      placa,
      renavam,
      descricao,
      fotos: fotosFinal,
      localizacao,
      publico,
      cpfCliente: cpfCliente ? encrypt(cpfCliente) : null,
      telefoneCliente: telefoneCliente || null,
      telefoneAcessoria: telefoneAcessoria || null,
      valorParcela,
      custoAcumulado,
      debitos,
      debitosItens,
      parcelasRestantes,
      banco,
      bancoCodigo,
      quitacaoPercent,
      descontoPercent,
      bancoCnpjs,
      taxaJuros,
      taxaPeriodicidade,
      valorEntrada,
      sellerName,
      sellerCpf: sellerCpf ? encrypt(sellerCpf) : null,
      sellerBirthDate,
      sellerCity,
      isVehicleInSellersName,
      registeredOwnerName,
      updated_at: now,
    }

    await docRef.update(atualizacao)

    revalidatePath('/dashboard/veiculos')
    return {
      success: 'Veículo atualizado com sucesso!',
      veiculo: { id, ...veiculoAntigo, ...atualizacao } as Veiculo
    }
  } catch (error: any) {
    return { error: `Erro ao atualizar veículo: ${error.message}` }
  }
}

