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
  // Teto alto o bastante pra nunca cortar o estoque de verdade (o sistema
  // de locação, outro negócio da mesma empresa, importa "todos que estão em
  // estoque" pra cadastrar veículos) — quem não manda `limit` continua
  // recebendo só 6 (a vitrine "Escolha um carro do nosso estoque").
  const limit = Math.min(Number(searchParams.get('limit')) || 6, 500)

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
    // Veículo anunciado por terceiro (dono do carro), não é do estoque
    // próprio da Liberty — já exibido publicamente no site (badge "Anúncio
    // de terceiro" em PublicVehiclesList.tsx), então seguro repassar aqui.
    terceiro: v.terceiro,
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
