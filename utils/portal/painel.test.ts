import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VinculosCliente from '@/app/area-do-cliente/(painel)/VinculosCliente'

const { clienteAutenticado, consultar, buscarVeiculos } = vi.hoisted(() => ({
  clienteAutenticado: vi.fn(),
  consultar: vi.fn(),
  buscarVeiculos: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('./acesso', () => ({ clienteAutenticado }))
vi.mock('@/utils/firebase/admin', () => ({
  adminDb: {
    collection: (nome: string) => ({
      where: (campo: string, operador: string, documentos: string[]) => ({
        get: () => consultar(nome, campo, operador, documentos),
      }),
      doc: (id: string) => ({ id }),
    }),
    getAll: buscarVeiculos,
  },
}))

function registro(id: string, campos: Record<string, unknown>) {
  return { id, campos, get: (campo: string) => campos[campo] }
}

const contratos = [
  registro('contrato-teste', { portalDocumento: '529.982.247-25', categoriaNome: 'Contrato de compra e venda', veiculoId: 'veiculo-teste' }),
  registro('contrato-outro', { portalDocumento: '123.456.789-09', categoriaNome: 'Contrato de outro cliente', veiculoId: 'veiculo-outro' }),
]

describe('abas de veículos e contratos do portal', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    clienteAutenticado.mockResolvedValue({ documento: '52998224725', nome: 'Cliente de teste', cadastro: { modulos: [] } })
    consultar.mockImplementation(async (colecao: string, campo: string, operador: string, documentos: string[]) => ({
      docs: colecao === 'veiculo_contratos' && operador === 'in'
        ? contratos.filter((contrato) => documentos.includes(String(contrato.get(campo))))
        : [],
    }))
    buscarVeiculos.mockResolvedValue([registro('veiculo-teste', { marca: 'Honda', modelo: 'Civic', ano: 2022, fotos: ['/civic-2022-teste.webp'] })])
  })

  it('exibe o veículo vinculado na aba Meus veículos', async () => {
    const html = renderToStaticMarkup(await VinculosCliente({ secao: 'veiculos' }))
    expect(html).toContain('Meus veículos')
    expect(html).toContain('Honda Civic 2022')
    expect(html).toContain('src="/civic-2022-teste.webp"')
    expect(html).not.toContain('Nenhum veículo vinculado')
    expect(buscarVeiculos).toHaveBeenCalledExactlyOnceWith({ id: 'veiculo-teste' })
  })

  it('exibe o contrato e o veículo na segunda aba, excluindo o contrato de outro cadastro', async () => {
    const html = renderToStaticMarkup(await VinculosCliente({ secao: 'registros' }))
    expect(html).toContain('Contratos e operações')
    expect(html).toContain('Contrato de compra e venda')
    expect(html).toContain('Honda Civic 2022')
    expect(html).not.toContain('Contrato de outro cliente')
    expect(html).not.toContain('Nenhum contrato ou operação vinculado')
  })
})
