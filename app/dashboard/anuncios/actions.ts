'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { adminDb, adminStorage } from '@/utils/firebase/admin'
import { assertPodeVerAnuncios } from '@/utils/permissions'
import { decrypt, encrypt } from '@/utils/crypto'
import { maskCPFCNPJ } from '@/utils/masks'
import { sendAnuncioStatusEmail } from '@/utils/email/send-anuncio-email'
import {
  type Anuncio,
  type AnuncioStatus,
  type RevisaoVeiculo,
  validarRevisaoVeiculo,
} from './shared'

const SITE_URL = 'https://www.grupolibertycar.com.br'

type Resultado = { success?: string; error?: string; emailSent?: boolean }

function serializar(id: string, d: FirebaseFirestore.DocumentData): Anuncio {
  const cpfRaw = typeof d.cpf === 'string' && d.cpf.includes(':') ? decrypt(d.cpf) : ''
  return {
    id,
    nome: d.nome ?? '',
    cpf: cpfRaw ? maskCPFCNPJ(cpfRaw) : '',
    email: d.email ?? '',
    telefone: d.telefone ?? '',
    marca: d.marca ?? '',
    modelo: d.modelo ?? '',
    ano: Number(d.ano) || 0,
    cor: d.cor ?? '',
    cambio: d.cambio ?? '',
    combustivel: d.combustivel ?? '',
    quilometragem: Number(d.quilometragem) || 0,
    precoDesejado: Number(d.precoDesejado) || 0,
    observacoes: d.observacoes ?? '',
    placa: d.placa ?? null,
    fotos: Array.isArray(d.fotos) ? (d.fotos as string[]) : [],
    status: (d.status ?? 'pendente') as AnuncioStatus,
    motivoRecusa: d.motivoRecusa ?? null,
    veiculoId: d.veiculoId ?? null,
    created_at: d.created_at ?? '',
    updated_at: d.updated_at ?? '',
    decididoPor: d.decididoPor ?? null,
    decididoEm: d.decididoEm ?? null,
  }
}

/** Lista todos os anúncios, mais recentes primeiro. CPF sempre mascarado. */
export async function getAnuncios(): Promise<Anuncio[]> {
  try {
    await assertPodeVerAnuncios()
    const snap = await adminDb
      .collection('anuncios')
      .orderBy('created_at', 'desc')
      .get()
    return snap.docs.map((doc) => serializar(doc.id, doc.data()))
  } catch (err) {
    console.error('Erro ao buscar anúncios:', err)
    return []
  }
}

/** Recusa um anúncio pendente e notifica o dono por e-mail. */
export async function recusarAnuncio(id: string, motivo?: string): Promise<Resultado> {
  try {
    const user = await assertPodeVerAnuncios()

    const ref = adminDb.collection('anuncios').doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Anúncio não encontrado.' }
    const d = doc.data()!
    if (d.status !== 'pendente') {
      return { error: 'Este anúncio já foi decidido.' }
    }

    const motivoRecusa = (motivo ?? '').trim() || null
    const nowIso = new Date().toISOString()

    await ref.update({
      status: 'recusado',
      motivoRecusa,
      decididoPor: user.uid,
      decididoEm: nowIso,
      updated_at: nowIso,
    })

    revalidatePath('/dashboard/anuncios')

    const emailSent = await sendAnuncioStatusEmail({
      nome: d.nome ?? 'Anunciante',
      email: d.email ?? '',
      marca: d.marca ?? '',
      modelo: d.modelo ?? '',
      ano: d.ano ?? null,
      precoDesejado: d.precoDesejado ?? null,
      status: 'recusado',
      motivoRecusa,
    })

    return { success: 'Anúncio recusado.', emailSent }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao recusar anúncio.'
    console.error('Erro ao recusar anúncio:', err)
    return { error: message }
  }
}

/**
 * Aprova um anúncio: cria um veículo no estoque marcado como `terceiro: true`,
 * publicando no site (`publicar: true`) ou só no estoque (`publicar: false`).
 */
