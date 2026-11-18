// Geolocalização do ponto digital — funções puras (testáveis).

import { PRECISAO_MAX_M, RAIO_PONTO_M_PADRAO } from '@/constants/ponto'

export interface Coordenada {
  lat: number
  lng: number
}

export interface LocalEmpresa extends Coordenada {
  raioM: number
}

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function distanciaMetros(a: Coordenada, b: Coordenada): number {
  const R = 6_371_000
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function coordenadaValida(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  )
}

/** Lê a localização da empresa das variáveis de ambiente; null se não configurada. */
export function lerLocalEmpresa(env: Record<string, string | undefined>): LocalEmpresa | null {
  const lat = Number(env.PONTO_EMPRESA_LAT?.trim().replace(',', '.'))
  const lng = Number(env.PONTO_EMPRESA_LNG?.trim().replace(',', '.'))
  if (!env.PONTO_EMPRESA_LAT || !env.PONTO_EMPRESA_LNG || !coordenadaValida(lat, lng)) return null
  const raio = Number(env.PONTO_RAIO_M)
  return { lat, lng, raioM: Number.isFinite(raio) && raio > 0 ? raio : RAIO_PONTO_M_PADRAO }
}

export type VerificacaoLocal =
  | { ok: true; distanciaM: number }
  | { ok: false; erro: string }

/** Decide se a posição informada libera o ponto digital. */
export function verificarLocal(
  local: LocalEmpresa,
  pos: { lat: unknown; lng: unknown; precisaoM: unknown },
): VerificacaoLocal {
  if (!coordenadaValida(pos.lat, pos.lng)) return { ok: false, erro: 'Localização inválida.' }
  const precisao = typeof pos.precisaoM === 'number' && Number.isFinite(pos.precisaoM) ? pos.precisaoM : Infinity
  if (precisao > PRECISAO_MAX_M) {
    return { ok: false, erro: 'Sinal de GPS fraco. Vá para um local aberto e tente de novo.' }
  }
  const distanciaM = distanciaMetros(local, { lat: pos.lat as number, lng: pos.lng as number })
  if (distanciaM > local.raioM) {
    return { ok: false, erro: 'Você precisa estar na empresa para bater o ponto.' }
  }
  return { ok: true, distanciaM: Math.round(distanciaM) }
}
