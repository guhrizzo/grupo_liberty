import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => {
  const dados = new Map<string, Record<string, unknown>>()
  const posicao = vi.fn()
  const criarAssinatura = vi.fn()
  const buscarAssinaturas = vi.fn()
  const credencial = vi.fn()
  const buscarCobranca = vi.fn()
  const commits: unknown[][] = []
  let contador = 0
  function ref(path: string): any {
    return {
      id: path.split('/').at(-1), path,
      get: async () => snapshot(path),
      update: async (patch: Record<string, unknown>) => put(path, patch),
      set: async (patch: Record<string, unknown>) => dados.set(path, patch),
      collection: (nome: string) => collection(`${path}/${nome}`),
    }
  }
  function snapshot(path: string) {
    return { id: path.split('/').at(-1), data: () => dados.get(path), get: (campo: string) => dados.get(path)?.[campo] }
  }
  function put(path: string, patch: Record<string, unknown>) {
    dados.set(path, { ...dados.get(path), ...patch })
  }
  function collection(path: string): any {
    return {
      doc: (id = `novo-${++contador}`) => ref(`${path}/${id}`),
      where: (campo: string, _op: string, valor: string) => ({
        limit: () => ({ get: async () => ({
          docs: [...dados.keys()].filter((key) => key.startsWith(`${path}/`) && dados.get(key)?.[campo] === valor).map(snapshot),
        }) }),
      }),
      orderBy: () => ({ limit: () => ({ get: async () => ({
        docs: [...dados.keys()].filter((key) => key.startsWith(`${path}/`)).map(snapshot),
      }) }) }),
    }
  }
  return {
    dados, posicao, criarAssinatura, buscarAssinaturas, credencial, buscarCobranca, commits, collection, put,
    db: {
      collection,
      runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => cb({
        get: (r: { path: string }) => snapshot(r.path),
        create: (r: { path: string }, doc: Record<string, unknown>) => dados.set(r.path, doc),
        set: (r: { path: string }, doc: Record<string, unknown>) => dados.set(r.path, doc),
        update: (r: { path: string }, doc: Record<string, unknown>) => put(r.path, doc),
      }),
      batch: () => {
        const operacoes: unknown[] = []
        return {
          set: (r: { path: string }, conteudo: unknown) => operacoes.push(['set', r.path, conteudo]),
          delete: (r: { path: string }) => operacoes.push(['delete', r.path]),
          commit: async () => commits.push(operacoes),
        }
      },
    },
  }
})

vi.mock('server-only', () => ({}))
vi.mock('@/utils/firebase/admin', () => ({ adminDb: fake.db }))
vi.mock('@/utils/portal/acesso', () => ({
  clienteAutenticado: vi.fn(),
  clientesPortal: () => fake.collection('clientes_contrato'),
}))
vi.mock('@/utils/autocarsat/client', () => ({ posicaoDoVeiculo: fake.posicao }))
vi.mock('@/utils/asaas/client', () => ({
  AsaasError: class extends Error {},
  buscarOuCriarCliente: fake.credencial,
  assinaturasPorReferencia: fake.buscarAssinaturas,
  criarAssinaturaServico: fake.criarAssinatura,
  buscarCobranca: fake.buscarCobranca,
  listarMensalidadesAssinatura: async () => ({ data: [] }),
}))

import { ativarPosVenda, tratarPagamentoPosVenda } from './cobranca'
import { registrarSolicitacao, encerrarContratoPosVenda, type ClientePosVenda } from './repositorio'
import { rastreamentoPosVenda } from './servicos'
import { hojePosVenda } from './modelo'
import { vendaPosVenda } from './vinculo'

const documento = '52998224725'
const outro = '11144477735'
const veiculo = { cpfCliente: documento, sellerCpf: outro, vendidoEm: '2026-11-23', vendidoRegistradoEm: '2026-11-23T15:00:00Z', placa: 'ABC1D23' }
const cliente = { documento } as ClientePosVenda
const contratoId = 'pedido'
const caminho = 'pos_venda_contratos/pedido'
const proposta = () => ({ id: 'proposta', valorCentavos: 9900, vencimento: hojePosVenda(), termos: 'Condições de teste', honorarios20: false, rastreador: 'tracker1' })
function contrato(situacao: string) {
  return {
    documento, veiculoId: 'veiculo', vinculo: vendaPosVenda(veiculo)!.vinculo,
    servico: 'rastreamento', situacao, proposta: proposta(), aceite: { propostaId: 'proposta', rastreamento: true },
  }
}

