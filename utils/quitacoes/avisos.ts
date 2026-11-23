import 'server-only'
import { Resend } from 'resend'
import { adminDb } from '@/utils/firebase/admin'
import { chavesPortal, chaveHash, clientesPortal, type CadastroPortal } from '@/utils/portal/acesso'
import { normalizarEmail } from '@/utils/portal/modelo'
import { acompanhamentoQuitacao, fichaQuitacao, FILA_QUITACAO, type AvisoQuitacao } from './acompanhamento'
import { ETAPAS_QUITACAO } from './etapas'
import { compraQuitacao } from './vinculo'

export async function tentarAvisoQuitacao(id: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false
  const ref = adminDb.collection(FILA_QUITACAO).doc(id)
  try {
    const aviso = (await ref.get()).data() as (AvisoQuitacao & { situacao: string }) | undefined
    if (aviso?.situacao !== 'pendente') return false
    const [veiculo, ficha] = await adminDb.getAll(adminDb.collection('veiculos').doc(aviso.veiculoId), fichaQuitacao(aviso.veiculoId))
    const compra = compraQuitacao(veiculo.data())
    if (!compra || compra.vinculo !== aviso.vinculo || acompanhamentoQuitacao(compra, ficha.data()).avisoId !== id) {
      await ref.update({ situacao: 'descartado' })
      return false
    }

    const cadastro = (await clientesPortal().doc(compra.documento).get()).get('portal') as CadastroPortal | undefined
    const email = normalizarEmail(cadastro?.email)
    if (!cadastro?.ativo || !cadastro.modulos.includes('quitacao') || !email) {
      await ref.update({ situacao: 'descartado' })
      return false
    }
    const acesso = await chavesPortal().doc(chaveHash(email)).get()
    if (acesso.get('documento') !== compra.documento || acesso.get('versao') !== cadastro.versao) {
      await ref.update({ situacao: 'descartado' })
      return false
    }

    const etapa = ETAPAS_QUITACAO.find(({ id }) => id === aviso.etapa)?.nome
    if (!etapa) return false
    const { error } = await new Resend(apiKey).emails.send({
      from: 'Liberty Car <noreply@grupolibertycar.com.br>',
      to: email,
      subject: 'Atualização da sua quitação | Liberty Car',
      text: `A etapa da sua quitação foi atualizada para “${etapa}”. Entre na Área do Cliente, no site da Liberty Car, para consultar o andamento.`,
    }, { idempotencyKey: `quitacao-${id}` })
    if (error) throw new Error('Resend recusou o aviso.')
    await ref.update({ situacao: 'enviado', enviadoEm: new Date().toISOString() })
    return true
  } catch {
    console.warn('[quitacao] Aviso pendente para nova tentativa.')
    return false
  }
}

export async function processarAvisosQuitacao() {
  if (!process.env.RESEND_API_KEY) return 0
  const pendentes = await adminDb.collection(FILA_QUITACAO).where('situacao', '==', 'pendente').limit(20).get()
  let enviados = 0
  for (const { id } of pendentes.docs) if (await tentarAvisoQuitacao(id)) enviados++
  return enviados
}
