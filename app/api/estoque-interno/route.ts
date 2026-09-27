import { NextResponse } from 'next/server'
import { listarVeiculos } from '@/utils/veiculos/listar'
import { toPublicVeiculo } from '@/app/dashboard/veiculos/public'

export const dynamic = 'force-dynamic'

/**
 * Endpoint interno (autenticado por token) com TODO o estoque cadastrado
 * em dashboard/veiculos — inclusive veículos privados (toggle Público/
 * Privado desligado), que /api/estoque-publico não mostra. Consumido pelo
 * sistema de locação (liberty-sistema, outro negócio da mesma empresa) na
 * importação de veículo pro cadastro: um veículo pode estar marcado como
 * privado (não anunciado pra venda no site) e ainda assim ser candidato a
 * entrar na frota de locação — o toggle "Público" é sobre visibilidade de
 * anúncio de venda, não sobre o que a Liberty (locação) pode usar.
 *
 * Protegido por ESTOQUE_INTERNO_TOKEN — mesmo padrão de CRON_SECRET (ver
 * app/api/cron/*\/route.ts): header `Authorization: Bearer <token>`.
 */
export async function GET(request: Request) {
  const token = process.env.ESTOQUE_INTERNO_TOKEN
  const authHeader = request.headers.get('authorization')
  if (!token || authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const todosVeiculos = await listarVeiculos()
  // Só exclui vendidos — um veículo já vendido não é mais da Liberty, não
  // faz sentido importar pra frota de locação. Ao contrário de
  // /api/estoque-publico, `publico` NÃO filtra aqui.
  const disponiveis = todosVeiculos.filter((v) => !v.vendidoEm).map(toPublicVeiculo)

  const resumo = disponiveis.map((v) => ({
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
    terceiro: v.terceiro,
  }))

  return NextResponse.json(
    { veiculos: resumo, total: resumo.length },
    {
      // Autenticado e potencialmente inclui veículos privados — nunca cacheável
      // por um CDN/proxy compartilhado, ao contrário do endpoint público.
      headers: { 'Cache-Control': 'private, no-store' },
    },
  )
}
