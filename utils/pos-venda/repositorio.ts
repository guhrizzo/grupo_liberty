import 'server-only'
import { createHash } from 'node:crypto'
import { adminDb } from '@/utils/firebase/admin'
import { clienteAutenticado } from '@/utils/portal/acesso'
import { servicosInclusos, type ContratoPosVenda, type MensalidadePosVenda, type ServicoPosVenda } from './modelo'
import { chaveComprador, vendaPosVenda } from './vinculo'

export const contratosPosVenda = () => adminDb.collection('pos_venda_contratos')
export const veiculosPosVenda = () => adminDb.collection('veiculos')
const camposVenda = ['cpfCliente', 'terceiro', 'vendidoEm', 'vendidoRegistradoEm', 'marca', 'modelo', 'ano', 'placa'] as const

const travaVenda = (veiculoId: string, vinculo: string) =>
  adminDb.collection('pos_venda_vendas').doc(createHash('sha256').update(`${veiculoId}:${vinculo}`).digest('hex'))

export type ClientePosVenda = NonNullable<Awaited<ReturnType<typeof clienteAutenticado>>>

export async function clienteComPosVenda() {
  const cliente = await clienteAutenticado()
  return cliente?.cadastro.modulos.includes('posVenda') ? cliente : null
}

export async function registrarSolicitacao(cliente: ClientePosVenda, veiculoId: string, servico: ServicoPosVenda) {
  const pedido = contratosPosVenda().doc()
  return adminDb.runTransaction(async (tx) => {
    const venda = vendaPosVenda((await tx.get(veiculosPosVenda().doc(veiculoId))).data())
    if (venda?.documento !== cliente.documento) return { erro: 'Veículo indisponível para esta conta.' }
    const trava = travaVenda(veiculoId, venda.vinculo)
    const reservas = ((await tx.get(trava)).get('reservas') ?? {}) as Record<string, string>
    const inclusos = servicosInclusos(servico)
    if (inclusos.some((id) => reservas[id])) return { erro: 'Já existe uma solicitação ou contratação que inclui esse serviço.' }
    const novo: ContratoPosVenda = {
      documento: cliente.documento, veiculoId, vinculo: venda.vinculo,
      servico, situacao: 'solicitado', criadoEm: new Date().toISOString(),
    }
    tx.create(pedido, novo)
    tx.set(trava, { reservas: { ...reservas, ...Object.fromEntries(inclusos.map((id) => [id, pedido.id])) } })
    return { sucesso: true }
  })
}

export async function encerrarContratoPosVenda(id: string, documento?: string) {
  const ref = contratosPosVenda().doc(id)
  return adminDb.runTransaction(async (tx) => {
    const contrato = (await tx.get(ref)).data() as ContratoPosVenda | undefined
    if (!contrato || (documento && contrato.documento !== documento)) return false
    if (contrato.situacao === 'cancelado') return true
    if (contrato.situacao === 'ativando' || (contrato.asaasId && contrato.situacao !== 'cancelando')) return false
    const trava = travaVenda(contrato.veiculoId, contrato.vinculo)
    const reservas = ((await tx.get(trava)).get('reservas') ?? {}) as Record<string, string>
    for (const servico of servicosInclusos(contrato.servico)) {
      if (reservas[servico] === id) delete reservas[servico]
    }
    tx.set(trava, { reservas })
    tx.update(ref, { situacao: 'cancelado', canceladoEm: new Date().toISOString() })
    return true
  })
}

async function mensalidades(id: string) {
  const snap = await contratosPosVenda().doc(id).collection('mensalidades').orderBy('vencimento', 'desc').limit(30).get()
  return snap.docs.map((doc) => {
    const m = doc.data() as Omit<MensalidadePosVenda, 'id'>
    return { id: doc.id, vencimento: m.vencimento, valor: m.valor, status: m.status, url: m.url }
  })
}

export async function carregarPosVendaCliente(cliente: ClientePosVenda) {
  const chave = chaveComprador(cliente.documento)
  if (!chave) return { veiculos: [], contratos: [] }
  const [estoque, pedidos] = await Promise.all([
    veiculosPosVenda().where('portalPosVendaChave', '==', chave).select(...camposVenda).get(),
    contratosPosVenda().where('documento', '==', cliente.documento).get(),
  ])
  const veiculos = estoque.docs.flatMap((doc) => {
    const venda = vendaPosVenda(doc.data())
    return venda?.documento === cliente.documento ? [{ id: doc.id, ...venda }] : []
  })
  const porId = new Map(veiculos.map((v) => [v.id, v]))
  const contratos = await Promise.all(pedidos.docs.flatMap((doc) => {
    const contrato = doc.data() as ContratoPosVenda
    const venda = porId.get(contrato.veiculoId)
    if (venda?.vinculo !== contrato.vinculo) return []
    return [mensalidades(doc.id).then((cobrancas) => ({
      id: doc.id,
      veiculoId: contrato.veiculoId,
      veiculo: venda.nome,
      servico: contrato.servico,
      situacao: contrato.situacao,
      criadoEm: contrato.criadoEm,
      proposta: contrato.proposta ? {
        id: contrato.proposta.id, valorCentavos: contrato.proposta.valorCentavos,
        vencimento: contrato.proposta.vencimento, termos: contrato.proposta.termos,
        honorarios20: contrato.proposta.honorarios20,
      } : null,
      cobrancas,
    }))]
  }))
  return {
    veiculos: veiculos.map(({ id, nome, placa, vinculo }) => ({ id, nome, placa, vinculo })),
    contratos: contratos.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
  }
}

export async function carregarPosVendaInterno() {
  const [estoque, pedidos] = await Promise.all([
    veiculosPosVenda().where('vendidoEm', '>', '').select(...camposVenda, 'nomeCliente').get(),
    contratosPosVenda().orderBy('criadoEm', 'desc').get(),
  ])
  const vendas = estoque.docs.flatMap((doc) => {
    const venda = vendaPosVenda(doc.data())
    return venda ? [{ id: doc.id, ...venda, comprador: String(doc.get('nomeCliente') || 'Cliente') }] : []
  })
  const porId = new Map(vendas.map((v) => [v.id, v]))
  const contratos = await Promise.all(pedidos.docs.map(async (doc) => {
    const contrato = doc.data() as ContratoPosVenda
    const venda = porId.get(contrato.veiculoId)
    const atual = venda?.vinculo === contrato.vinculo
    return {
      id: doc.id,
      veiculoId: contrato.veiculoId,
      servico: contrato.servico,
      situacao: contrato.situacao,
      proposta: contrato.proposta ?? null,
      temAssinatura: !!contrato.asaasId,
      veiculo: atual ? venda.nome : 'Venda alterada ou indisponível',
      comprador: atual ? venda.comprador : 'Vínculo em revisão',
      atual,
      cobrancas: await mensalidades(doc.id),
    }
  }))
  const contratados = new Set(contratos.filter((c) => c.atual && c.situacao === 'ativo').map((c) => c.veiculoId))
  return {
    contratos,
    semContrato: vendas.filter((v) => !contratados.has(v.id)).map(({ id, nome, comprador }) => ({ id, nome, comprador })),
  }
}
