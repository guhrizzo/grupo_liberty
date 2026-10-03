import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser, isAdmSupremo } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import { getMetricas } from './financeiro/metricas'
import MetricasSection from './financeiro/MetricasSection'

export const metadata: Metadata = {
  title: 'Visão Geral | Liberty Car',
}

// Visão Geral = métricas da empresa (faturamento, custos, lucro, veículos e
// manutenções mês a mês). Exclusiva do ADM supremo; os demais caem em
// Demandas, que todos os cargos acessam.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ meses?: string | string[] }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!isAdmSupremo(user)) redirect('/dashboard/demandas')

  const { meses } = await searchParams
  const metricas = await getMetricas(Number(Array.isArray(meses) ? meses[0] : meses))

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Visão Geral' }]} />
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950 adobe-dark:text-adobe-text-hi">
          Visão Geral
        </h1>
        <p className="mt-1 text-sm text-neutral-500 adobe-dark:text-adobe-text-lo">
          Métricas da empresa mês a mês: faturamento, custos, lucro, veículos adquiridos e manutenções.
        </p>
      </div>
      {metricas && <MetricasSection metricas={metricas} />}
    </div>
  )
}
