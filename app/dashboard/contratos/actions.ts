'use server'

import { revalidatePath } from 'next/cache'
import { adminDb, adminStorage } from '@/utils/firebase/admin'
import { assertPodeGerarContratos } from '@/utils/permissions'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import type {
  Contrato,
  ContratoInput,
  ContratoResponse,
} from './types'
import ContratoDocument from './pdf/ContratoDocument'

function parseValor(raw: unknown): number {
  if (typeof raw === 'number') return raw
  if (typeof raw !== 'string') return NaN
  const cleaned = raw.replace(/\s/g, '').replace(/R\$/gi, '').replace(/\./g, '').replace(',', '.')
  return Number(cleaned)
}

function sanitizeString(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function sanitizeOptional(value: unknown, maxLength = 500): string | null {
  const v = sanitizeString(value, maxLength)
  return v || null
}

function serializeContrato(id: string, data: FirebaseFirestore.DocumentData): Contrato {
  return {
    id,
    veiculoId: data.veiculoId,
    veiculoResumo: data.veiculoResumo,
    veiculoMarca: data.veiculoMarca,
    veiculoModelo: data.veiculoModelo,
    veiculoAno: data.veiculoAno ?? null,
    veiculoPlaca: data.veiculoPlaca ?? null,
    veiculoChassi: data.veiculoChassi ?? null,
    veiculoCor: data.veiculoCor ?? null,
    veiculoQuilometragem: data.veiculoQuilometragem ?? null,
    veiculoLocalizacao: data.veiculoLocalizacao ?? null,
    clienteNome: data.clienteNome,
    clienteCpfCnpj: data.clienteCpfCnpj,
    clienteEndereco: data.clienteEndereco,
    clienteEmail: data.clienteEmail ?? null,
    clienteTelefone: data.clienteTelefone ?? null,
    valor: data.valor,
    formaPagamento: data.formaPagamento,
    dataEmissao: data.dataEmissao,
    clausulasExtras: data.clausulasExtras ?? '',
    observacoesInternas: data.observacoesInternas ?? '',
    status: data.status,
    storagePath: data.storagePath,
    criadoPorUid: data.criadoPorUid,
    criadoPorEmail: data.criadoPorEmail ?? null,
    criadoEm: data.criadoEm,
    atualizadoEm: data.atualizadoEm,
  }
}

export async function criarContrato(
  input: ContratoInput,
): Promise<ContratoResponse> {
  try {
    const user = await assertPodeGerarContratos()

    const veiculoId = sanitizeString(input.veiculoId, 200)
    const clienteNome = sanitizeString(input.clienteNome, 200)
    const clienteCpfCnpj = sanitizeString(input.clienteCpfCnpj, 30)
    const clienteEndereco = sanitizeString(input.clienteEndereco, 500)
    const clienteEmail = sanitizeOptional(input.clienteEmail, 200)
    const clienteTelefone = sanitizeOptional(input.clienteTelefone, 50)
    const formaPagamento = sanitizeString(input.formaPagamento, 200) || 'À vista'
    const clausulasExtras = sanitizeString(input.clausulasExtras, 4000)
    const observacoesInternas = sanitizeString(input.observacoesInternas, 2000)
    const valor = parseValor(input.valor)

    if (!veiculoId) return { error: 'Selecione um veículo.' }
    if (!clienteNome) return { error: 'Informe o nome do cliente.' }
    if (!clienteCpfCnpj) return { error: 'Informe o CPF/CNPJ do cliente.' }
    if (!clienteEndereco) return { error: 'Informe o endereço do cliente.' }
    if (!Number.isFinite(valor) || valor <= 0) {
      return { error: 'Informe um valor válido.' }
    }

    const veiculoDoc = await adminDb.collection('veiculos').doc(veiculoId).get()
    if (!veiculoDoc.exists) return { error: 'Veículo não encontrado.' }
    const veiculo = veiculoDoc.data() as Record<string, unknown>

    const now = new Date().toISOString()
    const dataEmissao = now.slice(0, 10)

    const contratoRef = adminDb.collection('contratos').doc()
    const contratoId = contratoRef.id

    const contrato: Contrato = {
      id: contratoId,
      veiculoId,
      veiculoResumo: `${veiculo.marca ?? ''} ${veiculo.modelo ?? ''} ${veiculo.ano ?? ''}`.trim(),
      veiculoMarca: String(veiculo.marca ?? ''),
      veiculoModelo: String(veiculo.modelo ?? ''),
      veiculoAno: typeof veiculo.ano === 'number' ? veiculo.ano : Number(veiculo.ano) || null,
      veiculoPlaca: veiculo.placa ? String(veiculo.placa) : null,
      veiculoChassi: veiculo.chassi ? String(veiculo.chassi) : null,
      veiculoCor: veiculo.cor ? String(veiculo.cor) : null,
      veiculoQuilometragem:
        typeof veiculo.quilometragem === 'number'
          ? veiculo.quilometragem
          : Number(veiculo.quilometragem) || null,
      veiculoLocalizacao:
        veiculo.localizacao === 'bauru' || veiculo.localizacao === 'jau'
          ? veiculo.localizacao
          : null,
      clienteNome,
      clienteCpfCnpj,
      clienteEndereco,
      clienteEmail,
      clienteTelefone,
      valor,
      formaPagamento,
      dataEmissao,
      clausulasExtras,
      observacoesInternas,
      status: 'ativo',
      storagePath: `contratos/${contratoId}.pdf`,
      criadoPorUid: user.uid,
      criadoPorEmail: user.email,
      criadoEm: now,
      atualizadoEm: now,
    }

    const buffer = await renderToBuffer(createElement(ContratoDocument, { contrato }))

    const bucket = adminStorage.bucket()
    const fileRef = bucket.file(contrato.storagePath)
    await fileRef.save(buffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          contratoId,
          clienteNome,
          veiculoId,
          criadoPor: user.uid,
        },
      },
    })

    const { storagePath, ...persisted } = contrato
    await contratoRef.set({
      ...persisted,
      storagePath,
    })

    revalidatePath('/dashboard/juridico')
    return { success: 'Contrato gerado com sucesso.', contrato }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar contrato.'
    return { error: message }
  }
}

