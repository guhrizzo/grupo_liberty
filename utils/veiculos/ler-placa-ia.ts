import 'server-only'
import { extrairPlaca } from './placa-ocr'

// Lê a placa de uma foto com o Claude (API da Anthropic). Chamado pela rota
// /api/ler-placa, que faz a autenticação. A chave fica só no servidor.

// Sonnet: o Haiku se perdia na marca d'água holográfica da placa Mercosul
// (leu JSW4129 numa LSN4I49); o Sonnet acertou em todos os testes.
const MODELO = 'claude-sonnet-5-5'
const API_URL = 'https://api.anthropic.com/v1/messages'

const PROMPT = `Leia a placa de veículo brasileiro nesta foto.
Formato: 3 LETRAS, 1 DÍGITO, 1 LETRA ou DÍGITO, 2 DÍGITOS (antiga ABC1234; Mercosul ABC1D23).
Atenção: placas Mercosul têm uma marca d'água holográfica com as palavras "MERCOSUL" e "BRASIL" escritas por cima dos caracteres — ignore essa marca d'água e leia só os caracteres grandes pretos. Ignore também "BRASIL", "BR", a bandeira e o nome da cidade.
Na 5ª posição, a letra I e o número 1 são diferentes: o I da placa é uma barra reta com serifas em cima e embaixo.
Responda SOMENTE com os 7 caracteres, sem traço nem espaço. Se não houver placa legível, responda NENHUMA.`

export type LerPlacaResultado =
  | { ok: true; placa: string }
  | { ok: false; status: number; error: string; code?: 'key_missing' | 'nao_lida' }

export async function lerPlacaComIA(imagemBase64: string, mediaType: string): Promise<LerPlacaResultado> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { ok: false, status: 503, error: 'Leitura por câmera não configurada (falta ANTHROPIC_API_KEY).', code: 'key_missing' }
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODELO,
      // Folga: com 20 o Sonnet às vezes voltava sem texto.
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imagemBase64 } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const corpo = await res.text().catch(() => '')
    console.error('[lerPlacaComIA]', res.status, corpo.slice(0, 500))
    return { ok: false, status: 502, error: 'Não foi possível ler a placa agora. Tente de novo ou digite.' }
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] }
  const texto = (data.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('\n')
  // A resposta passa pela mesma checagem do formato de placa.
  const placa = extrairPlaca(texto)
  if (!placa) {
    return {
      ok: false,
      status: 422,
      error: 'Não consegui ler a placa. Tire a foto mais de perto, com a placa reta e bem iluminada, ou digite.',
      code: 'nao_lida',
    }
  }
  return { ok: true, placa }
}
