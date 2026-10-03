import 'server-only'
import { extrairPlaca } from './placa-ocr'

// Lê a placa de uma foto com o Claude (API da Anthropic). Chamado pela rota
// /api/ler-placa, que faz a autenticação. A chave fica só no servidor.

const MODELO = 'claude-haiku-4-5-20251001'
const API_URL = 'https://api.anthropic.com/v1/messages'

const PROMPT = `Esta foto deve mostrar a placa de um veículo brasileiro (padrão antigo ABC1234 ou Mercosul ABC1D23).
Leia os 7 caracteres da placa. Ignore "BRASIL", a bandeira, a cidade e qualquer outro texto do carro ou do fundo.
Responda SOMENTE com os 7 caracteres, sem traço nem espaço (ex.: ABC1D23). Se não houver placa legível, responda NENHUMA.`

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
      max_tokens: 20,
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
  const texto = (data.content ?? []).map((c) => c.text ?? '').join('\n')
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
