import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import { dayKey, monthKey } from '@/utils/analytics/dates'

export interface DiaSerie {
  date: string
  uniqueVisitors: number
  loggedVisitors: number
  pageviews: number
}

export interface VeiculoTop {
  id: string
  nome: string
  views: number
  existe: boolean
}

interface Totais {
  uniqueVisitors: number
  loggedVisitors: number
  pageviews: number
}

export interface AnalyticsOverview {
  hoje: Totais
  mes: Totais & { label: string }
  serie30: DiaSerie[]
  topVeiculos: VeiculoTop[]
  erro: boolean
}

const ZERO: Totais = { uniqueVisitors: 0, loggedVisitors: 0, pageviews: 0 }

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function totais(data: FirebaseFirestore.DocumentData | undefined): Totais {
  if (!data) return { ...ZERO }
  return {
    uniqueVisitors: num(data.uniqueVisitors),
    loggedVisitors: num(data.loggedVisitors),
    pageviews: num(data.pageviews),
  }
}

function labelMes(mes: string): string {
  const d = new Date(`${mes}-01T12:00:00Z`)
  const s = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const mesAtual = monthKey()
  try {
    const [dailySnap, mensalSnap, veiculosDiaSnap] = await Promise.all([
      adminDb
        .collection('analytics_daily')
        .orderBy('date', 'desc')
        .limit(30)
        .get(),
      adminDb.collection('analytics_monthly').doc(mesAtual).get(),
      adminDb
        .collection('analytics_vehicle_daily')
        .orderBy('date', 'desc')
        .limit(30)
        .get(),
    ])

    const serie30: DiaSerie[] = dailySnap.docs
      .map((doc) => {
        const d = doc.data()
        return {
          date: typeof d.date === 'string' ? d.date : doc.id,
          uniqueVisitors: num(d.uniqueVisitors),
          loggedVisitors: num(d.loggedVisitors),
          pageviews: num(d.pageviews),
        }
      })
      .reverse()

    const hojeKey = dayKey()
    const hoje = serie30.find((d) => d.date === hojeKey)
    const hojeTotais: Totais = hoje
      ? {
          uniqueVisitors: hoje.uniqueVisitors,
          loggedVisitors: hoje.loggedVisitors,
          pageviews: hoje.pageviews,
        }
      : { ...ZERO }

    const mes = { ...totais(mensalSnap.data()), label: labelMes(mesAtual) }

    // Soma as visualizações por veículo nos últimos 30 dias.
    const somaPorVeiculo = new Map<string, number>()
    for (const doc of veiculosDiaSnap.docs) {
      const views = doc.data().views
      if (views && typeof views === 'object') {
        for (const [id, n] of Object.entries(views as Record<string, unknown>)) {
          somaPorVeiculo.set(id, (somaPorVeiculo.get(id) ?? 0) + num(n))
        }
      }
    }

    const topIds = [...somaPorVeiculo.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    let topVeiculos: VeiculoTop[] = []
    if (topIds.length > 0) {
      const refs = topIds.map(([id]) =>
        adminDb.collection('veiculos').doc(id),
      )
      const docs = await adminDb.getAll(...refs)
      topVeiculos = topIds.map(([id, views], i) => {
        const doc = docs[i]
        const d = doc?.exists ? doc.data() : undefined
        if (d) {
          const nome = [d.marca, d.modelo, d.ano].filter(Boolean).join(' ').trim()
          return { id, views, nome: nome || 'Veículo sem nome', existe: true }
        }
        return { id, views, nome: 'Veículo removido', existe: false }
      })
    }

    return {
      hoje: hojeTotais,
      mes,
      serie30,
      topVeiculos,
      erro: false,
    }
  } catch (e) {
    console.error('[analytics/data]', e)
    return {
      hoje: { ...ZERO },
      mes: { ...ZERO, label: labelMes(mesAtual) },
      serie30: [],
      topVeiculos: [],
      erro: true,
    }
  }
}
