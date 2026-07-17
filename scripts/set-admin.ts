import 'dotenv/config'
import { adminAuth, adminDb } from './firebase-admin'

const EMAIL = process.argv[2]

if (!EMAIL) {
  console.error('Uso: npx tsx scripts/set-admin.ts <email>')
  process.exit(1)
}

async function main() {
  const user = await adminAuth.getUserByEmail(EMAIL)

  await adminAuth.setCustomUserClaims(user.uid, {
    admin: true,
    role: 'admin',
  })

  await adminDb.collection('profiles').doc(user.uid).set(
    {
      role: 'admin',
      email: EMAIL,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  )

  console.log(`OK: ${EMAIL} (uid=${user.uid}) agora é admin.`)
  console.log('Peça para o usuário fazer logout e login novamente.')
}

main().catch((err) => {
  console.error('Erro:', err)
  process.exit(1)
})
