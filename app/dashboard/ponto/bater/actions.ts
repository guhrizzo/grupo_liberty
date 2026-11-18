'use server'

import { headers } from 'next/headers'
import { adminDb } from '@/utils/firebase/admin'
import { ehUserAgentMobile } from '@/utils/ponto/dispositivo'
import { getSessionUser, type SessionUser } from '@/utils/permissions'
import { hojeSaoPaulo } from '@/utils/cobrancas/encargos'
import { validarTokenPonto } from '@/utils/ponto/token'
import { proximaBatida, horaSP } from '@/utils/ponto/calculo'
import { lerLocalEmpresa, verificarLocal } from '@/utils/ponto/geo'
import { getJornadaMin, segredoPonto, serializarRegistro } from '@/utils/ponto/registros'
import {
  COLECAO_PONTO,
  INTERVALO_MIN_ENTRE_BATIDAS_MS,
  type Batida,
  type OrigemBatida,
  type RegistroPonto,
} from '@/constants/ponto'

export type BaterPontoResultado =
  | { ok: true; batida: Batida; hora: string }
  | { ok: false; erro: string }

/** Registro do usuário logado para o dia de hoje (null se ainda não bateu). */
export async function getMeuDia(): Promise<RegistroPonto | null> {
  const user = await getSessionUser()
  if (!user) return null
  const data = hojeSaoPaulo()
  const snap = await adminDb.collection(COLECAO_PONTO).doc(`${user.uid}_${data}`).get()
  return snap.exists ? serializarRegistro(snap.id, snap.data()!) : null
}

/** Grava a próxima batida do dia numa transação (ordem fixa, sem duplicar). */
async function registrarProximaBatida(
  user: SessionUser,
  origem: OrigemBatida,
  distanciaM?: number,
): Promise<BaterPontoResultado> {
  try {
    const agora = new Date()
    const data = hojeSaoPaulo(agora)
    const jornadaMin = await getJornadaMin(user.uid)
    const ref = adminDb.collection(COLECAO_PONTO).doc(`${user.uid}_${data}`)

    return await adminDb.runTransaction<BaterPontoResultado>(async (tx) => {
      const snap = await tx.get(ref)
      const existente = snap.exists ? serializarRegistro(snap.id, snap.data()!) : null
      const batidas = existente?.batidas ?? {}

      const proxima = proximaBatida(batidas)
      if (!proxima) return { ok: false, erro: 'Seu ponto de hoje já está completo.' }

      const ultimo = Math.max(0, ...Object.values(batidas).map((v) => new Date(v).getTime()))
      if (ultimo && agora.getTime() - ultimo < INTERVALO_MIN_ENTRE_BATIDAS_MS) {
        return { ok: false, erro: 'Você acabou de bater o ponto. Aguarde alguns minutos para a próxima batida.' }
      }

      const iso = agora.toISOString()
      if (existente) {
        tx.update(ref, {
          [`batidas.${proxima}`]: iso,
          [`origens.${proxima}`]: origem,
          ...(distanciaM !== undefined ? { [`distancias.${proxima}`]: distanciaM } : {}),
        })
      } else {
        tx.set(ref, {
          uid: user.uid,
          email: user.email ?? '',
          nome: user.name ?? user.email ?? 'Usuário',
          data,
          mes: data.slice(0, 7),
          batidas: { [proxima]: iso },
          origens: { [proxima]: origem },
          distancias: distanciaM !== undefined ? { [proxima]: distanciaM } : {},
          jornadaMin,
          edicoes: [],
        })
      }
      return { ok: true, batida: proxima, hora: horaSP(iso) }
    })
  } catch (err) {
    console.error('[registrarProximaBatida]', err)
    return { ok: false, erro: 'Não foi possível registrar o ponto. Tente novamente.' }
  }
}

interface PosicaoInformada {
  lat: number
  lng: number
  precisaoM: number
}

/** Celular + dentro do raio da empresa. Usado pelo QR e pelo ponto digital. */
async function conferirCelularNaEmpresa(
  pos: PosicaoInformada,
): Promise<{ ok: true; distanciaM: number } | { ok: false; erro: string }> {
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

  const local = await conferirCelularNaEmpresa(pos)
  if (!local.ok) return { ok: false, erro: local.erro }
  return registrarProximaBatida(user, 'qr', local.distanciaM)
}

/** Ponto digital: sem QR, só a localização do celular dentro da empresa. */
export async function baterPontoDigital(pos: PosicaoInformada): Promise<BaterPontoResultado> {
  const user = await getSessionUser()
  if (!user) return { ok: false, erro: 'Você precisa estar logado para bater o ponto.' }

  const local = await conferirCelularNaEmpresa(pos)
  if (!local.ok) return { ok: false, erro: local.erro }
  return registrarProximaBatida(user, 'digital', local.distanciaM)
}

/** Se o ponto digital está configurado no servidor (para a tela mostrar ou esconder o botão). */
export async function pontoDigitalDisponivel(): Promise<boolean> {
  return lerLocalEmpresa(process.env) !== null
}
