import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => {
  const documento = '52998224725'
  const arquivo = 'quitacoes/veiculo/cliente-versao.pdf'
  const cliente = vi.fn()
  const getAll = vi.fn()
  const runTransaction = vi.fn()
  const criar = vi.fn()
  const set = vi.fn()
  const listarVeiculos = vi.fn()
  const lerDocumento = vi.fn()
  const snap = (data: Record<string, unknown>) => ({ data: () => data, get: (key: string) => data[key] })
  return { documento, arquivo, cliente, getAll, runTransaction, criar, set, snap, listarVeiculos, lerDocumento }
})

vi.mock('server-only', () => ({}))
vi.mock('@/utils/portal/acesso', () => ({ clienteAutenticado: fake.cliente }))
vi.mock('@/utils/firebase/admin', () => ({
  adminDb: {
    collection: (collection: string) => ({
      doc: (id: string) => ({ id, path: `${collection}/${id}`, get: () => fake.lerDocumento(collection, id) }),
      where: (...filtros: unknown[]) => ({ select: () => ({ get: () => fake.listarVeiculos(...filtros) }) }),
    }),
    runTransaction: fake.runTransaction,
  },
}))

import { acompanhamentoQuitacao, atualizarAcompanhamento, versaoAnexoQuitacao } from './acompanhamento'
import { listarQuitacoesCliente, obterDocumentoQuitacaoCliente } from './portal'
import { compraQuitacao } from './vinculo'
import { ETAPAS_PADRAO, etapasDaOperacao } from './etapas'

const veiculo = { sellerCpf: fake.documento, dataAquisicao: '2026-11-10' }
const anexo = () => fake.snap({ veiculoId: 'veiculo', tipo: 'cliente', storagePath: fake.arquivo, size: 10, contentType: 'application/pdf' })

