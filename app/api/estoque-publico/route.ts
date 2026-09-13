import { NextResponse } from 'next/server'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import { toPublicVeiculo } from '@/app/dashboard/veiculos/public'

export const dynamic = 'force-dynamic'

/**
 * Endpoint público (sem autenticação) com um resumo do estoque disponível.
 * Consumido pelo site da Liberty (sistema de locação, localiberty.com) para
 * mostrar "Escolha um carro do nosso estoque" — os dois são negócios
 * diferentes da mesma empresa. Só expõe campos já considerados seguros pra
 * exibição pública (ver toPublicVeiculo em dashboard/veiculos/public.ts):
 * nada de CPF, dados do vendedor, financiamento ou débitos.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit')) || 6, 24)

  const todosVeiculos = await getVehicles()
  const disponiveis = todosVeiculos
    .filter((v) => v.publico === true && !v.vendidoEm)
    .map(toPublicVeiculo)

  const resumo = disponiveis.slice(0, limit).map((v) => ({
    id: v.id,
    marca: v.marca,
    modelo: v.modelo,
    ano: v.ano,
    preco: v.preco,
    precoComDesconto: v.precoComDesconto,
    quilometragem: v.quilometragem,
    cambio: v.cambio,
    foto: v.fotos?.[0] ?? null,
    url: `https://www.grupolibertycar.com.br/veiculos/${v.id}`,
  }))

  return NextResponse.json(
    { veiculos: resumo, total: disponiveis.length },
    {
      headers: {
        // Público e de baixa sensibilidade — cacheável por alguns minutos.
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
      },
    },
  )
}
