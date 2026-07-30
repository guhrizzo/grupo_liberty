import crypto from 'node:crypto'

// Usamos uma chave de criptografia de 32 bytes (256 bits) estática baseada no projeto,
// mas de forma segura gerando uma derivação robusta.
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.FIREBASE_PRIVATE_KEY || 'liberty-car-secret-salt-2026',
  'liberty-salt',
  32
)
const IV_LENGTH = 16

/**
 * Criptografa uma string usando AES-256-CBC.
 * Retorna uma string em formato 'ivHex:encryptedHex'.
 */
export function encrypt(text: string): string {
  if (!text) return ''
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return `${iv.toString('hex')}:${encrypted}`
}

/**
 * Descriptografa uma string criptografada no formato 'ivHex:encryptedHex'.
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(':')) return ''
  try {
    const [ivHex, encryptedHex] = encryptedText.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    console.error('Falha ao descriptografar:', err)
    return ''
  }
}
