'use server'

import { randomBytes } from 'node:crypto'
import { adminDb } from '@/utils/firebase/admin'
import { getSessionUser } from '@/utils/permissions'

/** Janela de validade de um código de login de dispositivo. */
const TTL_MS = 2 * 60 * 1000

/**
 * Gera um código de uso único que o app desktop troca por um cookie de sessão
 * (via POST /api/desktop/exchange). Só funciona pra quem já está logado no
 * navegador — é o passo de "autorizar" da tela /entrar-dispositivo.
 */
export async function criarCodigoDispositivo(): Promise<{ code?: string; error?: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Sessão expirada. Faça login de novo.' }

  const code = randomBytes(32).toString('base64url')
  const nowIso = new Date().toISOString()
  const expiresIso = new Date(Date.now() + TTL_MS).toISOString()

  try {
    await adminDb.collection('device_logins').doc(code).set({
      uid: user.uid,
      email: user.email ?? null,
      createdAt: nowIso,
      expiresAt: expiresIso,
      usedAt: null,
    })
  } catch (err) {
    console.error('Erro ao criar código de dispositivo:', err)
    return { error: 'Não foi possível iniciar o login. Tente de novo.' }
  }

  // Limpeza oportunista: apaga alguns códigos já expirados (best-effort).
  try {
    const velhos = await adminDb
      .collection('device_logins')
      .where('expiresAt', '<', nowIso)
      .limit(20)
      .get()
    if (!velhos.empty) {
      const batch = adminDb.batch()
      velhos.docs.forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
  } catch (err) {
    console.error('Erro na limpeza de device_logins:', err)
  }

  return { code }
}
