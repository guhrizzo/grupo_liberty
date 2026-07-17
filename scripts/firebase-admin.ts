// Carregado fora do Next.js (scripts/CLI). Não importa 'server-only'.
import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

function loadPrivateKey() {
  const raw = process.env.FIREBASE_PRIVATE_KEY
  if (!raw) return undefined
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw
}

let app: App

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = loadPrivateKey()

  if (projectId && clientEmail && privateKey) {
    app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  } else if (projectId) {
    app = initializeApp({ projectId })
  } else {
    throw new Error('Credenciais do Firebase Admin ausentes. Verifique .env.local')
  }
} else {
  app = getApps()[0]
}

export const adminAuth = getAuth(app)
export const adminDb = getFirestore(app)
