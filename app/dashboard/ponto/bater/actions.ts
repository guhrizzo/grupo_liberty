'use server'

import { headers } from 'next/headers'
import { ehUserAgentMobile } from '@/utils/ponto/dispositivo'
import { getSessionUser, type SessionUser } from '@/utils/permissions'
import { validarTokenPonto } from '@/utils/ponto/token'
import { horaSP } from '@/utils/ponto/calculo'
import { lerLocalEmpresa, verificarLocal } from '@/utils/ponto/geo'
import { segredoPonto } from '@/utils/ponto/registros'
import { chamarFolhaUnica, registroDaFolhaUnica, ultimaBatida } from '@/utils/ponto/folha-unica'
import {
  podeBaterPonto,
  type Batida,
  type OrigemBatida,
  type RegistroPonto,
} from '@/constants/ponto'

export type BaterPontoResultado =
  | { ok: true; batida: Batida; hora: string }
  | { ok: false; erro: string }

/** Registro do usuário logado para o dia de hoje (null se ainda não bateu). Vem da folha única. */
export async function getMeuDia(): Promise<RegistroPonto | null> {
  const user = await getSessionUser()
  if (!user?.email || !podeBaterPonto(user.email)) return null
  const r = await chamarFolhaUnica<{ registro: RegistroPonto | null }>('meu_dia', { email: user.email })
  if (!r.ok) {
    console.error('[getMeuDia]', r.erro)
    return null
  }
  return r.registro ? registroDaFolhaUnica(r.registro) : null
}

/** Grava a próxima batida do dia na folha única (ordem, intervalo e duplicidade são validados lá). */
async function registrarProximaBatida(
  user: SessionUser,
  origem: OrigemBatida,
  distanciaM: number,
): Promise<BaterPontoResultado> {
  const r = await chamarFolhaUnica<{ registro: RegistroPonto | null }>('registrar', {
    email: user.email ?? '',
    nome: user.name ?? user.email ?? 'Usuário',
    origem,
    distanciaM,
  })
  if (!r.ok) return { ok: false, erro: r.erro }
  const ultima = r.registro ? ultimaBatida(r.registro) : null
  if (!ultima) return { ok: false, erro: 'Ponto registrado, mas não foi possível confirmar o horário. Confira a folha.' }
  return { ok: true, batida: ultima.batida, hora: horaSP(ultima.iso) }
}

interface PosicaoInformada {
  lat: number
  lng: number
  precisaoM: number
}

/** Funcionário autorizado + celular + dentro do raio. Usado pelo QR e pelo ponto digital. */
async function conferirCelularNaEmpresa(
  user: SessionUser,
  pos: PosicaoInformada,
): Promise<{ ok: true; distanciaM: number } | { ok: false; erro: string }> {
  if (!podeBaterPonto(user.email)) {
    return { ok: false, erro: 'Seu usuário não está autorizado a bater ponto.' }
  }
  if (!ehUserAgentMobile((await headers()).get('user-agent'))) {
    return { ok: false, erro: 'O ponto só pode ser batido pelo celular.' }
  }
  const local = lerLocalEmpresa(process.env)
  if (!local) {
    return { ok: false, erro: 'Ponto indisponível: a localização da empresa não está configurada.' }
  }
  return verificarLocal(local, { lat: pos?.lat, lng: pos?.lng, precisaoM: pos?.precisaoM })
}

/** Ponto pelo QR code: exige token de QR válido e o celular dentro da empresa. */
export async function baterPonto(token: string, pos: PosicaoInformada): Promise<BaterPontoResultado> {
  const user = await getSessionUser()
  if (!user) return { ok: false, erro: 'Você precisa estar logado para bater o ponto.' }

  let segredo: string
  try {
    segredo = segredoPonto()
  } catch {
    return { ok: false, erro: 'Ponto indisponível: configuração do servidor incompleta.' }
  }
  if (!validarTokenPonto(token, segredo)) {
    return { ok: false, erro: 'QR expirado. Escaneie o QR code da tela novamente.' }
  }

  const local = await conferirCelularNaEmpresa(user, pos)
  if (!local.ok) return { ok: false, erro: local.erro }
  return registrarProximaBatida(user, 'qr', local.distanciaM)
}

/** Ponto digital: sem QR, só a localização do celular dentro da empresa. */
export async function baterPontoDigital(pos: PosicaoInformada): Promise<BaterPontoResultado> {
  const user = await getSessionUser()
  if (!user) return { ok: false, erro: 'Você precisa estar logado para bater o ponto.' }

  const local = await conferirCelularNaEmpresa(user, pos)
  if (!local.ok) return { ok: false, erro: local.erro }
  return registrarProximaBatida(user, 'digital', local.distanciaM)
}

/** Se o ponto digital está configurado no servidor (para a tela mostrar ou esconder o botão). */
export async function pontoDigitalDisponivel(): Promise<boolean> {
  return lerLocalEmpresa(process.env) !== null
}
