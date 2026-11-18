'use server'

import { revalidatePath } from 'next/cache'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { assertPageAccess } from '@/utils/permissions'
import { hojeSaoPaulo } from '@/utils/cobrancas/encargos'
import { batidasEmOrdem, isoDeDataHoraSP, resumoMes } from '@/utils/ponto/calculo'
import { getJornadaMin, serializarRegistro } from '@/utils/ponto/registros'
import {
  BATIDAS,
  COLECAO_PONTO,
  COLECAO_PONTO_CONFIG,
  JORNADA_MIN_MAXIMA,
  JORNADA_PADRAO_MIN,
  podeBaterPonto,
  type Batida,
  type Batidas,
  type EdicaoPonto,
  type RegistroPonto,
} from '@/constants/ponto'

export interface FuncionarioPonto {
  uid: string
  nome: string
  email: string
  jornadaMin: number
}

export interface TotalFuncionarioMes {
  uid: string
  trabalhadoMin: number
  saldoMin: number
  diasCompletos: number
  diasIncompletos: number
}

export interface FolhaMes {
  mes: string
  funcionarios: FuncionarioPonto[]
  totais: TotalFuncionarioMes[]
  /** Registros do funcionário selecionado no mês. */
  registros: RegistroPonto[]
}

export type AcaoPontoResposta = { ok: true } | { ok: false; erro: string }

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

/** Lista quem tem conta com cargo no sistema, com a jornada de cada um. */
async function listarFuncionarios(): Promise<FuncionarioPonto[]> {
  const [perfis, lista, configs] = await Promise.all([
    adminDb.collection('profiles').get(),
    adminAuth.listUsers(1000),
    adminDb.collection(COLECAO_PONTO_CONFIG).get(),
  ])
  const comCargo = new Set(perfis.docs.filter((d) => d.data().role).map((d) => d.id))
  const jornadas = new Map<string, number>()
  configs.forEach((d) => {
    const v = d.data().jornadaMin
    if (typeof v === 'number' && v > 0) jornadas.set(d.id, v)
  })
  return lista.users
    .filter((u) => comCargo.has(u.uid) && podeBaterPonto(u.email))
    .map((u) => ({
      uid: u.uid,
      nome: u.displayName || u.email || u.uid,
      email: u.email || '',
      jornadaMin: jornadas.get(u.uid) ?? JORNADA_PADRAO_MIN,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Folha do mês: totais de todos e o detalhe dia a dia do funcionário `uid`. */
export async function getFolhaMes(mes: string, uid: string | null): Promise<FolhaMes> {
  await assertPageAccess('ponto')
  if (!MES_RE.test(mes)) throw new Error('Mês inválido.')

  const [funcionarios, snap] = await Promise.all([
    listarFuncionarios(),
    adminDb.collection(COLECAO_PONTO).where('mes', '==', mes).get(),
  ])
  const todos = snap.docs.map((d) => serializarRegistro(d.id, d.data()))

  const porUid = new Map<string, RegistroPonto[]>()
  for (const r of todos) porUid.set(r.uid, [...(porUid.get(r.uid) ?? []), r])

  const totais: TotalFuncionarioMes[] = funcionarios.map((f) => ({
    uid: f.uid,
    ...resumoMes(porUid.get(f.uid) ?? []),
  }))

  const registros = uid ? (porUid.get(uid) ?? []).sort((a, b) => a.data.localeCompare(b.data)) : []
  return { mes, funcionarios, totais, registros }
}

export async function salvarJornada(uid: string, minutos: number): Promise<AcaoPontoResposta> {
  const adm = await assertPageAccess('ponto').catch(() => null)
  if (!adm) return { ok: false, erro: 'Acesso negado.' }
  if (!uid || !Number.isInteger(minutos) || minutos < 30 || minutos > JORNADA_MIN_MAXIMA) {
    return { ok: false, erro: 'Jornada inválida (entre 0h30 e 16h).' }
  }
  try {
    await adminDb.collection(COLECAO_PONTO_CONFIG).doc(uid).set(
      { jornadaMin: minutos, atualizadoEm: new Date().toISOString(), atualizadoPor: adm.email ?? adm.uid },
      { merge: true },
    )
    revalidatePath('/dashboard/ponto')
    return { ok: true }
  } catch (err) {
    console.error('[salvarJornada]', err)
    return { ok: false, erro: 'Não foi possível salvar a jornada.' }
  }
}

/**
 * Lança, corrige ou apaga (hora vazia) uma batida de um funcionário num dia.
 * Exige motivo e registra a edição no histórico do dia.
 */
export async function editarBatida(input: {
  uid: string
  data: string
  campo: Batida
  hora: string // "HH:mm" ou "" para apagar
  motivo: string
}): Promise<AcaoPontoResposta> {
  const adm = await assertPageAccess('ponto').catch(() => null)
  if (!adm) return { ok: false, erro: 'Acesso negado.' }

  const { uid, data, campo } = input
  const motivo = String(input.motivo ?? '').trim().slice(0, 300)
  if (!uid || !DATA_RE.test(data) || !BATIDAS.includes(campo)) return { ok: false, erro: 'Dados inválidos.' }
  if (data > hojeSaoPaulo()) return { ok: false, erro: 'Não é possível lançar ponto em data futura.' }
  if (motivo.length < 3) return { ok: false, erro: 'Informe o motivo da alteração.' }

  const novo = input.hora ? isoDeDataHoraSP(data, input.hora) : null
  if (input.hora && !novo) return { ok: false, erro: 'Horário inválido.' }

  try {
    const usuario = await adminAuth.getUser(uid)
    const jornadaMin = await getJornadaMin(uid)
    const ref = adminDb.collection(COLECAO_PONTO).doc(`${uid}_${data}`)

    const resultado = await adminDb.runTransaction<AcaoPontoResposta>(async (tx) => {
      const snap = await tx.get(ref)
      const atual = snap.exists ? serializarRegistro(snap.id, snap.data()!) : null
      const batidas: Batidas = { ...(atual?.batidas ?? {}) }
      const anterior = batidas[campo] ?? null
      if (novo) batidas[campo] = novo
      else delete batidas[campo]

      if (anterior === novo) return { ok: false, erro: 'Nada foi alterado.' }
      if (!batidasEmOrdem(batidas)) {
        return { ok: false, erro: 'Os horários precisam seguir a ordem: entrada, saída p/ almoço, volta, saída.' }
      }

      const edicao: EdicaoPonto = {
        porUid: adm.uid,
        porEmail: adm.email ?? '',
        em: new Date().toISOString(),
        campo,
        de: anterior,
        para: novo,
        motivo,
      }
      const edicoes = [...(atual?.edicoes ?? []), edicao]
      const origens = { ...(atual?.origens ?? {}) }
      const distancias = { ...(atual?.distancias ?? {}) }
      delete distancias[campo]
      if (novo) origens[campo] = 'manual'
      else delete origens[campo]
      if (atual) {
        tx.update(ref, { batidas, origens, distancias, edicoes })
      } else {
        tx.set(ref, {
          uid,
          email: usuario.email ?? '',
          nome: usuario.displayName || usuario.email || 'Usuário',
          data,
          mes: data.slice(0, 7),
          batidas,
          origens,
          distancias,
          jornadaMin,
          edicoes,
        })
      }
      return { ok: true }
    })
    if (resultado.ok) revalidatePath('/dashboard/ponto')
    return resultado
  } catch (err) {
    console.error('[editarBatida]', err)
    return { ok: false, erro: 'Não foi possível salvar a alteração.' }
  }
}