export async function aprovarAnuncio(
  id: string,
  dados: RevisaoVeiculo,
  opts: { publicar: boolean },
): Promise<Resultado & { veiculoId?: string }> {
  const copiadas: string[] = []
  try {
    const user = await assertPodeVerAnuncios()

    const ref = adminDb.collection('anuncios').doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Anúncio não encontrado.' }
    const d = doc.data()!
    if (d.status !== 'pendente') {
      return { error: 'Este anúncio já foi decidido.' }
    }

    const fotosAnuncio: string[] = Array.isArray(d.fotos) ? d.fotos : []
    const fotosPaths: string[] = Array.isArray(d.fotosPaths) ? d.fotosPaths : []

    const erroValidacao = validarRevisaoVeiculo(dados, fotosAnuncio)
    if (erroValidacao) return { error: erroValidacao }

    const bucket = adminStorage.bucket()

    // Copia as fotos escolhidas (na ordem enviada) de anuncios/<id>/ para fotos/.
    const urlsVeiculo: string[] = []
    for (const url of dados.fotos) {
      const idx = fotosAnuncio.indexOf(url)
      const src = fotosPaths[idx]
      if (idx === -1 || !src) {
        // Anúncio antigo sem fotosPaths — reaproveita a URL pública direto.
        urlsVeiculo.push(url)
        continue
      }
      const ext = src.split('.').pop() || 'jpg'
      const dest = `fotos/${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`
      await bucket.file(src).copy(bucket.file(dest))
      copiadas.push(dest)
      await bucket.file(dest).makePublic()
      urlsVeiculo.push(bucket.file(dest).publicUrl())
    }

    const cpfRaw =
      typeof d.cpf === 'string' && d.cpf.includes(':') ? decrypt(d.cpf) : ''
    const nowIso = new Date().toISOString()
    const veiculoRef = adminDb.collection('veiculos').doc()

    await veiculoRef.set({
      marca: dados.marca.trim(),
      modelo: dados.modelo.trim(),
      ano: dados.ano,
      cor: dados.cor.trim(),
      quilometragem: dados.quilometragem,
      preco: dados.preco,
      precoComDesconto: null,
      tabelaFipe: null,
      cambio: dados.cambio,
      combustivel: dados.combustivel,
      placa: dados.placa,
      renavam: null,
      descricao: dados.descricao.trim(),
      fotos: urlsVeiculo,
      localizacao: dados.localizacao || 'Jaú/SP',
      publico: opts.publicar,
      terceiro: true,
      terceiroInfo: {
        nome: d.nome ?? '',
        email: d.email ?? '',
        telefone: d.telefone ?? '',
        anuncioId: id,
      },
      cpfCliente: null,
      telefoneCliente: null,
      telefoneAcessoria: null,
      valorParcela: null,
      custoAcumulado: null,
      precoAquisicao: null,
      custoEfetivoTotal: null,
      debitos: null,
      debitosItens: [],
      parcelasRestantes: null,
      banco: null,
      bancoCodigo: null,
      quitacaoPercent: null,
      descontoPercent: null,
      bancoCnpjs: [],
      taxaJuros: null,
      taxaPeriodicidade: null,
      valorEntrada: null,
      sellerName: d.nome ?? null,
      sellerCpf: cpfRaw ? encrypt(cpfRaw) : null,
      sellerBirthDate: null,
      sellerCity: null,
      isVehicleInSellersName: null,
      registeredOwnerName: null,
      created_by: user.uid,
      created_at: nowIso,
      updated_at: nowIso,
    })

    await ref.update({
      status: opts.publicar ? 'publicado' : 'no_estoque',
      veiculoId: veiculoRef.id,
      decididoPor: user.uid,
      decididoEm: nowIso,
      updated_at: nowIso,
    })

    revalidatePath('/dashboard/anuncios')
    revalidatePath('/dashboard/veiculos')
    if (opts.publicar) revalidatePath('/')

    const emailSent = await sendAnuncioStatusEmail({
      nome: d.nome ?? 'Anunciante',
      email: d.email ?? '',
      marca: dados.marca,
      modelo: dados.modelo,
      ano: dados.ano,
      precoDesejado: dados.preco,
      status: opts.publicar ? 'publicado' : 'no_estoque',
      veiculoUrl: opts.publicar ? `${SITE_URL}/veiculos/${veiculoRef.id}` : null,
    })

    return {
      success: opts.publicar
        ? 'Anúncio aprovado e publicado no site.'
        : 'Anúncio aprovado e adicionado ao estoque.',
      veiculoId: veiculoRef.id,
      emailSent,
    }
  } catch (err) {
    // Limpa as fotos já copiadas se algo falhou no meio.
    if (copiadas.length > 0) {
      const bucket = adminStorage.bucket()
      await Promise.all(copiadas.map((c) => bucket.file(c).delete().catch(() => {})))
    }
    const message = err instanceof Error ? err.message : 'Erro ao aprovar anúncio.'
    console.error('Erro ao aprovar anúncio:', err)
    return { error: message }
  }
}

/** Exclui um anúncio já decidido e remove as fotos originais do Storage. */
export async function excluirAnuncio(id: string): Promise<Resultado> {
  try {
    await assertPodeVerAnuncios()

    const ref = adminDb.collection('anuncios').doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Anúncio não encontrado.' }
    const d = doc.data()!
    if (!['recusado', 'publicado', 'no_estoque'].includes(d.status)) {
      return { error: 'Só é possível excluir anúncios já recusados ou aprovados.' }
    }

    try {
      await adminStorage.bucket().deleteFiles({ prefix: `anuncios/${id}/` })
    } catch (storageErr) {
      console.error('Erro ao remover fotos do anúncio no Storage:', storageErr)
    }

    await ref.delete()
    revalidatePath('/dashboard/anuncios')
    return { success: 'Anúncio excluído.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir anúncio.'
    console.error('Erro ao excluir anúncio:', err)
    return { error: message }
  }
}
