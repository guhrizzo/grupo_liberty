import { describe, expect, it } from 'vitest'
import { distanciaMetros, lerLocalEmpresa, verificarLocal } from './geo'

const empresa = { lat: -23.55052, lng: -46.633308, raioM: 200 }

describe('distância', () => {
  it('é zero no mesmo ponto', () => {
    expect(distanciaMetros(empresa, empresa)).toBe(0)
  })
  it('~111 m por 0,001° de latitude', () => {
    const d = distanciaMetros(empresa, { lat: empresa.lat + 0.001, lng: empresa.lng })
    expect(d).toBeGreaterThan(110)
    expect(d).toBeLessThan(112)
  })
})

describe('local da empresa (env)', () => {
  it('lê coordenadas, aceita vírgula e usa raio padrão', () => {
    expect(lerLocalEmpresa({ PONTO_EMPRESA_LAT: '-23,55', PONTO_EMPRESA_LNG: '-46.63' })).toEqual({
      lat: -23.55,
      lng: -46.63,
      raioM: 200,
    })
    expect(lerLocalEmpresa({ PONTO_EMPRESA_LAT: '-23.55', PONTO_EMPRESA_LNG: '-46.63', PONTO_RAIO_M: '150' })?.raioM).toBe(150)
  })
  it('retorna null quando falta ou é inválido', () => {
    expect(lerLocalEmpresa({})).toBeNull()
    expect(lerLocalEmpresa({ PONTO_EMPRESA_LAT: 'abc', PONTO_EMPRESA_LNG: '-46' })).toBeNull()
    expect(lerLocalEmpresa({ PONTO_EMPRESA_LAT: '95', PONTO_EMPRESA_LNG: '-46' })).toBeNull()
  })
})

describe('verificação de local', () => {
  it('libera dentro do raio', () => {
    const r = verificarLocal(empresa, { lat: empresa.lat + 0.0005, lng: empresa.lng, precisaoM: 20 })
    expect(r.ok).toBe(true)
  })
  it('bloqueia fora do raio', () => {
    const r = verificarLocal(empresa, { lat: empresa.lat + 0.01, lng: empresa.lng, precisaoM: 20 })
    expect(r.ok).toBe(false)
  })
  it('bloqueia GPS impreciso mesmo estando perto', () => {
    expect(verificarLocal(empresa, { lat: empresa.lat, lng: empresa.lng, precisaoM: 800 }).ok).toBe(false)
    expect(verificarLocal(empresa, { lat: empresa.lat, lng: empresa.lng, precisaoM: undefined }).ok).toBe(false)
  })
  it('bloqueia coordenadas inválidas', () => {
    expect(verificarLocal(empresa, { lat: 'x', lng: 1, precisaoM: 10 }).ok).toBe(false)
    expect(verificarLocal(empresa, { lat: NaN, lng: 1, precisaoM: 10 }).ok).toBe(false)
  })
})
