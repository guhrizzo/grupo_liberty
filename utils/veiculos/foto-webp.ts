import sharp from 'sharp'

/** Lado maior máximo (px) das fotos. Suficiente pra tela cheia sem pesar. */
export const FOTO_LARGURA_MAX = 1920
export const FOTO_QUALIDADE_WEBP = 80

/**
 * Converte uma foto qualquer em WebP: corrige a rotação do EXIF, limita a
 * largura a FOTO_LARGURA_MAX e comprime. Lança erro se o formato não for
 * suportado pelo sharp (quem chama decide se cai no arquivo original).
 */
export async function converterFotoParaWebp(entrada: Buffer): Promise<Buffer> {
  return sharp(entrada, { failOn: 'none' })
    .rotate()
    .resize({ width: FOTO_LARGURA_MAX, withoutEnlargement: true })
    .webp({ quality: FOTO_QUALIDADE_WEBP })
    .toBuffer()
}

/** Nomes únicos ficam em cache pra sempre: nunca reescrevemos o mesmo path. */
export const FOTO_CACHE_CONTROL = 'public, max-age=31536000, immutable'
