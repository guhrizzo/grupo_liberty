import 'server-only'
import { adminDb } from '@/utils/firebase/admin'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface PuxaPlacaResult {
  placa: string
  marca: string
  modelo: string
  marcaModelo: string
  anoFabricacao: string
  anoModelo: string
  cor: string
  combustivel: string
  municipio: string
  uf: string
  especie: string
  tipo: string
  rouboFurto: string
  chassi: string
  renavam: string
  valorFipe: number
  codigoFipe: string
  referenciaFipe: string
  historicoPrecFipe: { valor: string; mesReferencia: string }[]
  logo?: string
  cachedAt?: string
  fromCache?: boolean
}

export type ConsultaPlacaResultado =
  | { ok: true; data: PuxaPlacaResult & { fromCache: boolean; cachedAt?: string } }
  | { ok: false; status: number; error: string; code?: 'token_missing' }

const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 horas

/**
 * Consulta dados de um veículo por placa (Sistema Puxa Placa), cache-first no
 * Firestore (`_cache_placa`, TTL 24h). Sem checagem de autenticação — quem
 * chama decide o gate (rota interna exige admin/vendedor; a rota pública usa
 * rate-limit em vez de login).
 *
 * Extraído de `app/api/consulta-placa/route.ts` para ser reaproveitado pela
 * rota pública de `/anuncie-seu-veiculo`, sem duplicar a lógica de cache e
 * normalização da resposta.
 */
export async function consultarPlaca(placaRaw: string): Promise<ConsultaPlacaResultado> {
  const placa = placaRaw.toUpperCase().replace(/[^A-Z0-9]/g, '')

  if (!PLACA_REGEX.test(placa)) {
    return {
      ok: false,
      status: 400,
      error: 'Formato de placa inválido. Use Mercosul (ABC1D23) ou antiga (ABC1234).',
    }
  }

  // 1. Verificar cache no Firestore
  const cacheRef = adminDb.collection('_cache_placa').doc(placa)
  try {
    const cached = await cacheRef.get()
    if (cached.exists) {
      const data = cached.data() as PuxaPlacaResult & { _cachedAt: number }
      const age = Date.now() - (data._cachedAt ?? 0)
      if (age < CACHE_TTL_MS) {
        const { _cachedAt, ...result } = data
        return {
          ok: true,
          data: { ...result, fromCache: true, cachedAt: new Date(_cachedAt).toISOString() },
        }
      }
    }
  } catch (err) {
    console.warn('[consulta-placa] Erro ao ler cache:', err)
    // Continua para a API externa
  }

  // 2. Verificar token da API
  const token = process.env.PUXA_PLACA_TOKEN
  if (!token) {
    return {
      ok: false,
      status: 503,
      error: 'Token do Puxa Placa não configurado.',
      code: 'token_missing',
    }
  }

  // 3. Chamar a API do Puxa Placa
  try {
    const apiRes = await fetch(`https://api.puxaplaca.app/v2/consulta/${placa}`, {
      headers: {
        token,
        Accept: 'application/json',
      },
      // Não usar cache do Next.js — o cache está no Firestore
      cache: 'no-store',
    })

    if (apiRes.status === 401) {
      return { ok: false, status: 502, error: 'Token do Puxa Placa inválido ou saldo insuficiente.' }
    }

    if (apiRes.status === 404) {
      return { ok: false, status: 404, error: 'Veículo não encontrado para a placa informada.' }
    }

    if (apiRes.status === 406) {
      return { ok: false, status: 400, error: 'Placa com formato inválido.' }
    }

    if (!apiRes.ok) {
      return { ok: false, status: 502, error: `Erro na API externa (status ${apiRes.status}).` }
    }

    const raw = await apiRes.json()

    // 4. Normalizar resposta
    const basico = raw.basico?.dados ?? {}
    const fipeList: any[] = raw.fipe?.dados ?? []
    const fipe = fipeList[0] ?? {}

    // Converter "R$ 85.000,00" → número
    const parseFipeValor = (s: string): number => {
      if (!s) return 0
      return parseFloat(s.replace(/[^0-9,]/g, '').replace(',', '.')) || 0
    }

    const result: PuxaPlacaResult = {
      placa,
      marca: basico.marca ?? '',
      modelo: basico.modelo ?? '',
      marcaModelo: basico.marcamodelo ?? '',
      anoFabricacao: String(basico.ano ?? ''),
      anoModelo: String(basico.anoModelo ?? basico.ano ?? ''),
      cor: basico.cor ?? '',
      combustivel: basico.combustivel ?? '',
      municipio: basico.municipio ?? '',
      uf: basico.uf ?? '',
      especie: basico.especie ?? '',
      tipo: basico.tipo ?? '',
      rouboFurto: basico.rouboFurto ?? raw.rouboFurto?.dados?.rouboFurto ?? 'NAO',
      chassi: raw.chassi?.dados?.chassi ?? '',
      renavam: raw.renavam?.dados?.renavam ?? '',
      valorFipe: parseFipeValor(fipe.valor),
      codigoFipe: fipe.codigo_fipe ?? '',
      referenciaFipe: fipe.mes_referencia ?? '',
      historicoPrecFipe: (fipe.historico ?? []).map((h: any) => ({
        valor: h.valor ?? '',
        mesReferencia: h.mes_referencia ?? '',
      })),
      logo: basico.logo ?? '',
    }

    // 5. Salvar no cache do Firestore
    try {
      await cacheRef.set({ ...result, _cachedAt: Date.now() })
    } catch (err) {
      console.warn('[consulta-placa] Erro ao salvar cache:', err)
    }

    return { ok: true, data: { ...result, fromCache: false } }
  } catch (err) {
    console.error('[consulta-placa] Erro na requisição externa:', err)
    return { ok: false, status: 500, error: 'Falha na comunicação com o Sistema Puxa Placa.' }
  }
}
