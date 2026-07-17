'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb, adminStorage } from '@/utils/firebase/admin'

// ─── Types ───────────────────────────────────────────────────────────────────

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
  descricao: string | null
  fotos: string[]
  created_at: string
  updated_at: string
  created_by: string | null
}

export type VeiculoResponse = {
  success?: string
  error?: string
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
        descricao: data.descricao || null,
        fotos: data.fotos || [],
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
  const marca = formData.get('marca') as string
  const modelo = formData.get('modelo') as string
  const ano = parseInt(formData.get('ano') as string, 10)
  const cor = (formData.get('cor') as string) || null
  const quilometragem = formData.get('quilometragem')
    ? parseInt(formData.get('quilometragem') as string, 10)
    : null
  const preco = parseFloat(formData.get('preco') as string)
  const cambio = (formData.get('cambio') as string) || 'manual'
  const combustivel = (formData.get('combustivel') as string) || 'flex'
  const placa = (formData.get('placa') as string) || null
  const descricao = (formData.get('descricao') as string) || null
  const fotosJson = formData.get('fotos') as string
  const fotos: string[] = fotosJson ? JSON.parse(fotosJson) : []

  // Validações básicas
  if (!marca || !modelo || !ano || !preco) {
    return { error: 'Preencha os campos obrigatórios: Marca, Modelo, Ano e Preço.' }
  }

  if (isNaN(ano) || ano < 1900 || ano > new Date().getFullYear() + 1) {
    return { error: 'Ano inválido.' }
  }

  if (isNaN(preco) || preco <= 0) {
    return { error: 'Preço inválido.' }
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
      descricao,
      fotos,
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
