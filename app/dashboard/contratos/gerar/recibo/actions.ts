'use server'

// Recibo de pagamento de veículo: valida o formulário, monta o PDF e, se o veículo
// é do estoque, guarda o recibo nos documentos dele (`veiculo_contratos`).

import { revalidatePath } from 'next/cache'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { adminDb, adminStorage } from '@/utils/firebase/admin'
import { assertPodeGerarContratos } from '@/utils/permissions'
import { hojeSaoPaulo } from '@/utils/cobrancas/encargos'
import { onlyDigits } from '@/utils/masks'
import ReciboDocument from './ReciboDocument'
import { validarRecibo, type GerarReciboResponse, type ReciboInput } from './types'

function txt(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

function normalizar(raw: unknown): ReciboInput {
  const r = obj(raw)
  const p = obj(r.pagador)
  const v = obj(r.veiculo)
  const e = obj(r.recebedor)
  const g = obj(r.pagamento)
  const data = txt(g.data, 10)
  return {
    pagador: {
      nome: txt(p.nome, 120),
      documento: onlyDigits(txt(p.documento, 20)).slice(0, 14),
      endereco: txt(p.endereco, 250),
      telefone: txt(p.telefone, 25),
      email: txt(p.email, 120).toLowerCase(),
    },
    veiculo: {
      veiculoId: /^[A-Za-z0-9_-]{1,100}$/.test(txt(v.veiculoId, 100)) ? txt(v.veiculoId, 100) : '',
      marca: txt(v.marca, 60),
      modelo: txt(v.modelo, 80),
      ano: txt(v.ano, 10),
      cor: txt(v.cor, 30),
      placa: txt(v.placa, 10).toUpperCase(),
      chassi: txt(v.chassi, 25).toUpperCase(),
      renavam: txt(v.renavam, 15),
    },
    recebedor: {
      nome: txt(e.nome, 120),
      cnpj: onlyDigits(txt(e.cnpj, 20)).slice(0, 14),
      endereco: txt(e.endereco, 250),
      responsavel: txt(e.responsavel, 120),
      responsavelCpf: onlyDigits(txt(e.responsavelCpf, 20)).slice(0, 11),
    },
    pagamento: {
      valor: txt(g.valor, 20),
      data: /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : '',
      forma: txt(g.forma, 40),
      valorTotal: txt(g.valorTotal, 20),
      referencia: txt(g.referencia, 200),
    },
    guardarNoVeiculo: r.guardarNoVeiculo !== false,
  }
}

function nomeArquivo(cliente: string): string {
  const base = cliente
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 50)
  return `recibo_pagamento_${base || 'cliente'}.pdf`
}

export async function gerarReciboAction(raw: unknown): Promise<GerarReciboResponse> {
  let user: Awaited<ReturnType<typeof assertPodeGerarContratos>>
  try {
    user = await assertPodeGerarContratos()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  const input = normalizar(raw)
  const erro = validarRecibo(input)
  if (erro) return { error: erro }
  if (input.pagamento.data > hojeSaoPaulo()) return { error: 'A data do pagamento não pode ser futura.' }

  const agora = new Date()
  let buffer: Buffer
  try {
    buffer = await renderToBuffer(createElement(ReciboDocument, { input, agora }) as never)
  } catch (err) {
    console.error('[gerarReciboAction] pdf', err)
    return { error: 'Erro ao gerar o PDF do recibo.' }
  }
  const fileName = nomeArquivo(input.pagador.nome)

  const avisos: string[] = []
  let guardadoNoVeiculo = false
  const veiculoId = input.veiculo.veiculoId
  if (veiculoId && input.guardarNoVeiculo) {
    try {
      if (!(await adminDb.collection('veiculos').doc(veiculoId).get()).exists) {
        avisos.push('Veículo não encontrado: o recibo não foi guardado no veículo.')
      } else {
        const cat = await adminDb.collection('contrato_categorias').where('slug', '==', 'recibo').limit(1).get()
        const ref = adminDb.collection('veiculo_contratos').doc()
        const storagePath = `veiculos/${veiculoId}/contratos/${ref.id}.pdf`
        await adminStorage.bucket().file(storagePath).save(buffer, {
          contentType: 'application/pdf',
          metadata: { metadata: { uploadedBy: user.uid } },
        })
        await ref.set({
          id: ref.id,
          veiculoId,
          fileName,
          descricao: `Recibo gerado pelo painel — ${input.pagador.nome}`,
          storagePath,
          contentType: 'application/pdf',
          size: buffer.length,
          uploadedByUid: user.uid,
          uploadedByEmail: user.email ?? null,
          uploadedAt: agora.toISOString(),
          enviarJuridico: false,
          categoriaId: cat.empty ? null : cat.docs[0].id,
          categoriaNome: cat.empty ? 'Recibo de pagamento' : String(cat.docs[0].data().nome ?? 'Recibo de pagamento'),
        })
        guardadoNoVeiculo = true
        revalidatePath(`/veiculos/${veiculoId}`)
        revalidatePath('/dashboard/contratos')
      }
    } catch (err) {
      console.error('[gerarReciboAction] veiculo', err)
      avisos.push('Não foi possível guardar o recibo no veículo.')
    }
  }

  return { success: 'Recibo gerado.', fileName, pdfBase64: buffer.toString('base64'), guardadoNoVeiculo, avisos }
}
