// Configuração fixada em build-time. Em produção o `.exe` não recebe env vars,
// então os defaults abaixo são o que vale de verdade. Em dev, o script `dev`
// exporta APP_URL=http://localhost:3000.

export const APP_URL = process.env.APP_URL ?? 'https://grupolibertycar.com.br'

// Feed de atualização (bucket público do Supabase Storage). O ref do projeto é o
// mesmo usado no `next.config.ts` da raiz.
export const UPDATE_FEED_URL =
  process.env.UPDATE_FEED_URL ??
  'https://tdnioxrmhfhfvlfvuand.supabase.co/storage/v1/object/public/desktop-releases'

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

// Tom de fundo da janela (evita flash branco no carregamento). Azul da marca.
export const BACKGROUND_COLOR = '#0b0d14'
