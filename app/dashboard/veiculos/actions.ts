'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb, adminStorage } from '@/utils/firebase/admin'

// ─── Types ───────────────────────────────────────────────────────────────────

export type LocalizacaoVeiculo = string

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
  finalidade: 'venda' | 'pessoal'
  cpfCliente: string | null
  telefoneCliente: string | null
  telefoneAcessoria: string | null
  valorParcela: number | null
  custoAcumulado: number | null
  debitos: number | null
  parcelasRestantes: number | null
  // Financiamento — projeção de quitação
  /** Banco do financiamento (texto livre). Mantido por compat com cadastros antigos. */
  banco: string | null
  /** Código curto do banco (santander/bradesco/itau/bv/caixa/c6/outro). Opcional. */
  bancoCodigo: string | null
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
        finalidade: data.finalidade === 'pessoal' ? 'pessoal' : 'venda',
        cpfCliente: data.cpfCliente || null,
        telefoneCliente: data.telefoneCliente || null,
        telefoneAcessoria: data.telefoneAcessoria || null,
        valorParcela: data.valorParcela ?? null,
        custoAcumulado: data.custoAcumulado ?? null,
        debitos: data.debitos ?? null,
        parcelasRestantes: data.parcelasRestantes ?? null,
        banco: data.banco || null,
        bancoCodigo: data.bancoCodigo || null,
        taxaJuros: data.taxaJuros ?? null,
        taxaPeriodicidade:
          data.taxaPeriodicidade === 'anual' || data.taxaPeriodicidade === 'mensal'
            ? data.taxaPeriodicidade
            : null,
        valorEntrada: data.valorEntrada ?? null,
        sellerName: data.sellerName || null,
        sellerCpf: data.sellerCpf || null,
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
  const finalidadeRaw = formData.get('finalidade') as string
  const finalidade: 'venda' | 'pessoal' = finalidadeRaw === 'pessoal' ? 'pessoal' : 'venda'

  // Campos opcionais de cliente / financiamento
  const cpfCliente = ((formData.get('cpfCliente') as string) || '').trim()
  const telefoneCliente = ((formData.get('telefoneCliente') as string) || '').trim()
  const telefoneAcessoria = ((formData.get('telefoneAcessoria') as string) || '').trim()
  const valorParcelaRaw = (formData.get('valorParcela') as string) || ''
  const valorParcela = valorParcelaRaw ? parseFloat(valorParcelaRaw) : null
  const custoAcumuladoRaw = (formData.get('custoAcumulado') as string) || ''
  const custoAcumulado = custoAcumuladoRaw ? parseFloat(custoAcumuladoRaw) : null
  const debitosRaw = (formData.get('debitos') as string) || ''
  const debitos = debitosRaw ? parseFloat(debitosRaw) : null
  const parcelasRestantesRaw = (formData.get('parcelasRestantes') as string) || ''
  const parcelasRestantes = parcelasRestantesRaw ? parseInt(parcelasRestantesRaw, 10) : null
  // Financiamento — projeção de quitação
  const bancoRaw = ((formData.get('banco') as string) || '').trim()
  const bancoCodigoRaw = ((formData.get('bancoCodigo') as string) || '').trim().toLowerCase()
  const bancoCodigo = bancoCodigoRaw || null
  const banco = bancoRaw || null
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

  if (!precoRaw) {
    if (finalidade === 'venda') {
      fieldErrors.preco = 'Informe o valor da venda.'
    }
  } else if (Number.isNaN(preco) || preco <= 0) {
    fieldErrors.preco = 'Valor da venda inválido.'
  }

  if (precoComDescontoRaw) {
    if (finalidade !== 'venda') {
      fieldErrors.precoComDesconto = 'Desconto disponível apenas para veículos à venda.'
    } else if (precoComDescontoParsed === null || Number.isNaN(precoComDescontoParsed) || precoComDescontoParsed <= 0) {
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

  // Para veículos pessoais sem preço informado, armazena como null.
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
      finalidade,
      cpfCliente: cpfCliente || null,
      telefoneCliente: telefoneCliente || null,
      telefoneAcessoria: telefoneAcessoria || null,
      valorParcela,
      custoAcumulado,
      debitos,
      parcelasRestantes,
      banco,
      bancoCodigo,
      taxaJuros,
      taxaPeriodicidade,
      valorEntrada,
      sellerName,
      sellerCpf,
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
        const parts = url.split('storage.googleapis.com/')
        if (parts[1]) {
          const subParts = parts[1].split('/')
          subParts.shift() // remover nome do bucket
          const filePath = subParts.join('/')
          try {
            await bucket.file(filePath).delete()
          } catch (deleteFileErr) {
            console.error(`Erro ao deletar arquivo ${filePath} do Firebase Storage:`, deleteFileErr)
          }
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
 * Alterna a finalidade de um veículo entre 'venda' e 'pessoal'.
 * Ao mover para 'pessoal', descarta qualquer 'precoComDesconto' (desconto
 * da vitrine) para evitar lixo. Ao mover para 'venda', não toca em
 * 'precoComDesconto' (que deve estar null).
 */
export async function toggleVehicleFinalidade(
  id: string,
  finalidade: 'venda' | 'pessoal',
): Promise<{ success?: string; error?: string }> {
  try {
    await assertAdmin()
  } catch (err: any) {
    return { error: err.message }
  }

  if (!id || !['venda', 'pessoal'].includes(finalidade)) {
    return { error: 'Parâmetros inválidos.' }
  }

  try {
    const docRef = adminDb.collection('veiculos').doc(id)
    const doc = await docRef.get()
    if (!doc.exists) {
      return { error: 'Veículo não encontrado.' }
    }

    const now = new Date().toISOString()

    const update: Record<string, unknown> = {
      finalidade,
      updated_at: now,
    }
    if (finalidade === 'pessoal') {
      update.precoComDesconto = null
    }

    await docRef.update(update)

    revalidatePath('/dashboard/veiculos')
    return {
      success:
        finalidade === 'venda'
          ? 'Veículo movido para Venda.'
          : 'Veículo movido para Pessoal.',
    }
  } catch (error: any) {
    return { error: `Erro ao atualizar finalidade: ${error.message}` }
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
  const finalidadeRaw = formData.get('finalidade') as string
  const finalidade: 'venda' | 'pessoal' = finalidadeRaw === 'pessoal' ? 'pessoal' : 'venda'

  // Campos opcionais de cliente / financiamento
  const cpfCliente = ((formData.get('cpfCliente') as string) || '').trim()
  const telefoneCliente = ((formData.get('telefoneCliente') as string) || '').trim()
  const telefoneAcessoria = ((formData.get('telefoneAcessoria') as string) || '').trim()
  const valorParcelaRaw = (formData.get('valorParcela') as string) || ''
  const valorParcela = valorParcelaRaw ? parseFloat(valorParcelaRaw) : null
  const custoAcumuladoRaw = (formData.get('custoAcumulado') as string) || ''
  const custoAcumulado = custoAcumuladoRaw ? parseFloat(custoAcumuladoRaw) : null
  const debitosRaw = (formData.get('debitos') as string) || ''
  const debitos = debitosRaw ? parseFloat(debitosRaw) : null
  const parcelasRestantesRaw = (formData.get('parcelasRestantes') as string) || ''
  const parcelasRestantes = parcelasRestantesRaw ? parseInt(parcelasRestantesRaw, 10) : null
  // Financiamento — projeção de quitação
  const bancoRaw = ((formData.get('banco') as string) || '').trim()
  const bancoCodigoRaw = ((formData.get('bancoCodigo') as string) || '').trim().toLowerCase()
  const bancoCodigo = bancoCodigoRaw || null
  const banco = bancoRaw || null
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

  if (!precoRaw) {
    if (finalidade === 'venda') {
      fieldErrors.preco = 'Informe o valor da venda.'
    }
  } else if (Number.isNaN(preco) || preco <= 0) {
    fieldErrors.preco = 'Valor da venda inválido.'
  }

  if (precoComDescontoRaw) {
    if (finalidade !== 'venda') {
      fieldErrors.precoComDesconto = 'Desconto disponível apenas para veículos à venda.'
    } else if (precoComDescontoParsed === null || Number.isNaN(precoComDescontoParsed) || precoComDescontoParsed <= 0) {
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

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Verifique os campos destacados.', fieldErrors }
  }

  // Para veículos pessoais sem preço informado, armazena como null.
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
        if (!fotosFinal.includes(url)) {
          const parts = url.split('storage.googleapis.com/')
          if (parts[1]) {
            const subParts = parts[1].split('/')
            subParts.shift()
            const filePath = subParts.join('/')
            try {
              await bucket.file(filePath).delete()
            } catch (err) {
              console.error(`Erro ao deletar arquivo removido ${filePath}:`, err)
            }
          }
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
      finalidade,
      cpfCliente: cpfCliente || null,
      telefoneCliente: telefoneCliente || null,
      telefoneAcessoria: telefoneAcessoria || null,
      valorParcela,
      custoAcumulado,
      debitos,
      parcelasRestantes,
      banco,
      bancoCodigo,
      taxaJuros,
      taxaPeriodicidade,
      valorEntrada,
      sellerName,
      sellerCpf,
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

