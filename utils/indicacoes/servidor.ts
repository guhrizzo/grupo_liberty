import 'server-only'
import { createHmac } from 'node:crypto'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { chaveHash, chavesPortal, clientesPortal, tokenPortal, type CadastroPortal } from '@/utils/portal/acesso'
import { normalizarDocumento } from '@/utils/portal/documento'
import { normalizarEmail } from '@/utils/portal/modelo'
import { rateLimit } from '@/utils/rate-limit'
import {
  CONFIG_PADRAO, codigoIndicacaoValido, gerarCodigoIndicacao, normalizarConfig, transicaoRecompensa, valorRecompensa,
  type AcaoRecompensa, type ConfigIndicacoes, type EventoAuditoria, type LinhaRecompensa, type StatusIndicacao, type StatusRecompensa,
} from './modelo'

const configRef = () => adminDb.collection('indicacao_config').doc('regras')
const codigosRef = () => adminDb.collection('indicacao_codigos')
export const indicacoesRef = () => adminDb.collection('indicacoes')
export const recompensasRef = () => adminDb.collection('indicacao_recompensas')
const telefonesRef = () => adminDb.collection('indicacao_telefones')

export type Indicacao = {
  indicadorDocumento: string
  indicadoNome: string
  indicadoEmailHash: string
  indicadoDocumentoHash: string
  status: StatusIndicacao
  criadoEm: string
  validaAte: string | null
  convertidaEm?: string | null
  recompensaId?: string | null
  motivoRevisao?: string | null
  historico: EventoAuditoria[]
}

export type Recompensa = {
  indicacaoId: string
  indicadorDocumento: string
  ordem: number
  valor: number
  status: StatusRecompensa
  criadoEm: string
  liberadaEm?: string | null
  pagaEm?: string | null
  comprovantePath?: string | null
  historico: EventoAuditoria[]
}

/** Identificadores sensíveis (CPF, telefone) guardados só como hash para detectar duplicidade. */
function hashIdentidade(tipo: 'cpf' | 'tel', valor: string) {
  const segredo = process.env.PORTAL_QUITACAO_INDEX_KEY || process.env.FIREBASE_PRIVATE_KEY
  if (!segredo) throw new Error('Sem chave para gerar o identificador.')
  return createHmac('sha256', segredo.replace(/\\n/g, '\n')).update(`indicacao-${tipo}:${valor}`).digest('hex')
}

const agora = () => new Date().toISOString()

export async function carregarConfigIndicacoes(): Promise<ConfigIndicacoes> {
  try {
    const salva = normalizarConfig((await configRef().get()).data())
    if (salva) return salva
  } catch {
    console.warn('[indicacoes] Não foi possível ler a configuração; usando o padrão.')
  }
  return structuredClone(CONFIG_PADRAO)
}

export async function gravarConfigIndicacoes(config: ConfigIndicacoes, uid: string) {
  await configRef().set({ ...config, atualizadoEm: agora(), atualizadoPorUid: uid })
}

export async function codigoExiste(codigo: unknown) {
  return codigoIndicacaoValido(codigo) && (await codigosRef().doc(codigo).get()).exists
}

/** Código exclusivo do cliente indicador, criado na primeira consulta. */
export async function codigoDoIndicador(documento: string) {
  const clienteRef = clientesPortal().doc(documento)
  const existente = (await clienteRef.get()).get('indicacaoCodigo')
  if (codigoIndicacaoValido(existente)) return existente

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigoIndicacao()
    const criado = await adminDb.runTransaction(async (tx) => {
      const [cliente, codigoDoc] = await tx.getAll(clienteRef, codigosRef().doc(codigo))
      const ja = cliente.get('indicacaoCodigo')
      if (codigoIndicacaoValido(ja)) return ja
      if (codigoDoc.exists) return null
      tx.create(codigosRef().doc(codigo), { documento, criadoEm: agora() })
      tx.set(clienteRef, { indicacaoCodigo: codigo }, { merge: true })
      return codigo
    })
    if (criado) return criado
  }
  throw new Error('Não foi possível gerar o código de indicação.')
}

export type DadosIndicado = { codigo: string; idToken: string; nome: string; cpf: string; telefone: string }
export type ResultadoRegistro = { erro: string } | { status: 'cadastrado' | 'em_revisao' }