export async function listarContratos(): Promise<Contrato[]> {
  try {
    await assertPodeGerarContratos()
  } catch {
    return []
  }

  const snapshot = await adminDb
    .collection('contratos')
    .orderBy('criadoEm', 'desc')
    .get()

  return snapshot.docs.map((doc) => serializeContrato(doc.id, doc.data()))
}

export async function buscarContrato(id: string): Promise<Contrato | null> {
  try {
    await assertPodeGerarContratos()
  } catch {
    return null
  }

  if (!id) return null
  const doc = await adminDb.collection('contratos').doc(id).get()
  if (!doc.exists) return null
  return serializeContrato(doc.id, doc.data())
}

export async function removerContrato(id: string): Promise<{ success?: string; error?: string }> {
  try {
    await assertPodeGerarContratos()
    if (!id) return { error: 'ID inválido.' }

    const doc = await adminDb.collection('contratos').doc(id).get()
    if (!doc.exists) return { error: 'Contrato não encontrado.' }

    const data = doc.data() as { storagePath?: string }

    if (data?.storagePath) {
      try {
        const bucket = adminStorage.bucket()
        const fileRef = bucket.file(data.storagePath)
        const [exists] = await fileRef.exists()
        if (exists) await fileRef.delete()
      } catch (storageErr) {
        console.error('Erro ao remover PDF do Storage:', storageErr)
      }
    }

    await adminDb.collection('contratos').doc(id).delete()
    revalidatePath('/dashboard/juridico')

    return { success: 'Contrato removido com sucesso.' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao remover contrato.'
    return { error: message }
  }
}
