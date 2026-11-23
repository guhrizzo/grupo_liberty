'use server'

// Gerar contrato preenchido (promessa de compra, prestação de serviços): valida o
// formulário, monta o PDF, opcionalmente guarda o cliente (`clientes_contrato`)
// e anexa o PDF aos contratos do veículo (`veiculo_contratos`).

import { revalidatePath } from 'next/cache'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { adminDb, adminStorage } from '@/utils/firebase/admin'
import { assertPodeGerarContratos } from '@/utils/permissions'
import { onlyDigits } from '@/utils/masks'
import ContratoBlocosDocument from './ContratoBlocosDocument'
import { montarContratoGerado } from './montar'
import {
  TIPOS_CONTRATO_GERADO,
  TIPO_PROMESSA,
  validarGerarContrato,
  type ClienteContrato,
  type ContaInput,
  type LocacaoInput,
  type ContratanteInput,
  type GerarContratoInput,
  type GerarContratoResponse,
  type IntermediadorInput,
  type TestemunhaInput,
} from './types'

const COLECAO_CLIENTES = 'clientes_contrato'

function txt(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function normalizarContratante(raw: unknown): ContratanteInput {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    nome: txt(r.nome, 120),
    nacionalidade: txt(r.nacionalidade, 40),
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

/** "AAAA-MM-DD" ou vazio. */
function dataIso(v: unknown): string {
  const t = txt(v, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ''
}

function normalizarIntermediador(raw: unknown): IntermediadorInput {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    razaoSocial: txt(r.razaoSocial, 120),
    cnpj: onlyDigits(txt(r.cnpj, 20)).slice(0, 14),
    endereco: txt(r.endereco, 250),
    nome: txt(r.nome, 120),
    nacionalidade: txt(r.nacionalidade, 40),
    estadoCivil: txt(r.estadoCivil, 30),
    cpf: onlyDigits(txt(r.cpf, 20)).slice(0, 11),
    email: txt(r.email, 120).toLowerCase(),
  }
}

function normalizarConta(raw: unknown): ContaInput {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    titular: txt(r.titular, 120),
    documento: onlyDigits(txt(r.documento, 20)).slice(0, 14),
    banco: txt(r.banco, 60),
    agencia: txt(r.agencia, 20),
    conta: txt(r.conta, 30),
    tipoConta: txt(r.tipoConta, 30),
    chavePix: txt(r.chavePix, 120),
  }
}

function normalizarLocacao(raw: unknown): LocacaoInput {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    aluguel: txt(r.aluguel, 20),
    diaVencimento: txt(r.diaVencimento, 2),
    primeiroPagamento: dataIso(r.primeiroPagamento),
    entrada: txt(r.entrada, 20),
    parcelas: txt(r.parcelas, 3),
    franquia: txt(r.franquia, 20),
  }
}

function normalizarTestemunha(raw: unknown): TestemunhaInput {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { nome: txt(r.nome, 120), cpf: onlyDigits(txt(r.cpf, 20)).slice(0, 11) }
}

