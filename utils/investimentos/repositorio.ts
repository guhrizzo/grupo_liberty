import 'server-only'
import { createHash } from 'node:crypto'
import { adminDb } from '@/utils/firebase/admin'
import { clienteAutenticado, clientesPortal, type CadastroPortal } from '@/utils/portal/acesso'
import {
  aplicarDelta, deltaMovimento, reverterDelta,
  type MovimentoInvestimento, type OpcaoInvestimento, type PosicaoInvestimento, type SituacaoPosicao, type TipoMovimento,
} from './modelo'

export const opcoesInvestimento = () => adminDb.collection('investimentos_opcoes')
export const posicoesInvestimento = () => adminDb.collection('investimentos_posicoes')

function dadosOpcao(doc: FirebaseFirestore.DocumentSnapshot) {
  return { ...(doc.data() as OpcaoInvestimento), id: doc.id }
}

function dadosMovimento(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data() as MovimentoInvestimento
  return {
    id: doc.id, tipo: data.tipo, valor: data.valor, descricao: data.descricao,
    data: data.data, registradoEm: data.registradoEm,
    estornoDe: data.estornoDe ?? null, estornado: !!data.estornadoPor,
  }
}

async function extrato(ref: FirebaseFirestore.DocumentReference) {
  const snap = await ref.collection('movimentos').orderBy('data', 'desc').get()
  return snap.docs.map(dadosMovimento).sort((a, b) => b.data.localeCompare(a.data) || b.registradoEm.localeCompare(a.registradoEm))
}

export async function clienteComInvestimentos() {
  const cliente = await clienteAutenticado()
  return cliente?.cadastro.modulos.includes('investimentos') ? cliente : null
}

export async function carregarInvestimentosCliente() {
  const cliente = await clienteComInvestimentos()
  if (!cliente) return null
  const [catalogo, posicoes] = await Promise.all([
    opcoesInvestimento().where('situacao', '==', 'publicada').get(),
    posicoesInvestimento().where('documento', '==', cliente.documento).get(),
  ])
  return {
    opcoes: catalogo.docs.map(dadosOpcao).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    posicoes: posicoes.docs.map((doc) => {
      const { opcaoNome, referencia, situacao, abertura, dataBase, totais, atualizadaEm } =
        doc.data() as PosicaoInvestimento
      return { id: doc.id, opcaoNome, referencia, situacao, abertura, dataBase, totais, atualizadaEm }
    }).sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm)),
  }
}

export async function carregarExtratoCliente(id: string) {
  const cliente = await clienteComInvestimentos()
  if (!cliente) return null
  const ref = posicoesInvestimento().doc(id)
  const posicao = (await ref.get()).data() as PosicaoInvestimento | undefined
  if (posicao?.documento !== cliente.documento) return null
  const { opcaoNome, opcaoRegistrada, referencia, situacao, abertura, dataBase, totais } = posicao
  return { opcaoNome, opcaoRegistrada, referencia, situacao, abertura, dataBase, totais, movimentos: await extrato(ref) }
}

export async function carregarInvestimentosInternos() {
  const [opcoes, posicoes] = await Promise.all([
    opcoesInvestimento().orderBy('nome').get(),
    posicoesInvestimento().orderBy('atualizadaEm', 'desc').get(),
  ])
  return {
    opcoes: opcoes.docs.map(dadosOpcao),
    posicoes: posicoes.docs.map((doc) => {
      const { nomeCliente, opcaoNome, referencia, situacao, dataBase, totais } = doc.data() as PosicaoInvestimento
      return { id: doc.id, nomeCliente, opcaoNome, referencia, situacao, dataBase, totais }
    }),
  }
}

export async function carregarExtratoInterno(id: string) {
  const ref = posicoesInvestimento().doc(id)
  const posicao = (await ref.get()).data() as PosicaoInvestimento | undefined
  if (!posicao) return null
  return { id, ...posicao, movimentos: await extrato(ref) }
}

export async function abrirPosicaoInvestimento(input: {
  id: string; documento: string; opcaoId: string; referencia: string; data: string; valor: number; uid: string
}) {
  const { id, documento, opcaoId, referencia, data, valor, uid } = input
  const ref = posicoesInvestimento().doc(id)
  const chaveReferencia = createHash('sha256').update(`${documento}:${referencia.toLowerCase()}`).digest('hex')
  const trava = adminDb.collection('investimentos_referencias').doc(chaveReferencia)
  const abertura = ref.collection('movimentos').doc('abertura')
  return adminDb.runTransaction(async (tx) => {
    const [existente, cliente, opcao, referenciaUsada, movimentoInicial] =
      await tx.getAll(ref, clientesPortal().doc(documento), opcoesInvestimento().doc(opcaoId), trava, abertura)
    if (existente.exists) {
      const anterior = existente.data() as PosicaoInvestimento
      return anterior.documento === documento && anterior.opcaoId === opcaoId && anterior.referencia === referencia && anterior.abertura === data && movimentoInicial.get('valor') === valor
        ? { sucesso: true }
        : { erro: 'Este registro já foi utilizado. Atualize a tela antes de tentar novamente.' }
    }
    if (referenciaUsada.exists) return { erro: 'Já existe uma posição com essa referência para o cliente.' }
    const cadastro = cliente.get('portal') as CadastroPortal | undefined
    if (!cadastro?.ativo || !cadastro.modulos.includes('investimentos')) return { erro: 'Libere Investimentos no cadastro ativo do cliente antes de vincular a posição.' }
    if (!opcao.exists || opcao.get('situacao') !== 'publicada') return { erro: 'Selecione uma opção publicada.' }
    const agora = new Date().toISOString()
    const delta = deltaMovimento('aporte', valor)
    if (!delta) return { erro: 'Informe um aporte inicial válido.' }
    const { categoria, prazo, liquidez, riscos, condicoes } = opcao.data() as OpcaoInvestimento
    const posicao: PosicaoInvestimento = {
      documento, nomeCliente: String(cliente.get('contratante.nome') || 'Cliente'),
      opcaoId, opcaoNome: String(opcao.get('nome')), referencia,
      opcaoRegistrada: { categoria, prazo, liquidez, riscos, condicoes },
      situacao: 'ativa', abertura: data, dataBase: data, totais: delta, atualizadaEm: agora,
    }
    tx.create(ref, { ...posicao, abertoPorUid: uid })
    tx.create(trava, { posicaoId: id })
    tx.create(abertura, {
      tipo: 'aporte', valor, delta, data, descricao: 'Aporte inicial registrado', registradoEm: agora, porUid: uid,
    })
    return { sucesso: true }
  })
}

