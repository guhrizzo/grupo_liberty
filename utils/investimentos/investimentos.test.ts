import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aplicarDelta, centavosInvestimento, deltaMovimento, formatarCentavosInvestimento, reverterDelta, totaisZerados } from './modelo'
import { carregarExtratoCliente } from './repositorio'

const { clienteAutenticado, consultarPosicao, consultarMovimentos } = vi.hoisted(() => ({
  clienteAutenticado: vi.fn(),
  consultarPosicao: vi.fn(),
  consultarMovimentos: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/utils/portal/acesso', () => ({ clienteAutenticado }))
vi.mock('@/utils/firebase/admin', () => ({
  adminDb: { collection: () => ({ doc: () => ({
    get: consultarPosicao,
    collection: () => ({ orderBy: () => ({ get: consultarMovimentos }) }),
  }) }) },
}))

describe('valores de investimento', () => {
  it('preserva centavos na entrada e na exibição do saldo', () => {
    expect(centavosInvestimento('1.234,56')).toBe(123456)
    expect(centavosInvestimento('1,234')).toBeNull()
    expect(centavosInvestimento('90.071.992.547.409,92')).toBeNull()
    expect(formatarCentavosInvestimento(-1)).toMatch(/^-R\$\s0,01$/)
    expect(formatarCentavosInvestimento(Number.MAX_SAFE_INTEGER)).toMatch(/90\.071\.992\.547\.409,91$/)
  })

  it('recusa saldo negativo e devolve o saldo anterior ao estornar um resgate', () => {
    const inicial = aplicarDelta(totaisZerados(), deltaMovimento('aporte', 1000)!)!
    expect(aplicarDelta(inicial, deltaMovimento('resgate', 1001)!)).toBeNull()
    const resgate = deltaMovimento('resgate', 250)!
    const aposResgate = aplicarDelta(inicial, resgate)!
    expect(aposResgate).toMatchObject({ saldo: 750, resgates: 250 })
    expect(aplicarDelta(aposResgate, reverterDelta(resgate))).toEqual(inicial)
  })
})

describe('extrato na Área do Cliente', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    consultarPosicao.mockResolvedValue({ data: () => ({ documento: 'titular', referencia: 'LIB-1' }) })
    consultarMovimentos.mockResolvedValue({ docs: [] })
  })

  it('exige autenticação e módulo habilitado antes de consultar a posição', async () => {
    clienteAutenticado.mockResolvedValueOnce(null).mockResolvedValueOnce({ documento: 'titular', cadastro: { modulos: [] } })
    expect(await carregarExtratoCliente('posicao')).toBeNull()
    expect(await carregarExtratoCliente('posicao')).toBeNull()
    expect(consultarPosicao).not.toHaveBeenCalled()
  })

  it('só consulta movimentações para o titular da posição', async () => {
    clienteAutenticado.mockResolvedValueOnce({ documento: 'outro', cadastro: { modulos: ['investimentos'] } })
    expect(await carregarExtratoCliente('posicao')).toBeNull()
    expect(consultarMovimentos).not.toHaveBeenCalled()

    clienteAutenticado.mockResolvedValueOnce({ documento: 'titular', cadastro: { modulos: ['investimentos'] } })
    expect(await carregarExtratoCliente('posicao')).toMatchObject({ referencia: 'LIB-1', movimentos: [] })
  })
})