describe('Pós-venda Liberty', () => {
  beforeEach(() => {
    vi.stubEnv('PORTAL_POS_VENDA_INDEX_KEY', 'chave-local-de-teste')
    vi.stubEnv('POS_VENDA_COBRANCA_HABILITADA', 'true')
    vi.stubEnv('ASAAS_API_KEY', 'sandbox-de-teste')
    vi.stubEnv('ASAAS_WEBHOOK_TOKEN', 'token-de-teste')
    vi.resetAllMocks()
    fake.dados.clear()
    fake.commits.length = 0
    fake.dados.set('veiculos/veiculo', veiculo)
    fake.dados.set(`clientes_contrato/${documento}`, {
      portal: { ativo: true, modulos: ['posVenda'], email: 'cliente@example.test' },
    })
  })

  it('vincula o comprador, exclui anúncios de terceiros e barra pedidos de outro titular', async () => {
    expect(vendaPosVenda(veiculo)?.documento).toBe(documento)
    expect(vendaPosVenda({ ...veiculo, terceiro: true })).toBeNull()
    expect(vendaPosVenda({ ...veiculo, vendidoEm: null })).toBeNull()
    expect(await registrarSolicitacao({ documento: outro } as ClientePosVenda, 'veiculo', 'juridico')).toHaveProperty('erro')
    expect(await registrarSolicitacao(cliente, 'veiculo', 'juridico')).toEqual({ sucesso: true })
    expect(await registrarSolicitacao(cliente, 'veiculo', 'pacote')).toHaveProperty('erro')
    const pedido = [...fake.dados.keys()].find((key) => key.startsWith('pos_venda_contratos/'))!.split('/')[1]
    expect(await encerrarContratoPosVenda(pedido, documento)).toBe(true)
    expect(await registrarSolicitacao(cliente, 'veiculo', 'pacote')).toEqual({ sucesso: true })
  })

  it('usa somente o preço aceito e, após resposta ambígua, apenas concilia a assinatura', async () => {
    fake.dados.set(caminho, contrato('aceito'))
    fake.credencial.mockResolvedValue('cus_1')
    fake.buscarAssinaturas.mockResolvedValue({ data: [] })
    fake.criarAssinatura.mockRejectedValue(new Error('Sem resposta'))
    expect(await ativarPosVenda(contratoId)).toHaveProperty('erro')
    expect(fake.criarAssinatura).toHaveBeenCalledWith('cus_1', 'liberty-pos-venda:pedido', 99, hojePosVenda(), 'Rastreamento veicular', 'MONTHLY')
    expect(fake.dados.get(caminho)?.situacao).toBe('ativando')
    expect(await ativarPosVenda(contratoId)).toHaveProperty('erro')
    expect(fake.criarAssinatura).toHaveBeenCalledTimes(1)

    fake.buscarAssinaturas.mockResolvedValueOnce({ data: [{ id: 'sub_1', customer: 'cus_1', externalReference: 'liberty-pos-venda:pedido', status: 'ACTIVE', value: 99 }] })
    expect(await ativarPosVenda(contratoId)).toEqual({ sucesso: true })
    expect(fake.dados.get(caminho)).toMatchObject({ situacao: 'ativo', asaasId: 'sub_1' })
  })

  it('restringe a posição ao comprador com autorização e rejeita um rastreador de outra placa', async () => {
    fake.dados.set(caminho, contrato('ativo'))
    expect(await rastreamentoPosVenda(contratoId, outro)).toBeNull()
    expect(fake.posicao).not.toHaveBeenCalled()
    fake.posicao.mockResolvedValue({ ok: true, data: {
      uuid: 'tracker1', placa: 'AAA1B23', gps_valido: true, latitude: -20, longitude: -48, date_time_event: '2026-11-23 12:00:00',
    } })
    expect(await rastreamentoPosVenda(contratoId, documento)).toMatchObject({ posicoes: [] })
    fake.posicao.mockResolvedValueOnce({ ok: true, data: {
      uuid: 'tracker1', placa: 'ABC1D23', gps_valido: true, latitude: -20, longitude: -48, date_time_event: '2026-11-23 12:00:00',
    } })
    const rastreio = await rastreamentoPosVenda(contratoId, documento)
    expect(rastreio?.posicoes).toEqual([expect.objectContaining({ latitude: -20, longitude: -48 })])
  })

  it('registra recebimento e estorno no mesmo lançamento financeiro', async () => {
    fake.dados.set(caminho, { ...contrato('ativo'), asaasId: 'sub_1', asaasCliente: 'cus_1' })
    const mensalidade = { id: 'pay_1', subscription: 'sub_1', customer: 'cus_1', value: 99, dueDate: hojePosVenda(), status: 'RECEIVED', billingType: 'PIX' } as const
    fake.buscarCobranca.mockResolvedValueOnce(mensalidade)
    expect(await tratarPagamentoPosVenda('PAYMENT_RECEIVED', mensalidade)).toBe(true)
    expect(fake.commits[0]).toContainEqual(['set', 'transacoes/pos_venda_pay_1', expect.objectContaining({ valor: 99, tipo: 'receita' })])

    fake.buscarCobranca.mockResolvedValueOnce({ ...mensalidade, status: 'REFUNDED' })
    expect(await tratarPagamentoPosVenda('PAYMENT_REFUNDED', mensalidade)).toBe(true)
    expect(fake.commits[1]).toContainEqual(['delete', 'transacoes/pos_venda_pay_1'])
  })
})
