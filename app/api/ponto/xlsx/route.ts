import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { assertPageAccess } from '@/utils/permissions'
import { getFolhaMes } from '@/app/dashboard/ponto/actions'
import { formatarMinutos, horaSP, minutosTrabalhados, saldoDia } from '@/utils/ponto/calculo'

export async function GET(req: NextRequest) {
  try {
    await assertPageAccess('ponto')
  } catch {
    return new NextResponse('Acesso negado.', { status: 403 })
  }

  const mes = req.nextUrl.searchParams.get('mes') ?? ''
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return new NextResponse('Mês inválido.', { status: 400 })

  let folha
  try {
    folha = await getFolhaMes(mes, null)
  } catch (err) {
    return new NextResponse(err instanceof Error ? err.message : 'Folha indisponível.', { status: 502 })
  }
  const registros = [...folha.todos].sort(
    (a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.data.localeCompare(b.data),
  )

  const resumo = [
    ['Funcionário', 'E-mail', 'Jornada/dia', 'Dias completos', 'Dias incompletos', 'Horas no mês', 'Saldo'],
    ...folha.funcionarios.map((f) => {
      const t = folha.totais.find((x) => x.uid === f.uid)
      return [
        f.nome,
        f.email,
        formatarMinutos(f.jornadaMin),
        t?.diasCompletos ?? 0,
        t?.diasIncompletos ?? 0,
        formatarMinutos(t?.trabalhadoMin ?? 0),
        formatarMinutos(t?.saldoMin ?? 0, true),
      ]
    }),
  ]

  const hora = (iso?: string) => (iso ? horaSP(iso) : '')
  const batidas = [
    ['Funcionário', 'Data', 'Entrada', 'Saída almoço', 'Volta almoço', 'Saída', 'Total', 'Saldo'],
    ...registros.map((r) => {
      const trab = minutosTrabalhados(r.batidas)
      const saldo = saldoDia(r.batidas, r.jornadaMin)
      return [
        r.nome,
        r.data.split('-').reverse().join('/'),
        hora(r.batidas.entrada),
        hora(r.batidas.saida_almoco),
        hora(r.batidas.volta_almoco),
        hora(r.batidas.saida),
        trab !== null ? formatarMinutos(trab) : 'incompleto',
        saldo !== null ? formatarMinutos(saldo, true) : '',
      ]
    }),
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'Resumo')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(batidas), 'Batidas')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="folha-ponto-${mes}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
