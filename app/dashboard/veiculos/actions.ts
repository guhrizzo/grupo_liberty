'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb, adminStorage } from '@/utils/firebase/admin'

// ─── Types ───────────────────────────────────────────────────────────────────

export type LocalizacaoVeiculo = 'jau' | 'bauru'

export interface Veiculo {
  id: string
  marca: string
  modelo: string
  ano: number
  cor: string | null
  quilometragem: number | null
  preco: number
  cambio: string
  combustivel: string
  placa: string | null
  renavam: string | null
  descricao: string | null
  fotos: string[]
  localizacao: LocalizacaoVeiculo
  cpfCliente: string | null
  telefoneCliente: string | null
  telefoneAcessoria: string | null
  valorParcela: number | null
  custoAcumulado: number | null
  debitos: number | null
  parcelasRestantes: number | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export type VeiculoFieldErrors = {
  marca?: string
  modelo?: string
  ano?: string
  preco?: string
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
      vehicles.push({
        id: doc.id,
        marca: data.marca,
        modelo: data.modelo,
        ano: data.ano,
        cor: data.cor || null,
        quilometragem: data.quilometragem || null,
        preco: data.preco,
        cambio: data.cambio,
        combustivel: data.combustivel,
        placa: data.placa || null,
        renavam: data.renavam || null,
        descricao: data.descricao || null,
        fotos: data.fotos || [],
        localizacao: data.localizacao === 'bauru' ? 'bauru' : 'jau',
        cpfCliente: data.cpfCliente || null,
        telefoneCliente: data.telefoneCliente || null,
        telefoneAcessoria: data.telefoneAcessoria || null,
        valorParcela: data.valorParcela ?? null,
        custoAcumulado: data.custoAcumulado ?? null,
        debitos: data.debitos ?? null,
        parcelasRestantes: data.parcelasRestantes ?? null,
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
  const cambio = (formData.get('cambio') as string) || 'manual'
  const combustivel = (formData.get('combustivel') as string) || 'flex'
  const placa = ((formData.get('placa') as string) || '').trim().toUpperCase() || null
  const renavam = ((formData.get('renavam') as string) || '').trim() || null
  const descricao = ((formData.get('descricao') as string) || '').trim() || null
  const fotosJson = formData.get('fotos') as string
  const fotos: string[] = fotosJson ? JSON.parse(fotosJson) : []
  const localizacaoRaw = formData.get('localizacao') as string
  const localizacao: LocalizacaoVeiculo = localizacaoRaw === 'bauru' ? 'bauru' : 'jau'

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
    fieldErrors.preco = 'Informe o preço.'
  } else if (Number.isNaN(preco) || preco <= 0) {
    fieldErrors.preco = 'Preço inválido.'
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

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Verifique os campos destacados.', fieldErrors }
  }

  try {
    const docRef = adminDb.collection('veiculos').doc()
    const now = new Date().toISOString()

    const novoVeiculo = {
      marca,
      modelo,
      ano,
      cor,
      quilometragem,
      preco,
      cambio,
      combustivel,
      placa,
      renavam,
      descricao,
      fotos,
      localizacao,
      cpfCliente: cpfCliente || null,
      telefoneCliente: telefoneCliente || null,
      telefoneAcessoria: telefoneAcessoria || null,
      valorParcela,
      custoAcumulado,
      debitos,
      parcelasRestantes,
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

    // 3. Deletar do banco
    await docRef.delete()

    revalidatePath('/dashboard/veiculos')
    return { success: 'Veículo removido com sucesso!' }
  } catch (error: any) {
    return { error: `Erro ao deletar veículo: ${error.message}` }
  }
}