function normalizarInput(raw: unknown): GerarContratoInput {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const obj = (k: string) => (r[k] && typeof r[k] === 'object' ? (r[k] as Record<string, unknown>) : {})
  const v = obj('veiculo')
  const p = obj('prestacao')
  const k = obj('compra')
  return {
    tipo: TIPOS_CONTRATO_GERADO.find((t) => t.value === r.tipo)?.value ?? TIPO_PROMESSA,
    contratante: normalizarContratante(r.contratante),
    vendedor2: normalizarContratante(r.vendedor2),
    veiculo: {
      veiculoId: /^[A-Za-z0-9_-]{1,100}$/.test(txt(v.veiculoId, 100)) ? txt(v.veiculoId, 100) : '',
      ano: txt(v.ano, 10),
      placa: txt(v.placa, 10),
      renavam: txt(v.renavam, 15),
    },
    prestacao: {
      banco: txt(p.banco, 80),
      qtdParcelas: txt(p.qtdParcelas, 4),
      parcelasPagas: txt(p.parcelasPagas, 4),
      parcelasAtraso: txt(p.parcelasAtraso, 4),
      valorParcela: txt(p.valorParcela, 20),
    },
    compra: {
      marca: txt(k.marca, 60),
      modelo: txt(k.modelo, 80),
      cor: txt(k.cor, 30),
      chassi: txt(k.chassi, 25),
      categoria: txt(k.categoria, 40),
      conservacao: txt(k.conservacao, 120),
      tipoFinanciamento: txt(k.tipoFinanciamento, 60),
      valorFinanciado: txt(k.valorFinanciado, 20),
      saldoDevedor: txt(k.saldoDevedor, 20),
      prazoQuitacao: txt(k.prazoQuitacao, 4),
      valorTotal: txt(k.valorTotal, 20),
      formaPagamento: txt(k.formaPagamento, 20),
      pagamentoCombinado: (Array.isArray(k.pagamentoCombinado) ? k.pagamentoCombinado.slice(0, 6) : []).map((x) => {
        const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
        return { forma: txt(r.forma, 20), valor: txt(r.valor, 20) }
      }),
      intermediador: normalizarIntermediador(k.intermediador),
      testemunhas: [0, 1].map((n) => normalizarTestemunha(Array.isArray(k.testemunhas) ? k.testemunhas[n] : null)),
      pagamentos: txt(k.pagamentos, 2),
      valorPagamento: txt(k.valorPagamento, 20),
      vencimentos: (Array.isArray(k.vencimentos) ? k.vencimentos.slice(0, 60) : []).map((d) => dataIso(d)),
      cidade: txt(k.cidade, 60),
      dataAssinatura: dataIso(k.dataAssinatura),
      dataPagamento: dataIso(k.dataPagamento),
      pagamentoNaEntrega: k.pagamentoNaEntrega === true,
      assumirDivida: k.assumirDivida === true,
      limpaNome: k.limpaNome !== false,
      seguroPrestamista: k.seguroPrestamista !== false,
      numeroContrato: txt(k.numeroContrato, 40),
      conta: normalizarConta(k.conta),
      locacao: normalizarLocacao(k.locacao),
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
  const nomeTipo =
    tipo === 'locacao-opcao-aquisicao'
      ? 'locacao_opcao_aquisicao'
      : tipo === 'recuperacao-valores'
      ? 'recuperacao_valores'
      : tipo === 'promessa-compra-parcelada'
      ? 'promessa_compra_parcelada'
      : tipo === 'prestacao-servico-casal'
        ? 'prestacao_servico_casal'
        : tipo === 'prestacao-servico'
          ? 'prestacao_servico'
          : 'promessa_compra'
  return `contrato_${nomeTipo}_${base || 'cliente'}.pdf`
}

async function renderizarPdf(input: GerarContratoInput, agora: Date): Promise<Buffer> {
  const contrato = montarContratoGerado(input, agora)
  return renderToBuffer(createElement(ContratoBlocosDocument, { contrato, nomeCliente: input.contratante.nome }) as never)
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
    buffer = await renderizarPdf(input, agora)
  } catch (err) {
    console.error('[gerarContratoAction] pdf', err)
    return { error: 'Erro ao gerar o PDF do contrato.' }
  }
  const fileName = nomeArquivo(input.tipo, input.contratante.nome)

  if (input.salvarCliente) {
    try {
      // `merge`: preserva o que já estava guardado no cliente (ex.: cônjuge de contratos antigos).
      await adminDb
        .collection(COLECAO_CLIENTES)
        .doc(input.contratante.cpf)
        .set(
          {
            contratante: input.contratante,
            atualizadoEm: iso,
            atualizadoPorUid: user.uid,
          },
          { merge: true },
        )
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
          portalDocumento: input.contratante.cpf,
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
