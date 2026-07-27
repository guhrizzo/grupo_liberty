'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'

// ─── Types ───────────────────────────────────────────────────────────────────

export type TipoCobranca = 'aluguel' | 'promissoria'
export type StatusParcela = 'pendente' | 'pago' | 'atrasado'

export interface Parcela {
  id: string
  cobrancaId: string
  numeroParcela: number
  valorParcela: number
  dataVencimento: string // YYYY-MM-DD
  status: StatusParcela
  pago: boolean
  pagoEm: string | null
}

export interface Cobranca {
  id: string
  clienteNome: string
  veiculoId: string
  veiculoResumo: string
  valorTotal: number
  numeroParcelas: number
  diaVencimento: number
  tipo: TipoCobranca
  criadoEm: string
  criadoPorUid: string | null
  parcelas: Parcela[]
}

export type CobrancaResponse = {
  success?: string
  error?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

function computeStatus(dataVencimento: string, pago: boolean): StatusParcela {
  if (pago) return 'pago'
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const venc = new Date(dataVencimento + 'T00:00:00')
  return venc < hoje ? 'atrasado' : 'pendente'
}

function serializeParcela(id: string, data: FirebaseFirestore.DocumentData): Parcela {
  const pago = Boolean(data.pago)
  return {
    id,
    cobrancaId: data.cobrancaId,
    numeroParcela: data.numeroParcela,
    valorParcela: data.valorParcela,
    dataVencimento: data.dataVencimento,
    status: computeStatus(data.dataVencimento, pago),
    pago,
    pagoEm: data.pagoEm ?? null,
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getCobrancas(): Promise<Cobranca[]> {
  const [cobrancasSnap, parcelasSnap] = await Promise.all([
    adminDb.collection('cobrancas').orderBy('criadoEm', 'desc').get(),
    adminDb.collection('cobranca_parcelas').orderBy('numeroParcela', 'asc').get(),
  ])

  const parcelasPorCobranca = new Map<string, Parcela[]>()
  for (const doc of parcelasSnap.docs) {
    const p = serializeParcela(doc.id, doc.data())
    const list = parcelasPorCobranca.get(p.cobrancaId) ?? []
    list.push(p)
    parcelasPorCobranca.set(p.cobrancaId, list)
  }

  return cobrancasSnap.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      clienteNome: data.clienteNome,
      veiculoId: data.veiculoId,
      veiculoResumo: data.veiculoResumo,
      valorTotal: data.valorTotal,
      numeroParcelas: data.numeroParcelas,
      diaVencimento: data.diaVencimento,
      tipo: data.tipo,
      criadoEm: data.criadoEm,
      criadoPorUid: data.criadoPorUid ?? null,
      parcelas: parcelasPorCobranca.get(doc.id) ?? [],
    }
  })
}

export async function criarCobranca(formData: FormData): Promise<CobrancaResponse> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('session')?.value
    let uid: string | null = null
    if (session) {
      try {
        const decoded = await adminAuth.verifySessionCookie(session, true)
        uid = decoded.uid
      } catch {}
    }

    const clienteNome = (formData.get('clienteNome') as string || '').trim()
    const veiculoId = (formData.get('veiculoId') as string || '').trim()
    const veiculoResumo = (formData.get('veiculoResumo') as string || '').trim()
    const valorTotal = parseFloat(formData.get('valorTotal') as string || '0')
    const numeroParcelas = parseInt(formData.get('numeroParcelas') as string || '1', 10)
    const diaVencimento = parseInt(formData.get('diaVencimento') as string || '1', 10)
    const tipo = (formData.get('tipo') as string || 'promissoria') as TipoCobranca
    const primeiraParcela = (formData.get('primeiraParcela') as string || '').trim()

    if (!clienteNome) return { error: 'Informe o nome do cliente.' }
    if (!veiculoId) return { error: 'Selecione um veículo.' }
    if (isNaN(valorTotal) || valorTotal <= 0) return { error: 'Valor total inválido.' }
    if (isNaN(numeroParcelas) || numeroParcelas < 1 || numeroParcelas > 120) return { error: 'Número de parcelas inválido (1–120).' }
    if (!primeiraParcela) return { error: 'Informe a data da primeira parcela.' }

    const valorParcela = Math.round((valorTotal / numeroParcelas) * 100) / 100

    // Criar documento da cobrança
    const cobrancaRef = await adminDb.collection('cobrancas').add({
      clienteNome,
      veiculoId,
      veiculoResumo,
      valorTotal,
      numeroParcelas,
      diaVencimento,
      tipo,
      criadoEm: new Date().toISOString(),
      criadoPorUid: uid,
    })

    // Gerar parcelas
    const batch = adminDb.batch()
    const baseDate = new Date(primeiraParcela + 'T12:00:00')

    for (let i = 0; i < numeroParcelas; i++) {
      let dataVencimento: string

      if (tipo === 'aluguel') {
        // Semanal: +7 dias por parcela
        dataVencimento = toDateString(addWeeks(baseDate, i))
      } else {
        // Mensal: mesmo dia do mês, avança meses
        const d = addMonths(baseDate, i)
        // Forçar o dia de vencimento (caso o mês tenha menos dias, usa o último dia)
        const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        d.setDate(Math.min(diaVencimento, ultimoDia))
        dataVencimento = toDateString(d)
      }

      const parcelaRef = adminDb.collection('cobranca_parcelas').doc()
      batch.set(parcelaRef, {
        cobrancaId: cobrancaRef.id,
        numeroParcela: i + 1,
        valorParcela,
        dataVencimento,
        pago: false,
        pagoEm: null,
      })
    }

    await batch.commit()
    revalidatePath('/dashboard/cobrancas')
    return { success: 'Cobrança cadastrada com sucesso!' }
  } catch (err: any) {
    console.error('[criarCobranca]', err)
    return { error: 'Erro ao salvar. Tente novamente.' }
  }
}

export async function toggleParcela(
  parcelaId: string,
  pago: boolean
): Promise<CobrancaResponse> {
  try {
    await adminDb.collection('cobranca_parcelas').doc(parcelaId).update({
      pago,
      pagoEm: pago ? new Date().toISOString() : null,
    })
    revalidatePath('/dashboard/cobrancas')
    return { success: 'Status atualizado.' }
  } catch (err: any) {
    console.error('[toggleParcela]', err)
    return { error: 'Erro ao atualizar parcela.' }
  }
}

export async function deletarCobranca(cobrancaId: string): Promise<CobrancaResponse> {
  try {
    // Excluir todas as parcelas
    const parcelasSnap = await adminDb
      .collection('cobranca_parcelas')
      .where('cobrancaId', '==', cobrancaId)
      .get()

    const batch = adminDb.batch()
    for (const doc of parcelasSnap.docs) {
      batch.delete(doc.ref)
    }
    batch.delete(adminDb.collection('cobrancas').doc(cobrancaId))
    await batch.commit()

    revalidatePath('/dashboard/cobrancas')
    return { success: 'Cobrança removida.' }
  } catch (err: any) {
    console.error('[deletarCobranca]', err)
    return { error: 'Erro ao remover cobrança.' }
  }
}
