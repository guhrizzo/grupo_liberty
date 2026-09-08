import { NextResponse } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'
import { adminDb, adminStorage } from '@/utils/firebase/admin'
import { encrypt } from '@/utils/crypto'
import { validarCPF } from '@/utils/validadorCpf'
import { onlyDigits, parseMoney } from '@/utils/masks'
import { isCambioValido, isCombustivelValido } from '@/utils/veiculos/opcoes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_FOTOS = 10
const MAX_FOTO_BYTES = 8 * 1024 * 1024 // 8 MB — guarda-costas; o client já comprime
const MAX_OBS = 2000
const THROTTLE_JANELA_MS = 60 * 60 * 1000 // 1 h
const THROTTLE_LIMITE = 5
const PLACA_RE = /^[A-Z]{3}-?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/

const EXT_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

interface AnuncioData {
  nome: string
  cpfDigits: string
  email: string
  telefone: string
  marca: string
  modelo: string
  ano: number
  cor: string
  cambio: string
  combustivel: string
  quilometragem: number
  precoDesejado: number
  observacoes: string
  placa: string | null
}

function str(form: FormData, key: string): string {
  const v = form.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

/** Valida e normaliza os campos de texto. Retorna `{ data }` ou `{ error }`. */
function parseAnuncioForm(form: FormData): { data?: AnuncioData; error?: string } {
  const nome = str(form, 'nome')
  if (nome.length < 2) return { error: 'Informe seu nome completo.' }

  const cpfDigits = onlyDigits(str(form, 'cpf'))
  if (!validarCPF(cpfDigits)) return { error: 'O CPF informado é inválido.' }

  const email = str(form, 'email')
  if (!email.includes('@') || email.length < 5) return { error: 'Informe um e-mail válido.' }

  const telefone = str(form, 'telefone')
  if (onlyDigits(telefone).length < 10) return { error: 'Informe um telefone/WhatsApp válido.' }

  const marca = str(form, 'marca')
  if (!marca) return { error: 'Informe a marca do veículo.' }

  const modelo = str(form, 'modelo')
  if (!modelo) return { error: 'Informe o modelo do veículo.' }

  const ano = Number(onlyDigits(str(form, 'ano')))
  const anoMax = new Date().getFullYear() + 1
  if (!Number.isInteger(ano) || ano < 1900 || ano > anoMax) {
    return { error: `Ano deve estar entre 1900 e ${anoMax}.` }
  }

  const cor = str(form, 'cor')
  if (!cor) return { error: 'Informe a cor do veículo.' }

  const cambio = str(form, 'cambio')
  if (!isCambioValido(cambio)) return { error: 'Selecione um câmbio válido.' }

  const combustivel = str(form, 'combustivel')
  if (!isCombustivelValido(combustivel)) return { error: 'Selecione um combustível válido.' }

  const quilometragem = Number(onlyDigits(str(form, 'quilometragem')))
  if (!Number.isFinite(quilometragem) || quilometragem < 0) {
    return { error: 'Informe uma quilometragem válida.' }
  }

  const precoDesejado = parseMoney(str(form, 'precoDesejado'))
  if (!Number.isFinite(precoDesejado) || precoDesejado <= 0) {
    return { error: 'Informe o preço desejado.' }
  }

  const observacoes = str(form, 'observacoes').slice(0, MAX_OBS)
  if (!observacoes) return { error: 'Escreva algumas informações sobre o veículo.' }

  const placaRaw = str(form, 'placa').toUpperCase().replace(/\s/g, '')
  let placa: string | null = null
  if (placaRaw) {
    if (!PLACA_RE.test(placaRaw)) return { error: 'Placa inválida. Use ABC-1234 ou ABC1D23.' }
    placa = placaRaw
  }

  return {
    data: {
      nome,
      cpfDigits,
      email,
      telefone,
      marca,
      modelo,
      ano,
      cor,
      cambio,
      combustivel,
      quilometragem,
      precoDesejado,
      observacoes,
      placa,
    },
  }
}

function getIpHash(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = fwd || req.headers.get('x-real-ip')?.trim() || 'desconhecido'
  return createHash('sha256').update(ip).digest('hex')
}

/** Conta anúncios do mesmo IP na última hora. Fallback sem índice composto. */
async function contarEnviosRecentes(ipHash: string): Promise<number> {
  const corte = new Date(Date.now() - THROTTLE_JANELA_MS).toISOString()
  try {
    const snap = await adminDb
      .collection('anuncios')
      .where('ipHash', '==', ipHash)
      .where('created_at', '>', corte)
      .get()
    return snap.size
  } catch {
    const snap = await adminDb.collection('anuncios').where('ipHash', '==', ipHash).get()
    return snap.docs.filter((d) => String(d.data().created_at ?? '') > corte).length
  }
}

export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 })
  }

  // Honeypot: bot preencheu o campo oculto → finge sucesso e descarta.
  if (str(form, 'website')) {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  const ipHash = getIpHash(req)

  try {
    if ((await contarEnviosRecentes(ipHash)) >= THROTTLE_LIMITE) {
      return NextResponse.json(
        { error: 'Você já enviou vários anúncios recentemente. Aguarde um pouco e tente de novo.' },
        { status: 429 },
      )
    }
  } catch (err) {
    console.error('[anuncios] Erro no throttle:', err)
  }

  const { data, error } = parseAnuncioForm(form)
  if (error || !data) {
    return NextResponse.json({ error: error ?? 'Dados inválidos.' }, { status: 400 })
  }

  const fotos = form.getAll('fotos').filter((f): f is File => f instanceof File && f.size > 0)
  if (fotos.length === 0) return NextResponse.json({ error: 'Envie ao menos 1 foto do veículo.' }, { status: 400 })
  if (fotos.length > MAX_FOTOS) {
    return NextResponse.json({ error: `Envie no máximo ${MAX_FOTOS} fotos.` }, { status: 400 })
  }
  for (const f of fotos) {
    if (!f.type.startsWith('image/') || !EXT_POR_MIME[f.type]) {
      return NextResponse.json({ error: 'Uma das fotos não é uma imagem válida.' }, { status: 400 })
    }
    if (f.size > MAX_FOTO_BYTES) {
      return NextResponse.json({ error: 'Uma das fotos é muito grande (máx. 8 MB).' }, { status: 400 })
    }
  }

  const ref = adminDb.collection('anuncios').doc()
  const bucket = adminStorage.bucket()
  const enviadas: string[] = []
  const urls: string[] = []

  try {
    for (let i = 0; i < fotos.length; i++) {
      const foto = fotos[i]
      const ext = EXT_POR_MIME[foto.type]
      const caminho = `anuncios/${ref.id}/${i}-${randomBytes(4).toString('hex')}.${ext}`
      const fileRef = bucket.file(caminho)
      const buffer = Buffer.from(await foto.arrayBuffer())
      await fileRef.save(buffer, { metadata: { contentType: foto.type } })
      enviadas.push(caminho)
      await fileRef.makePublic()
      urls.push(fileRef.publicUrl())
    }
  } catch (err) {
    console.error('[anuncios] Falha ao subir fotos:', err)
    await Promise.all(enviadas.map((c) => bucket.file(c).delete().catch(() => {})))
    return NextResponse.json(
      { error: 'Não foi possível enviar as fotos. Tente novamente.' },
      { status: 500 },
    )
  }

  const nowIso = new Date().toISOString()

  try {
    await ref.set({
      nome: data.nome,
      cpf: encrypt(data.cpfDigits),
      email: data.email,
      telefone: data.telefone,
      marca: data.marca,
      modelo: data.modelo,
      ano: data.ano,
      cor: data.cor,
      cambio: data.cambio,
      combustivel: data.combustivel,
      quilometragem: data.quilometragem,
      precoDesejado: data.precoDesejado,
      observacoes: data.observacoes,
      placa: data.placa,
      fotos: urls,
      // Caminhos dos objetos no Storage, paralelos a `fotos`. Usados na
      // aprovação para copiar as fotos escolhidas para `fotos/` sem precisar
      // parsear as URLs públicas.
      fotosPaths: enviadas,
      status: 'pendente',
      motivoRecusa: null,
      veiculoId: null,
      ipHash,
      decididoPor: null,
      decididoEm: null,
      created_at: nowIso,
      updated_at: nowIso,
    })
  } catch (err) {
    console.error('[anuncios] Falha ao gravar anúncio:', err)
    await Promise.all(enviadas.map((c) => bucket.file(c).delete().catch(() => {})))
    return NextResponse.json(
      { error: 'Não foi possível registrar seu anúncio. Tente novamente.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