describe('acompanhamento de quitação', () => {
  beforeEach(() => {
    vi.stubEnv('PORTAL_QUITACAO_INDEX_KEY', 'chave-de-teste')
    vi.clearAllMocks()
    fake.cliente.mockResolvedValue({ documento: fake.documento, cadastro: { modulos: ['quitacao'] } })
    fake.runTransaction.mockImplementation(async (fn) => fn({ getAll: fake.getAll, set: fake.set, create: fake.criar }))
  })
  afterEach(() => vi.unstubAllEnvs())

  it('vincula a aquisição a um documento válido, uma data e um veículo próprio', () => {
    expect(compraQuitacao(veiculo)).toMatchObject({ documento: fake.documento, data: '2026-11-10' })
    expect(compraQuitacao({ ...veiculo, terceiro: true })).toBeNull()
    expect(compraQuitacao({ cpfCliente: fake.documento, dataAquisicao: veiculo.dataAquisicao })).toBeNull()
    expect(compraQuitacao({ ...veiculo, dataAquisicao: null })).toBeNull()
    expect(compraQuitacao({ ...veiculo, sellerCpf: '00000000000' })).toBeNull()
    expect(compraQuitacao({ ...veiculo, dataAquisicao: '2026-11-11' })?.vinculo).not.toBe(compraQuitacao(veiculo)?.vinculo)
  })

  it('registra etapa, histórico, documento publicado e aviso juntos na ficha existente', async () => {
    const compra = compraQuitacao(veiculo)!
    fake.getAll.mockResolvedValueOnce([fake.snap(veiculo), fake.snap({})]).mockResolvedValueOnce([anexo()])
    const result = await atualizarAcompanhamento('veiculo', 'quitado', 'funcionario', ETAPAS_PADRAO, {
      vinculo: compra.vinculo,
      arquivos: [{ tipo: 'cliente', versao: versaoAnexoQuitacao(fake.arquivo) }],
    })
    expect(result.aviso).toBeTruthy()
    expect(fake.set).toHaveBeenCalledWith(expect.objectContaining({ path: 'quitacao_fichas/veiculo' }), expect.objectContaining({
      quitado: true,
      portalAcompanhamento: expect.objectContaining({
        etapa: 'quitado',
        publicados: { cliente: fake.arquivo },
        historico: [expect.objectContaining({ etapa: 'recebido' }), expect.objectContaining({ etapa: 'quitado' })],
      }),
    }), expect.anything())
    expect(fake.criar).toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringContaining('quitacao_notificacoes/') }), expect.objectContaining({ etapa: 'quitado' }))
  })

  it('recusa publicação quando o documento selecionado foi substituído', async () => {
    fake.getAll.mockResolvedValueOnce([fake.snap(veiculo), fake.snap({})]).mockResolvedValueOnce([anexo()])
    await expect(atualizarAcompanhamento('veiculo', 'recebido', 'funcionario', ETAPAS_PADRAO, {
      vinculo: compraQuitacao(veiculo)!.vinculo,
      arquivos: [{ tipo: 'cliente', versao: versaoAnexoQuitacao('versao-antiga') }],
    })).rejects.toThrow('O arquivo foi alterado.')
    expect(fake.set).not.toHaveBeenCalled()
  })

  it('entrega somente a versão publicada ao titular com permissão', async () => {
    const andamento = acompanhamentoQuitacao(compraQuitacao(veiculo)!)
    andamento.publicados.cliente = fake.arquivo
    const ficha = fake.snap({ portalAcompanhamento: andamento })
    fake.getAll.mockResolvedValue([fake.snap(veiculo), ficha, anexo()])
    expect(await obterDocumentoQuitacaoCliente('veiculo', 'cliente')).toMatchObject({ path: fake.arquivo })

    fake.getAll.mockResolvedValueOnce([fake.snap(veiculo), ficha, fake.snap({ storagePath: 'quitacoes/veiculo/outro.pdf' })])
    expect(await obterDocumentoQuitacaoCliente('veiculo', 'cliente')).toBeNull()

    fake.getAll.mockResolvedValueOnce([fake.snap({ ...veiculo, dataAquisicao: '2026-11-11' }), ficha, anexo()])
    expect(await obterDocumentoQuitacaoCliente('veiculo', 'cliente')).toBeNull()

    fake.cliente.mockResolvedValueOnce({ documento: '11144477735', cadastro: { modulos: ['quitacao'] } })
    expect(await obterDocumentoQuitacaoCliente('veiculo', 'cliente')).toBeNull()
    fake.cliente.mockResolvedValueOnce({ documento: fake.documento, cadastro: { modulos: [] } })
    expect(await obterDocumentoQuitacaoCliente('veiculo', 'cliente')).toBeNull()
  })

  it('mostra duas operações do titular com etapas independentes e omite operação de outro CPF', async () => {
    const outraCompra = { ...veiculo, dataAquisicao: '2026-11-12' }
    const primeira = {
      ...acompanhamentoQuitacao(compraQuitacao(veiculo)!), etapa: 'negociacao', previsao: '2026-12-10',
      naoAplicaveis: ['documentacao_recebida'], publicados: { cliente: 'quitacoes/primeiro/documento.pdf' },
    }
    fake.listarVeiculos.mockResolvedValue({ docs: [
      { id: 'primeiro', ...fake.snap({ ...veiculo, banco: 'Banco A' }) },
      { id: 'segundo', ...fake.snap(outraCompra) },
      { id: 'outro-titular', ...fake.snap({ ...veiculo, sellerCpf: '11144477735' }) },
    ] })
    fake.lerDocumento.mockImplementation((colecao, id) => {
      if (colecao === 'quitacao_anexos') return fake.snap({
        veiculoId: 'primeiro', tipo: 'cliente', storagePath: primeira.publicados.cliente,
      })
      return fake.snap(id === 'primeiro' ? { portalAcompanhamento: primeira } : {})
    })
    const operacoes = await listarQuitacoesCliente()
    expect(operacoes).toMatchObject([
      { id: 'primeiro', etapa: 'negociacao', banco: 'Banco A', previsao: '2026-12-10', documentos: [{ tipo: 'cliente' }] },
      { id: 'segundo', etapa: 'recebido', dataOperacao: '2026-11-12', previsao: null, documentos: [] },
    ])
    expect(operacoes?.[0].etapas.map((e) => e.id)).not.toContain('documentacao_recebida')
    expect(fake.listarVeiculos).toHaveBeenCalledWith('portalQuitacaoChave', '==', compraQuitacao(veiculo)?.chave)

    fake.cliente.mockResolvedValueOnce({ documento: fake.documento, cadastro: { modulos: [] } })
    expect(await listarQuitacoesCliente()).toBeNull()
    expect(fake.listarVeiculos).toHaveBeenCalledTimes(1)
  })

  it('guarda as etapas que não se aplicam e ignora ids inexistentes ou a etapa atual', async () => {
    const compra = compraQuitacao(veiculo)!
    fake.getAll.mockResolvedValueOnce([fake.snap(veiculo), fake.snap({})])
    await atualizarAcompanhamento('veiculo', 'negociacao', 'funcionario', ETAPAS_PADRAO, {
      vinculo: compra.vinculo, arquivos: [], naoAplicaveis: ['documentacao_recebida', 'negociacao', 'inexistente'],
    })
    expect(fake.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      portalAcompanhamento: expect.objectContaining({ etapa: 'negociacao', naoAplicaveis: ['documentacao_recebida'] }),
    }), expect.anything())
  })

  it('recusa etapa que não existe na configuração', async () => {
    const compra = compraQuitacao(veiculo)!
    fake.getAll.mockResolvedValueOnce([fake.snap(veiculo), fake.snap({})])
    await expect(atualizarAcompanhamento('veiculo', 'inventada', 'funcionario', ETAPAS_PADRAO, { vinculo: compra.vinculo, arquivos: [] }))
      .rejects.toThrow('Etapa inexistente.')
  })

  it('monta a linha do tempo sem etapas que não se aplicam, mantendo as já usadas', () => {
    const inativas = ETAPAS_PADRAO.map((e) => (e.id === 'finalizacao_documental' ? { ...e, ativa: false } : e))
    const ids = (lista: ReturnType<typeof etapasDaOperacao>) => lista.map((e) => e.id)
    expect(ids(etapasDaOperacao(inativas, 'recebido', [], ['documentacao_recebida']))).not.toContain('documentacao_recebida')
    expect(ids(etapasDaOperacao(inativas, 'recebido', [], []))).not.toContain('finalizacao_documental')
    expect(ids(etapasDaOperacao(inativas, 'recebido', [{ etapa: 'finalizacao_documental', em: '2026-11-12' }], [])))
      .toContain('finalizacao_documental')
  })
})
