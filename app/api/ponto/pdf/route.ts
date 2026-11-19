import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { assertPageAccess } from '@/utils/permissions'
import { getFolhaMes } from '@/app/dashboard/ponto/actions'
import FolhaPontoDocument from '@/app/dashboard/ponto/pdf/FolhaPontoDocument'

export async function GET(req: NextRequest) {
  try {
    await assertPageAccess('ponto')
  } catch {
    return new NextResponse('Acesso negado.', { status: 403 })
  }

  const mes = req.nextUrl.searchParams.get('mes') ?? ''
  const uid = req.nextUrl.searchParams.get('uid') ?? ''
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || !uid) {
    return new NextResponse('Parâmetros inválidos.', { status: 400 })
  }

  const folha = await getFolhaMes(mes, uid)
  const func = folha.funcionarios.find((f) => f.uid === uid)
  if (!func) return new NextResponse('Funcionário não encontrado.', { status: 404 })

  const pdf = await renderToBuffer(
    createElement(FolhaPontoDocument, {
      nome: func.nome,
      mes,
      registros: folha.registros,
      jornadaMin: func.jornadaMin,
      diasEspeciais: folha.diasEspeciais.filter((d) => d.uid === uid).map((d) => ({ data: d.data, tipo: d.tipo, nome: d.nome })),
    }) as Parameters<typeof renderToBuffer>[0],
  )

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="folha-ponto-${mes}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
