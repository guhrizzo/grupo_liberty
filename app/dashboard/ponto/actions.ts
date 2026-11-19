'use server'

import { revalidatePath } from 'next/cache'
import { assertPageAccess } from '@/utils/permissions'
import { hojeSaoPaulo } from '@/utils/cobrancas/encargos'
import { isoDeDataHoraSP, resumoMes } from '@/utils/ponto/calculo'
import { chamarFolhaUnica, registroDaFolhaUnica } from '@/utils/ponto/folha-unica'
import { BATIDAS, JORNADA_MIN_MAXIMA, type Batida, type RegistroPonto } from '@/constants/ponto'

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
  /** Registros de todos os funcionários no mês (usado pela exportação em Excel). */
  todos: RegistroPonto[]
}

export type AcaoPontoResposta = { ok: true } | { ok: false; erro: string }

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Folha do mês, lida da folha única (liberty-sistema). O `uid` de cada
 * funcionário aqui é o e-mail, que é a identidade comum aos dois sistemas.
 * Totais de todos e o detalhe dia a dia do funcionário `uid`.
 */
export async function getFolhaMes(mes: string, uid: string | null): Promise<FolhaMes> {
  await assertPageAccess('ponto')
  if (!MES_RE.test(mes)) throw new Error('Mês inválido.')

  const r = await chamarFolhaUnica<{
    funcionarios: { email: string; nome: string; jornadaMin: number }[]
    registros: RegistroPonto[]
  }>('folha', { mes })
  if (!r.ok) throw new Error(r.erro)

  const funcionarios: FuncionarioPonto[] = r.funcionarios.map((f) => ({
    uid: f.email,
    nome: f.nome,
    email: f.email,
    jornadaMin: f.jornadaMin,
  }))
  const todos = r.registros.map(registroDaFolhaUnica)

  const porUid = new Map<string, RegistroPonto[]>()
  for (const reg of todos) porUid.set(reg.uid, [...(porUid.get(reg.uid) ?? []), reg])

  const totais: TotalFuncionarioMes[] = funcionarios.map((f) => ({
    uid: f.uid,
    ...resumoMes(porUid.get(f.uid) ?? []),
  }))

  const registros = uid ? (porUid.get(uid) ?? []).sort((a, b) => a.data.localeCompare(b.data)) : []
  return { mes, funcionarios, totais, registros, todos }
}

export async function salvarJornada(uid: string, minutos: number): Promise<AcaoPontoResposta> {
  const adm = await assertPageAccess('ponto').catch(() => null)
  if (!adm) return { ok: false, erro: 'Acesso negado.' }
  if (!uid || !Number.isInteger(minutos) || minutos < 30 || minutos > JORNADA_MIN_MAXIMA) {
    return { ok: false, erro: 'Jornada inválida (entre 0h30 e 16h).' }
  }
  const r = await chamarFolhaUnica('salvar_jornada', { email: uid, minutos, porEmail: adm.email ?? '' })
  if (!r.ok) return { ok: false, erro: r.erro }
  revalidatePath('/dashboard/ponto')
  return { ok: true }
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

  const r = await chamarFolhaUnica('editar', {
    email: uid,
    porEmail: adm.email ?? '',
    data,
    campo,
    hora: novo,
    motivo,
  })
  if (!r.ok) return { ok: false, erro: r.erro }
  revalidatePath('/dashboard/ponto')
  return { ok: true }
}
