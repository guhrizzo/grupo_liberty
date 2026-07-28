import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'

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

const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 horas
const ROLES_PERMITIDOS = ['admin', 'vendedor']

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // 1. Autenticação + autorização por role
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  if (!sessionCookie) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    const userRecord = await adminAuth.getUser(decoded.uid)
    const role = (userRecord.customClaims as any)?.role ?? ''

    if (!ROLES_PERMITIDOS.includes(role)) {
      return NextResponse.json(
        { error: 'Acesso restrito a admins e vendedores.' },
        { status: 403 },
      )
    }
  } catch {
    return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  }

  // 2. Validar placa
  const searchParams = request.nextUrl.searchParams
  const placaRaw = searchParams.get('placa')

  if (!placaRaw) {
    return NextResponse.json({ error: 'Placa não informada.' }, { status: 400 })
  }

  const placa = placaRaw.toUpperCase().replace(/[^A-Z0-9]/g, '')

  if (!PLACA_REGEX.test(placa)) {
    return NextResponse.json(
      { error: 'Formato de placa inválido. Use Mercosul (ABC1D23) ou antiga (ABC1234).' },
      { status: 400 },
    )
  }

  // 3. Verificar cache no Firestore
  const cacheRef = adminDb.collection('_cache_placa').doc(placa)
  try {
    const cached = await cacheRef.get()
    if (cached.exists) {
      const data = cached.data() as PuxaPlacaResult & { _cachedAt: number }
      const age = Date.now() - (data._cachedAt ?? 0)
      if (age < CACHE_TTL_MS) {
        const { _cachedAt, ...result } = data
        return NextResponse.json({
          ...result,
          fromCache: true,
          cachedAt: new Date(_cachedAt).toISOString(),
        })
      }
    }
  } catch (err) {
    console.warn('[consulta-placa] Erro ao ler cache:', err)
    // Continua para a API externa
  }

  // 4. Verificar token da API
  const token = process.env.PUXA_PLACA_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'token_missing', message: 'Token do Puxa Placa não configurado.' },
      { status: 503 },
    )
  }

  // 5. Chamar a API do Puxa Placa
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
      return NextResponse.json(
        { error: 'Token do Puxa Placa inválido ou saldo insuficiente.' },
        { status: 502 },
      )
    }

    if (apiRes.status === 404) {
      return NextResponse.json(
        { error: 'Veículo não encontrado para a placa informada.' },
        { status: 404 },
      )
    }

    if (apiRes.status === 406) {
      return NextResponse.json({ error: 'Placa com formato inválido.' }, { status: 400 })
    }

    if (!apiRes.ok) {
      return NextResponse.json(
        { error: `Erro na API externa (status ${apiRes.status}).` },
        { status: 502 },
      )
    }

    const raw = await apiRes.json()

    // 6. Normalizar resposta
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

    // 7. Salvar no cache do Firestore
    try {
      await cacheRef.set({ ...result, _cachedAt: Date.now() })
    } catch (err) {
      console.warn('[consulta-placa] Erro ao salvar cache:', err)
    }

    return NextResponse.json({ ...result, fromCache: false })
  } catch (err) {
    console.error('[consulta-placa] Erro na requisição externa:', err)
    return NextResponse.json(
      { error: 'Falha na comunicação com o Sistema Puxa Placa.' },
      { status: 500 },
    )
  }
}
