import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const placaRaw = searchParams.get('placa')

  if (!placaRaw) {
    return NextResponse.json({ error: 'Placa não informada.' }, { status: 400 })
  }

  const placa = placaRaw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (placa.length !== 7) {
    return NextResponse.json({ error: 'Placa com formato inválido. Use 7 caracteres.' }, { status: 400 })
  }

  const apiKey = process.env.PLACA_FIPE_API_KEY || process.env.NEXT_PUBLIC_PLACA_FIPE_API_KEY

  // Se houver uma chave de API configurada no .env.local
  if (apiKey) {
    try {
      // Exemplo de integração com placafipe / apiplacas
      const apiRes = await fetch(`https://api.placafipe.com.br/v1/consulta?placa=${placa}&token=${apiKey}`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        next: { revalidate: 86400 }, // Cache de 24h
      })

      if (!apiRes.ok) {
        if (apiRes.status === 404) {
          return NextResponse.json({ error: 'Veículo não encontrado para a placa informada.' }, { status: 404 })
        }
        return NextResponse.json({ error: 'Erro ao consultar o provedor de placa.' }, { status: apiRes.status })
      }

      const raw = await apiRes.json()

      // Normalizar resposta
      const result = {
        placa: raw.placa || placa,
        marca: raw.marca || raw.MARCA || '',
        modelo: raw.modelo || raw.MODELO || '',
        anoFabricacao: String(raw.ano || raw.anoFabricacao || ''),
        anoModelo: String(raw.anoModelo || raw.ano || ''),
        cor: raw.cor || raw.COR || 'Não informada',
        combustivel: raw.combustivel || raw.extra?.combustivel || 'Flex',
        municipio: raw.municipio || raw.extra?.municipio || '',
        uf: raw.uf || raw.extra?.uf || 'SP',
        valorFipe: Number(raw.valorFipe || raw.fipe?.valor || raw.fipe?.veiculos?.[0]?.valor || 0),
        codigoFipe: raw.codigoFipe || raw.fipe?.codigo || raw.fipe?.veiculos?.[0]?.codigo_fipe || '',
        referenciaFipe: raw.referenciaFipe || 'Atual',
      }

      return NextResponse.json(result)
    } catch (err) {
      console.error('[consulta-placa] Erro na requisição externa:', err)
      return NextResponse.json({ error: 'Falha na comunicação com o serviço FIPE.' }, { status: 500 })
    }
  }

  // Chave de API não configurada
  return NextResponse.json(
    { error: 'api_key_missing', message: 'Aguardando chave de API' },
    { status: 503 }
  )
}
