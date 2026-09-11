import { NextRequest, NextResponse } from 'next/server'
import { consultarPlaca } from '@/utils/veiculos/consulta-placa'

export const dynamic = 'force-dynamic'

// ─── Consulta de placa pública (sem login) ──────────────────────────────────
// Usada só pelo formulário /anuncie-seu-veiculo, pra puxar marca/modelo/ano/
// cor/combustível/FIPE a partir da placa antes de enviar o anúncio.
//
// Diferente de /api/consulta-placa (uso interno, admin/vendedor), esta rota:
//  - não exige sessão — é protegida por rate-limit por IP (ver proxy.ts);
//  - devolve só o subconjunto de campos que o formulário público usa. Nunca
//    expõe chassi, roubo/furto, município/UF, código/referência FIPE,
//    histórico de preços ou logo — isso fica restrito à consulta interna.

export async function GET(request: NextRequest) {
  const placaRaw = request.nextUrl.searchParams.get('placa')

  if (!placaRaw) {
    return NextResponse.json({ error: 'Placa não informada.' }, { status: 400 })
  }

  const resultado = await consultarPlaca(placaRaw)

  if (!resultado.ok) {
    // Sem distinguir o motivo pro visitante — o form trata qualquer falha
    // (não encontrada, API fora, token ausente, etc.) como "cai pro manual".
    return NextResponse.json(
      { error: 'Não foi possível buscar os dados desta placa.' },
      { status: resultado.status },
    )
  }

  const { data } = resultado
  return NextResponse.json({
    marca: data.marca,
    modelo: data.modelo,
    anoFabricacao: data.anoFabricacao,
    anoModelo: data.anoModelo,
    cor: data.cor,
    combustivel: data.combustivel,
    valorFipe: data.valorFipe,
    renavam: data.renavam,
  })
}