/** Cadastro do indicado pelo link. Cria a indicação e, se for cliente novo, o acesso ao portal (só módulo de indicações). */
export async function registrarIndicado(dados: DadosIndicado): Promise<ResultadoRegistro> {
  const nome = dados.nome.trim().replace(/\s+/g, ' ')
  const cpf = normalizarDocumento(dados.cpf)
  const telefone = dados.telefone.replace(/\D/g, '')
  if (!codigoIndicacaoValido(dados.codigo)) return { erro: 'Este link de indicação não é válido.' }
  if (nome.length < 3 || nome.length > 120) return { erro: 'Informe seu nome completo.' }
  if (cpf.length !== 11) return { erro: 'Informe um CPF válido.' }
  if (!/^\d{10,11}$/.test(telefone)) return { erro: 'Informe um telefone com DDD.' }

  const identidade = await adminAuth.verifyIdToken(dados.idToken).catch(() => null)
  const provedor = identidade?.firebase.sign_in_provider
  const email = normalizarEmail(identidade?.email)
  if (!identidade || !email || (provedor !== 'password' && provedor !== 'google.com')) {
    return { erro: 'Não foi possível validar o seu cadastro. Tente novamente.' }
  }
  if (!rateLimit(`indicacao-cadastro:${chaveHash(email)}`, 5, 15 * 60 * 1000).allowed) {
    return { erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }
  }

  const codigoDoc = await codigosRef().doc(dados.codigo).get()
  const indicadorDocumento = codigoDoc.get('documento') as string | undefined
  if (!indicadorDocumento) return { erro: 'Este link de indicação não é válido.' }

  const config = await carregarConfigIndicacoes()
  const indicadorCliente = await clientesPortal().doc(indicadorDocumento).get()
  const indicadorPortal = indicadorCliente.get('portal') as CadastroPortal | undefined
  const telefoneHash = hashIdentidade('tel', telefone)
  const cpfHash = hashIdentidade('cpf', cpf)
  const telefoneIndicador = String(indicadorCliente.get('contratante.telefone') ?? indicadorPortal?.perfil?.telefone ?? '').replace(/\D/g, '')

  // Autoindicação: mesmo CPF, e-mail ou telefone do indicador.
  if (indicadorDocumento === cpf || indicadorPortal?.email === email || (telefoneIndicador && hashIdentidade('tel', telefoneIndicador) === telefoneHash)) {
    return { erro: 'Não é possível usar o seu próprio link de indicação.' }
  }

  const indicacaoRef = indicacoesRef().doc(`cpf_${cpfHash}`)
  const telefoneLock = telefonesRef().doc(telefoneHash)
  const clienteRef = clientesPortal().doc(cpf)
  const acessoRef = chavesPortal().doc(chaveHash(email))

  return adminDb.runTransaction(async (tx): Promise<ResultadoRegistro> => {
    const [indicacao, lock, cliente, acesso] = await tx.getAll(indicacaoRef, telefoneLock, clienteRef, acessoRef)
    if (indicacao.exists || lock.exists) return { erro: 'Este cadastro já foi indicado anteriormente.' }

    const jaCadastrado = cliente.exists || acesso.exists
    if (jaCadastrado && config.indicadoJaCadastrado === 'recusar') {
      return { erro: 'Você já tem cadastro na Liberty. Entre na Área do Cliente com o seu acesso.' }
    }

    const em = agora()
    const validaAte = config.validadeIndicacaoDias > 0
      ? new Date(Date.now() + config.validadeIndicacaoDias * 86_400_000).toISOString()
      : null
    const status: StatusIndicacao = jaCadastrado ? 'em_revisao' : 'cadastrado'

    if (!jaCadastrado) {
      const versao = tokenPortal()
      tx.set(acessoRef, { documento: cpf, versao })
      tx.set(clienteRef, {
        contratante: { nome, cpf, email, telefone },
        indicacaoOrigem: dados.codigo,
        portal: { email, ativo: true, versao, modulos: ['indicacoes'], origem: 'indicacao', atualizadoEm: em },
      }, { merge: true })
    }
    tx.create(telefoneLock, { indicacaoId: indicacaoRef.id, criadoEm: em })
    tx.create(indicacaoRef, {
      indicadorDocumento, indicadoNome: nome, indicadoEmailHash: chaveHash(email), indicadoDocumentoHash: cpfHash,
      status, criadoEm: em, validaAte, convertidaEm: null, recompensaId: null,
      motivoRevisao: jaCadastrado ? 'Indicado já tinha cadastro no portal.' : null,
      historico: [{ em, por: 'indicado', acao: jaCadastrado ? 'cadastro_em_revisao' : 'cadastro' } satisfies EventoAuditoria],
    } satisfies Indicacao)
    return { status }
  })
}

