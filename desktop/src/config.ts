// Configuração fixada em build-time. Em produção o `.exe` não recebe env vars,
// então os defaults abaixo são o que vale de verdade. Em dev, o script `dev`
// exporta APP_URL apontando pro localhost.

// Site publicado.
export const APP_ORIGIN =
  process.env.APP_ORIGIN ?? 'https://grupolibertycar.com.br'

// Ponto de entrada do app desktop: vai direto pro sistema interno. Sem sessão,
// o próprio site redireciona pra /login; com sessão, entra direto.
export const APP_URL = process.env.APP_URL ?? `${APP_ORIGIN}/dashboard`

// O feed de atualização (GitHub Releases) é configurado no electron-builder.yml
// e embutido no app-update.yml — não precisa de nada aqui.

// Origens tratadas como "dentro do app" — navegação livre.
export const APP_ORIGINS = [
  'https://grupolibertycar.com.br',
  'https://www.grupolibertycar.com.br',
  'http://localhost:3000',
]

// Origens de autenticação liberadas caso o login do Firebase use redirect/popup.
export const AUTH_ORIGINS = [
  'https://grupo-liberty.firebaseapp.com',
  'https://accounts.google.com',
  'https://apis.google.com',
]

// Rotas públicas (vitrine) que o app desktop NÃO deve abrir — qualquer tentativa
// de navegar pra elas é redirecionada pro sistema interno.
const PUBLIC_PATH = /^\/$|^\/(veiculos|public)(\/|$)/

// Se `url` for uma rota pública do próprio site, devolve pra onde redirecionar
// (a entrada do sistema interno). Senão, null.
export function internalRedirectFor(url: string): string | null {
  try {
    const u = new URL(url)
    if (!APP_ORIGINS.includes(u.origin)) return null
    if (PUBLIC_PATH.test(u.pathname)) return `${u.origin}/dashboard`
    return null
  } catch {
    return null
  }
}

// Tom de fundo da janela (evita flash branco no carregamento). Azul da marca.
export const BACKGROUND_COLOR = '#0b0d14'
