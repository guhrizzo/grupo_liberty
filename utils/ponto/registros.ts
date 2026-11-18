import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import {
  COLECAO_PONTO_CONFIG,
  JORNADA_PADRAO_MIN,
  type Batida,
  type Batidas,
  type EdicaoPonto,
  type RegistroPonto,
} from '@/constants/ponto'
import { BATIDAS } from '@/constants/ponto'

/** Segredo que assina o QR. Lança se não estiver configurado. */
export function segredoPonto(): string {
  const s = process.env.PONTO_QR_SECRET
  if (!s || s.length < 16) throw new Error('PONTO_QR_SECRET não configurado no servidor.')
  return s
}

export function serializarRegistro(id: string, d: FirebaseFirestore.DocumentData): RegistroPonto {
  const batidas: Batidas = {}
  for (const b of BATIDAS) {
    const v = d.batidas?.[b]
    if (typeof v === 'string') batidas[b as Batida] = v
  }
  const edicoes: EdicaoPonto[] = Array.isArray(d.edicoes) ? d.edicoes : []
  const origens: RegistroPonto['origens'] = {}
  const distancias: RegistroPonto['distancias'] = {}
  for (const b of BATIDAS) {
    const o = d.origens?.[b]
    if (o === 'qr' || o === 'digital' || o === 'manual') origens[b] = o
    const dist = d.distancias?.[b]
    if (typeof dist === 'number') distancias[b] = dist
  }
  return {
    id,
    uid: String(d.uid ?? ''),
    email: String(d.email ?? ''),
    nome: String(d.nome ?? ''),
    data: String(d.data ?? ''),
    batidas,
    origens,
    distancias,
    jornadaMin: typeof d.jornadaMin === 'number' ? d.jornadaMin : JORNADA_PADRAO_MIN,
    edicoes,
  }
}

export async function getJornadaMin(uid: string): Promise<number> {
  const snap = await adminDb.collection(COLECAO_PONTO_CONFIG).doc(uid).get()
  const v = snap.data()?.jornadaMin
  return typeof v === 'number' && v > 0 ? v : JORNADA_PADRAO_MIN
}
