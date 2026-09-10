import { cookies } from 'next/headers'
import {
  FieldValue,
  Timestamp,
  type Transaction,
  type DocumentReference,
  type DocumentSnapshot,
} from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { isBotUserAgent } from '@/utils/analytics/bots'
import { dayKey, monthKey } from '@/utils/analytics/dates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Caminhos que não contam como visita ao site público (equipe interna).
const IGNORAR_PREFIXOS = ['/dashboard', '/login', '/entrar-dispositivo', '/api']
const DIA_MS = 24 * 60 * 60 * 1000
const TTL_DIA_DIAS = 60
const TTL_MES_DIAS = 400
const VEICULO_RE = /^\/veiculos\/([^/?#]+)\/?$/
const UUID_RE = /^[0-9a-f-]{36}$/i

const noContent = () => new Response(null, { status: 204 })

function pathIgnorado(path: string): boolean {
  return IGNORAR_PREFIXOS.some((p) => path === p || path.startsWith(p + '/'))
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json().catch(() => null)) as { path?: unknown } | null
    let path = typeof body?.path === 'string' ? body.path : ''
    if (!path.startsWith('/') || path.length > 512) return noContent()

    path = path.split('?')[0].split('#')[0]
    if (pathIgnorado(path)) return noContent()

    if (isBotUserAgent(req.headers.get('user-agent'))) return noContent()

    const jar = await cookies()
    const vid = jar.get('liberty_vid')?.value
    if (!vid || !UUID_RE.test(vid)) return noContent()

    // "Logado" = tem cookie de sessão válido (só verificação local de
    // assinatura/prazo, sem round-trip — mesmo critério do proxy).
    let logged = false
    const session = jar.get('session')?.value
    if (session) {
      try {
        await adminAuth.verifySessionCookie(session)
        logged = true
      } catch {
        logged = false
      }
    }

    const now = Timestamp.now()
    const day = dayKey()
    const month = monthKey()

    await registrarVisita({ day, month, vid, logged, now })

    const veiculoMatch = path.match(VEICULO_RE)
    if (veiculoMatch) {
      await adminDb
        .collection('analytics_vehicle_daily')
        .doc(day)
        .set(
          {
            date: day,
            views: { [veiculoMatch[1]]: FieldValue.increment(1) },
            updatedAt: now,
          },
          { merge: true },
        )
    }

    return noContent()
  } catch (e) {
    console.error('[track]', e)
    return noContent()
  }
}

async function registrarVisita({
  day,
  month,
  vid,
  logged,
  now,
}: {
  day: string
  month: string
  vid: string
  logged: boolean
  now: Timestamp
}): Promise<void> {
  const dailyRef = adminDb.collection('analytics_daily').doc(day)
  const monthlyRef = adminDb.collection('analytics_monthly').doc(month)
  const dailyMarker = dailyRef.collection('visitors').doc(vid)
  const monthlyMarker = monthlyRef.collection('visitors').doc(vid)

  await adminDb.runTransaction(async (tx) => {
    const [dm, mm] = await Promise.all([
      tx.get(dailyMarker),
      tx.get(monthlyMarker),
    ])

    aplicar(tx, dailyRef, dailyMarker, dm, day, logged, now, TTL_DIA_DIAS)
    aplicar(tx, monthlyRef, monthlyMarker, mm, month, logged, now, TTL_MES_DIAS)
  })
}

function aplicar(
  tx: Transaction,
  aggRef: DocumentReference,
  markerRef: DocumentReference,
  snap: DocumentSnapshot,
  dateStr: string,
  logged: boolean,
  now: Timestamp,
  ttlDias: number,
): void {
  const novo = !snap.exists
  const precisaLogado = logged && (novo || snap.get('logged') !== true)

  tx.set(
    aggRef,
    {
      date: dateStr,
      pageviews: FieldValue.increment(1),
      uniqueVisitors: FieldValue.increment(novo ? 1 : 0),
      loggedVisitors: FieldValue.increment(precisaLogado ? 1 : 0),
      updatedAt: now,
    },
    { merge: true },
  )

  if (novo) {
    tx.set(markerRef, {
      firstSeen: now,
      logged,
      expiresAt: Timestamp.fromMillis(now.toMillis() + ttlDias * DIA_MS),
    })
  } else if (precisaLogado) {
    tx.update(markerRef, { logged: true })
  }
}