export async function registrarMovimentoInvestimento(input: {
  posicaoId: string; movimentoId: string; tipo: TipoMovimento; valor: number; data: string; descricao: string; uid: string
}) {
  const ref = posicoesInvestimento().doc(input.posicaoId)
  const movimento = ref.collection('movimentos').doc(input.movimentoId)
  return adminDb.runTransaction(async (tx) => {
    const [snapshot, registrado] = await tx.getAll(ref, movimento)
    const atual = snapshot.data() as PosicaoInvestimento | undefined
    if (registrado.exists) {
      const anterior = registrado.data() as MovimentoInvestimento
      return anterior.tipo === input.tipo && anterior.valor === input.valor && anterior.data === input.data && anterior.descricao === input.descricao
        ? { sucesso: true }
        : { erro: 'Este lançamento já foi utilizado. Atualize a tela antes de tentar novamente.' }
    }
    if (!atual || atual.situacao !== 'ativa') return { erro: 'A posição precisa estar ativa.' }
    if (input.data < atual.dataBase) return { erro: 'A data deve ser igual ou posterior à última movimentação.' }

    const delta = deltaMovimento(input.tipo, input.valor)
    const totais = delta && aplicarDelta(atual.totais, delta)
    if (!delta || !totais) return { erro: 'O valor é inválido ou deixaria o saldo negativo.' }
    const agora = new Date().toISOString()
    tx.create(movimento, {
      tipo: input.tipo, valor: input.valor, delta, data: input.data,
      descricao: input.descricao, registradoEm: agora, porUid: input.uid,
    })
    tx.update(ref, { totais, dataBase: input.data, atualizadaEm: agora })
    return { sucesso: true }
  })
}

export async function estornarMovimentoInvestimento(posicaoId: string, movimentoId: string, motivo: string, uid: string, data: string) {
  const ref = posicoesInvestimento().doc(posicaoId)
  const original = ref.collection('movimentos').doc(movimentoId)
  const estorno = ref.collection('movimentos').doc()
  return adminDb.runTransaction(async (tx) => {
    const [snapshot, lancamento] = await tx.getAll(ref, original)
    const posicao = snapshot.data() as PosicaoInvestimento | undefined
    const movimento = lancamento.data() as MovimentoInvestimento | undefined
    if (!posicao || posicao.situacao !== 'ativa' || !movimento || movimento.tipo === 'estorno') {
      return { erro: 'Movimentação indisponível para estorno.' }
    }
    if (movimento.estornadoPor) return { sucesso: true }
    if (data < posicao.dataBase) return { erro: 'A data deve ser igual ou posterior à última movimentação.' }
    const delta = reverterDelta(movimento.delta)
    const totais = aplicarDelta(posicao.totais, delta)
    if (!totais) return { erro: 'O estorno deixaria o saldo ou os totais inconsistentes.' }
    const agora = new Date().toISOString()
    tx.create(estorno, {
      tipo: 'estorno', valor: delta.saldo, delta, data, estornoDe: movimentoId,
      descricao: motivo, registradoEm: agora, porUid: uid,
    })
    tx.update(original, { estornadoPor: estorno.id })
    tx.update(ref, { totais, dataBase: data, atualizadaEm: agora })
    return { sucesso: true }
  })
}

export async function alterarSituacaoPosicao(id: string, situacao: SituacaoPosicao, uid: string) {
  const ref = posicoesInvestimento().doc(id)
  const evento = ref.collection('auditoria').doc()
  return adminDb.runTransaction(async (tx) => {
    const posicao = (await tx.get(ref)).data() as PosicaoInvestimento | undefined
    if (!posicao) return { erro: 'Posição indisponível.' }
    if (posicao.situacao === situacao) return { sucesso: true }
    if (situacao === 'encerrada' && posicao.totais.saldo !== 0) {
      return { erro: 'Registre a saída ou o ajuste de saldo antes de encerrar a posição.' }
    }
    const agora = new Date().toISOString()
    tx.update(ref, { situacao, atualizadaEm: agora })
    tx.create(evento, { de: posicao.situacao, para: situacao, em: agora, porUid: uid })
    return { sucesso: true }
  })
}