/** Primeiro acesso do indicado à Área do Cliente: converte a indicação e gera a recompensa (uma só por indicação). */
export async function converterPorLogin(idToken: string) {
  try {
    const identidade = await adminAuth.verifyIdToken(idToken)
    const email = normalizarEmail(identidade.email)
    if (!email) return null
    const encontradas = await indicacoesRef()
      .where('indicadoEmailHash', '==', chaveHash(email)).where('status', '==', 'cadastrado').limit(1).get()
    const doc = encontradas.docs[0]
    return doc ? await converterIndicacao(doc.id, 'primeiro-acesso') : null
  } catch {
    console.warn('[indicacoes] Não foi possível processar a conversão no acesso.')
    return null
  }
}

export async function converterIndicacao(indicacaoId: string, por: string) {
  const config = await carregarConfigIndicacoes()
  return adminDb.runTransaction(async (tx) => {
    const ref = indicacoesRef().doc(indicacaoId)
    const indicacao = (await tx.get(ref)).data() as Indicacao | undefined
    if (!indicacao || indicacao.status !== 'cadastrado') return null

    const em = agora()
    if (indicacao.validaAte && indicacao.validaAte < em) {
      tx.update(ref, { status: 'expirada', historico: [...indicacao.historico, { em, por, acao: 'expirada' }] })
      return { status: 'expirada' as const }
    }

    // A recompensa usa o mesmo id da indicação: criar duas vezes falha, então nunca há mais de uma.
    const recompensaRef = recompensasRef().doc(indicacaoId)
    const [recompensaExistente, convertidas] = await Promise.all([
      tx.get(recompensaRef),
      tx.get(indicacoesRef().where('indicadorDocumento', '==', indicacao.indicadorDocumento).where('status', '==', 'convertida')),
    ])
    if (recompensaExistente.exists) return null

    const ordem = convertidas.size + 1
    const faixa = valorRecompensa(config.faixas, ordem)
    if (!faixa) return null
    const status: StatusRecompensa = config.liberacaoAutomatica ? 'liberada' : 'pendente'
    tx.create(recompensaRef, {
      indicacaoId, indicadorDocumento: indicacao.indicadorDocumento, ordem, valor: faixa.valor, status,
      criadoEm: em, liberadaEm: config.liberacaoAutomatica ? em : null, pagaEm: null, comprovantePath: null,
      historico: [{ em, por, acao: 'criada', detalhe: `${ordem}ª indicação convertida: R$ ${faixa.valor.toFixed(2)}` },
        ...(config.liberacaoAutomatica ? [{ em, por, acao: 'liberada', detalhe: 'Liberação automática.' }] : [])],
    } satisfies Recompensa)
    tx.update(ref, {
      status: 'convertida', convertidaEm: em, recompensaId: indicacaoId,
      historico: [...indicacao.historico, { em, por, acao: 'convertida', detalhe: `Recompensa de R$ ${faixa.valor.toFixed(2)}` }],
    })
    return { status: 'convertida' as const, valor: faixa.valor, ordem }
  })
}

/** Indicações e recompensas de um cliente indicador, sem dados pessoais além do primeiro nome. */
export async function listarDoIndicador(documento: string) {
  const [indicacoes, recompensas] = await Promise.all([
    indicacoesRef().where('indicadorDocumento', '==', documento).get(),
    recompensasRef().where('indicadorDocumento', '==', documento).get(),
  ])
  return {
    indicacoes: indicacoes.docs.map((d) => {
      const i = d.data() as Indicacao
      return { id: d.id, nome: i.indicadoNome.split(' ')[0] ?? '', status: i.status, criadoEm: i.criadoEm, convertidaEm: i.convertidaEm ?? null }
    }).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
    recompensas: recompensas.docs.map((d) => {
      const r = d.data() as Recompensa
      return { id: d.id, ordem: r.ordem, valor: r.valor, status: r.status, criadoEm: r.criadoEm, liberadaEm: r.liberadaEm ?? null, pagaEm: r.pagaEm ?? null }
    }).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
  }
}

/** Visão da equipe: todas as indicações, com o nome do indicador. */
export async function listarTodasIndicacoes() {
  const snap = await indicacoesRef().orderBy('criadoEm', 'desc').limit(300).get()
  const documentos = [...new Set(snap.docs.map((d) => String(d.get('indicadorDocumento'))))]
  const clientes = documentos.length ? await adminDb.getAll(...documentos.map((doc) => clientesPortal().doc(doc))) : []
  const nomes = new Map(clientes.map((c) => [c.id, String(c.get('contratante.nome') ?? 'Cliente')]))
  return snap.docs.map((d) => {
    const i = d.data() as Indicacao
    return {
      id: d.id, indicadoNome: i.indicadoNome, indicadorNome: nomes.get(i.indicadorDocumento) ?? 'Cliente',
      status: i.status, criadoEm: i.criadoEm, motivoRevisao: i.motivoRevisao ?? null,
    }
  })
}

