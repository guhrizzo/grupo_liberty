import { describe, expect, it } from 'vitest'
import { gerarTokenPonto, validarTokenPonto } from './token'
import {
  batidasEmOrdem,
  diasDoMes,
  formatarMinutos,
  isoDeDataHoraSP,
  minutosTrabalhados,
  proximaBatida,
  resumoMes,
  saldoDia,
} from './calculo'

const S = 'segredo-de-teste'
const T0 = 1_800_000_000_000

describe('token do QR', () => {
  it('aceita token da janela atual e da anterior', () => {
    const t = gerarTokenPonto(S, T0)
    expect(validarTokenPonto(t, S, T0)).toBe(true)
    expect(validarTokenPonto(t, S, T0 + 30_000)).toBe(true)
  })
  it('recusa token expirado (2+ janelas)', () => {
    const t = gerarTokenPonto(S, T0)
    expect(validarTokenPonto(t, S, T0 + 61_000)).toBe(false)
  })
  it('recusa token do futuro, adulterado, de outro segredo e lixo', () => {
    const t = gerarTokenPonto(S, T0 + 60_000)
    expect(validarTokenPonto(t, S, T0)).toBe(false)
    const ok = gerarTokenPonto(S, T0)
    expect(validarTokenPonto(ok.slice(0, -1) + (ok.endsWith('a') ? 'b' : 'a'), S, T0)).toBe(false)
    expect(validarTokenPonto(ok, 'outro', T0)).toBe(false)
    expect(validarTokenPonto(undefined, S, T0)).toBe(false)
    expect(validarTokenPonto('abc', S, T0)).toBe(false)
    expect(validarTokenPonto(ok, '', T0)).toBe(false)
  })
})

const dia = (e: string, sa: string, va: string, s: string) => ({
  entrada: isoDeDataHoraSP('2026-11-18', e)!,
  saida_almoco: isoDeDataHoraSP('2026-11-18', sa)!,
  volta_almoco: isoDeDataHoraSP('2026-11-18', va)!,
  saida: isoDeDataHoraSP('2026-11-18', s)!,
})

describe('cálculo de horas', () => {
  it('próxima batida segue a ordem fixa', () => {
    expect(proximaBatida({})).toBe('entrada')
    expect(proximaBatida({ entrada: 'x' })).toBe('saida_almoco')
    expect(proximaBatida({ entrada: 'x', saida_almoco: 'x', volta_almoco: 'x' })).toBe('saida')
    expect(proximaBatida({ entrada: 'x', saida_almoco: 'x', volta_almoco: 'x', saida: 'x' })).toBeNull()
  })
  it('soma manhã + tarde e calcula saldo', () => {
    const b = dia('08:00', '12:00', '13:00', '18:00')
    expect(minutosTrabalhados(b)).toBe(9 * 60)
    expect(saldoDia(b, 480)).toBe(60)
  })
  it('dia incompleto não tem total nem saldo', () => {
    const { saida, ...b } = dia('08:00', '12:00', '13:00', '18:00')
    void saida
    expect(minutosTrabalhados(b)).toBeNull()
    expect(saldoDia(b, 480)).toBeNull()
  })
  it('resumo do mês ignora dias incompletos nas horas e conta separado', () => {
    const { saida, ...incompleto } = dia('08:00', '12:00', '13:00', '18:00')
    void saida
    const r = resumoMes([
      { batidas: dia('08:00', '12:00', '13:00', '17:00'), jornadaMin: 480 },
      { batidas: dia('08:00', '12:00', '13:00', '16:30'), jornadaMin: 480 },
      { batidas: incompleto, jornadaMin: 480 },
      { batidas: {}, jornadaMin: 480 },
    ])
    expect(r).toEqual({ trabalhadoMin: 480 + 450, saldoMin: -30, diasCompletos: 2, diasIncompletos: 1 })
  })
  it('detecta batidas fora de ordem', () => {
    expect(batidasEmOrdem(dia('08:00', '12:00', '13:00', '18:00'))).toBe(true)
    expect(batidasEmOrdem(dia('08:00', '12:00', '11:00', '18:00'))).toBe(false)
  })
})

describe('formatação e datas', () => {
  it('formata minutos', () => {
    expect(formatarMinutos(510)).toBe('8h30')
    expect(formatarMinutos(15, true)).toBe('+0h15')
    expect(formatarMinutos(-60, true)).toBe('−1h00')
    expect(formatarMinutos(0, true)).toBe('0h00')
  })
  it('converte hora de São Paulo para UTC', () => {
    expect(isoDeDataHoraSP('2026-11-18', '08:00')).toBe('2026-11-18T11:00:00.000Z')
    expect(isoDeDataHoraSP('2026-11-18', '25:00')).toBeNull()
    expect(isoDeDataHoraSP('18/11/2026', '08:00')).toBeNull()
  })
  it('lista os dias do mês', () => {
    expect(diasDoMes('2026-02')).toHaveLength(28)
    expect(diasDoMes('2028-02')).toHaveLength(29)
    expect(diasDoMes('2026-11')[29]).toBe('2026-11-30')
  })
})
