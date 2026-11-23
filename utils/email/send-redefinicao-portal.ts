import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Resend } from 'resend'
import { adminAuth } from '@/utils/firebase/admin'
import { idLogoRedefinicaoPortal, renderEmailRedefinicaoPortal } from './templates/redefinicao-portal'

export async function enviarRedefinicaoPortal(email: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Resend indisponível.')

  const usuario = await adminAuth.getUserByEmail(email).catch((erro: unknown) => {
    if ((erro as { code?: string })?.code === 'auth/user-not-found') return null
    throw erro
  })
  if (!usuario || usuario.disabled || !usuario.providerData.some(({ providerId }) => providerId === 'password')) return

  const [link, logo] = await Promise.all([
    adminAuth.generatePasswordResetLink(email),
    readFile(join(process.cwd(), 'app/public/logo-liberty-car-white.png')),
  ])
  const { error } = await new Resend(apiKey).emails.send({
    from: 'Liberty Car <noreply@grupolibertycar.com.br>',
    to: email,
    ...renderEmailRedefinicaoPortal(link),
    attachments: [{
      filename: 'logo-liberty-car.png',
      content: logo,
      contentType: 'image/png',
      contentId: idLogoRedefinicaoPortal,
    }],
  })
  if (error) throw new Error('Resend recusou o envio.')
}
