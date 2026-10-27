'use server'

// Gerar contrato preenchido (prestação de serviço / locação): valida o
// formulário, monta o PDF, opcionalmente guarda o cliente (`clientes_contrato`)
// e anexa o PDF aos contratos do veículo (`veiculo_contratos`).

import { revalidatePath } from 'next/cache'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { adminDb, adminStorage } from '@/utils/firebase/admin'
import { assertPodeGerarContratos } from '@/utils/permissions'
import { onlyDigits } from '@/utils/masks'
import { precisaConjuge } from '@/utils/cobrancas/pessoa'
import ContratoGeradoDocument from './ContratoGeradoDocument'
import { montarContrato } from './texto'
import {
  TIPOS_CONTRATO_GERADO,
  validarGerarContrato,
  type ClienteContrato,
  type ConjugeInput,
  type ContratanteInput,
  type GerarContratoInput,
  type GerarContratoResponse,
} from './types'

const COLECAO_CLIENTES = 'clientes_contrato'

function txt(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function normalizarContratante(raw: unknown): ContratanteInput {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    nome: txt(r.nome, 120),
    rg: txt(r.rg, 30),
    cpf: onlyDigits(txt(r.cpf, 20)).slice(0, 11),
    cep: txt(r.cep, 12),
    endereco: txt(r.endereco, 250),
    estadoCivil: txt(r.estadoCivil, 20),
    profissao: txt(r.profissao, 80),
    email: txt(r.email, 120).toLowerCase(),
    telefone: onlyDigits(txt(r.telefone, 20)).slice(0, 11),
  }
}

function normalizarConjuge(raw: unknown): ConjugeInput {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    nome: txt(r.nome, 120),
    rg: txt(r.rg, 30),
    cpf: onlyDigits(txt(r.cpf, 20)).slice(0, 11),
    profissao: txt(r.profissao, 80),
  }
}

function normalizarInput(raw: unknown): GerarContratoInput {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const obj = (k: string) => (r[k] && typeof r[k] === 'object' ? (r[k] as Record<string, unknown>) : {})
  const v = obj('veiculo')
  const p = obj('prestacao')
  const l = obj('locacao')
  return {
    tipo: r.tipo === 'locacao-de-veiculo' ? 'locacao-de-veiculo' : 'prestacao-de-servico',
    contratante: normalizarContratante(r.contratante),
    conjuge: normalizarConjuge(r.conjuge),
    veiculo: {
      veiculoId: /^[A-Za-z0-9_-]{1,100}$/.test(txt(v.veiculoId, 100)) ? txt(v.veiculoId, 100) : '',
      marcaModelo: txt(v.marcaModelo, 120),
      ano: txt(v.ano, 10),
      fipe: txt(v.fipe, 20),
      placa: txt(v.placa, 10),
      renavam: txt(v.renavam, 15),
    },
    prestacao: {
      banco: txt(p.banco, 80),
      qtdParcelas: txt(p.qtdParcelas, 4),
      parcelasPagas: txt(p.parcelasPagas, 4),
      parcelasAtraso: txt(p.parcelasAtraso, 4),
      valorParcela: txt(p.valorParcela, 20),
      prazo: txt(p.prazo, 4),
      valorProposta: txt(p.valorProposta, 20),
      seguroPrestamista: p.seguroPrestamista === true,
      limpaNome: p.limpaNome === true,
    },
    locacao: {
      prazo: txt(l.prazo, 4),
      valorSemanal: txt(l.valorSemanal, 20),
      caucao: txt(l.caucao, 20),
    },
    salvarCliente: r.salvarCliente === true,
  }
}

export async function listarClientesContratoAction(): Promise<ClienteContrato[]> {
  try {
    await assertPodeGerarContratos()
  } catch {
    return []
  }
  try {
    const snap = await adminDb.collection(COLECAO_CLIENTES).get()
    return snap.docs
      .map((d) => {
        const x = d.data()
        return {
          id: d.id,
          contratante: normalizarContratante(x.contratante),
          conjuge: x.conjuge ? normalizarConjuge(x.conjuge) : null,
          atualizadoEm: String(x.atualizadoEm ?? ''),
        }
      })
      .sort((a, b) => a.contratante.nome.localeCompare(b.contratante.nome, 'pt-BR'))
  } catch (err) {
    console.error('[listarClientesContratoAction]', err)
    return []
  }
}

function nomeArquivo(tipo: string, cliente: string): string {
  const base = cliente
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 50)
  return `contrato_${tipo === 'locacao-de-veiculo' ? 'locacao' : 'prestacao_servico'}_${base || 'cliente'}.pdf`
}

export async function gerarContratoAction(raw: unknown): Promise<GerarContratoResponse> {
  let user: Awaited<ReturnType<typeof assertPodeGerarContratos>>
  try {
    user = await assertPodeGerarContratos()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  const input = normalizarInput(raw)
  const erro = validarGerarContrato(input)
  if (erro) return { error: erro }

  const avisos: string[] = []
  const agora = new Date()
  const iso = agora.toISOString()

  let buffer: Buffer
  try {
    const texto = montarContrato(input, agora)
    buffer = await renderToBuffer(
      createElement(ContratoGeradoDocument, { texto, nomeCliente: input.contratante.nome }) as never,
    )
  } catch (err) {
    console.error('[gerarContratoAction] pdf', err)
    return { error: 'Erro ao gerar o PDF do contrato.' }
  }
  const fileName = nomeArquivo(input.tipo, input.contratante.nome)

  if (input.salvarCliente) {
    try {
      const casado = precisaConjuge(input.contratante.estadoCivil)
      await adminDb
        .collection(COLECAO_CLIENTES)
        .doc(input.contratante.cpf)
        .set({
          contratante: input.contratante,
          conjuge: casado ? input.conjuge : null,
          atualizadoEm: iso,
          atualizadoPorUid: user.uid,
        })
    } catch (err) {
      console.error('[gerarContratoAction] cliente', err)
      avisos.push('Não foi possível salvar o cliente.')
    }
  }

  let guardadoNoVeiculo = false
  if (input.veiculo.veiculoId) {
    try {
      const veiculoId = input.veiculo.veiculoId
      if (!(await adminDb.collection('veiculos').doc(veiculoId).get()).exists) {
        avisos.push('Veículo não encontrado: o contrato não foi guardado no veículo.')
      } else {
        const tipo = TIPOS_CONTRATO_GERADO.find((t) => t.value === input.tipo)!
        const cat = await adminDb
          .collection('contrato_categorias')
          .where('slug', '==', tipo.categoriaSlug)
          .limit(1)
          .get()
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
          descricao: `Gerado pelo painel — ${input.contratante.nome}`,
          storagePath,
          contentType: 'application/pdf',
          size: buffer.length,
          uploadedByUid: user.uid,
          uploadedByEmail: user.email ?? null,
          uploadedAt: iso,
          enviarJuridico: false,
          categoriaId: cat.empty ? null : cat.docs[0].id,
          categoriaNome: cat.empty ? tipo.label : String(cat.docs[0].data().nome ?? tipo.label),
        })
        guardadoNoVeiculo = true
        revalidatePath(`/veiculos/${veiculoId}`)
        revalidatePath('/dashboard/contratos')
      }
    } catch (err) {
      console.error('[gerarContratoAction] veiculo', err)
      avisos.push('Não foi possível guardar o contrato no veículo.')
    }
  }

  return {
    success: 'Contrato gerado.',
    fileName,
    pdfBase64: buffer.toString('base64'),
    guardadoNoVeiculo,
    avisos,
  }
}
