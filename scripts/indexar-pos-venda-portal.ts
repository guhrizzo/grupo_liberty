import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
  const aplicar = process.argv.includes('--apply')
  if (!process.env.PORTAL_POS_VENDA_INDEX_KEY && !process.env.PORTAL_QUITACAO_INDEX_KEY && !process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error('Chave de indexação ausente.')
  }
  const { adminDb } = await import('./firebase-admin')
  const { chaveComprador, vendaPosVenda } = await import('../utils/pos-venda/vinculo')
  const snap = await adminDb.collection('veiculos').where('vendidoEm', '>', '')
    .select('vendidoEm', 'vendidoRegistradoEm', 'cpfCliente', 'terceiro', 'portalPosVendaChave').get()
  const candidatos = snap.docs.filter((doc) => {
    const venda = vendaPosVenda(doc.data())
    return venda && chaveComprador(venda.documento) !== doc.get('portalPosVendaChave')
  })
  let alterados = 0
  if (aplicar) {
    for (const doc of candidatos) {
      const gravado = await adminDb.runTransaction(async (tx) => {
        const atual = await tx.get(doc.ref)
        const venda = vendaPosVenda(atual.data())
        if (!venda) return false
        const chave = chaveComprador(venda.documento)
        if (chave === atual.get('portalPosVendaChave')) return false
        tx.update(doc.ref, { portalPosVendaChave: chave })
        return true
      })
      if (gravado) alterados++
    }
  }
  console.log(aplicar
    ? `Vendas indexadas: ${alterados}. Vendas analisadas: ${snap.size}.`
    : `Simulação: ${candidatos.length} vínculos a atualizar em ${snap.size} vendas. Nenhum dado alterado.`)
}

main().catch(() => {
  console.error('Não foi possível preparar os vínculos. Confira a configuração do Firebase.')
  process.exitCode = 1
})