/** Decisão da equipe sobre uma indicação em revisão (conflito de atribuição). */
export async function revisarIndicacao(id: string, decisao: 'aprovar' | 'recusar', uid: string) {
  const ref = indicacoesRef().doc(id)
  const novoStatus = await adminDb.runTransaction(async (tx) => {
    const indicacao = (await tx.get(ref)).data() as Indicacao | undefined
    if (!indicacao || indicacao.status !== 'em_revisao') return null
    const em = agora()
    const status: StatusIndicacao = decisao === 'aprovar' ? 'cadastrado' : 'recusada'
    tx.update(ref, { status, historico: [...indicacao.historico, { em, por: `admin:${uid}`, acao: decisao === 'aprovar' ? 'revisao_aprovada' : 'revisao_recusada' }] })
    return status
  })
  if (novoStatus === 'cadastrado') await converterIndicacao(id, `admin:${uid}`)
  return novoStatus
}

/** Recompensas para o controle financeiro, com nomes do indicador e do indicado. */
export async function listarRecompensasAdmin(): Promise<LinhaRecompensa[]> {
  const snap = await recompensasRef().orderBy('criadoEm', 'desc').limit(1000).get()
  if (snap.empty) return []
  const recompensas = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Recompensa) }))
  const documentos = [...new Set(recompensas.map((r) => r.indicadorDocumento))]
  const [clientes, indicacoes] = await Promise.all([
    adminDb.getAll(...documentos.map((doc) => clientesPortal().doc(doc))),
    adminDb.getAll(...recompensas.map((r) => indicacoesRef().doc(r.indicacaoId))),
  ])
  const nomes = new Map(clientes.map((c) => [c.id, String(c.get('contratante.nome') ?? 'Cliente')]))
  const indicados = new Map(indicacoes.map((i) => [i.id, String(i.get('indicadoNome') ?? '')]))
  return recompensas.map((r) => ({
    id: r.id, indicadorDocumento: r.indicadorDocumento, indicadorNome: nomes.get(r.indicadorDocumento) ?? 'Cliente',
    indicadoNome: indicados.get(r.indicacaoId) ?? '', ordem: r.ordem, valor: r.valor, status: r.status, criadoEm: r.criadoEm,
    liberadaEm: r.liberadaEm ?? null, pagaEm: r.pagaEm ?? null, temComprovante: !!r.comprovantePath,
  }))
}

export type DadosPagamento = { pagaEm: string; comprovantePath: string | null }

/** Liberar, pagar ou cancelar uma recompensa. Só segue pelas transições permitidas e sempre deixa registro de auditoria. */
export async function mudarRecompensa(id: string, acao: AcaoRecompensa, uid: string, extra?: { pagamento?: DadosPagamento; motivo?: string }) {
  const ref = recompensasRef().doc(id)
  return adminDb.runTransaction(async (tx) => {
    const r = (await tx.get(ref)).data() as Recompensa | undefined
    if (!r) return { erro: 'Recompensa não encontrada.' as const }
    const novo = transicaoRecompensa(r.status, acao)
    if (!novo) return { erro: 'Esta ação não é permitida na situação atual da recompensa.' as const }

    const em = agora()
    const por = `admin:${uid}`
    const evento: EventoAuditoria =
      acao === 'liberar' ? { em, por, acao: 'liberada' }
      : acao === 'pagar' ? { em, por, acao: 'paga', detalhe: `Pagamento em ${extra?.pagamento?.pagaEm}${extra?.pagamento?.comprovantePath ? ' com comprovante' : ' sem comprovante'}` }
      : { em, por, acao: 'cancelada', detalhe: extra?.motivo }
    tx.update(ref, {
      status: novo,
      ...(acao === 'liberar' ? { liberadaEm: em } : {}),
      ...(acao === 'pagar' && extra?.pagamento ? { pagaEm: extra.pagamento.pagaEm, comprovantePath: extra.pagamento.comprovantePath } : {}),
      historico: [...r.historico, evento],
    })
    return { status: novo }
  })
}

export async function comprovanteDaRecompensa(id: string) {
  const r = (await recompensasRef().doc(id).get()).data() as Recompensa | undefined
  return r?.status === 'paga' && r.comprovantePath ? r.comprovantePath : null
}
