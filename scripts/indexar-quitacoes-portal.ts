import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
  const aplicar = process.argv.includes('--apply')
  if (!process.env.PORTAL_QUITACAO_INDEX_KEY && !process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error('Configure PORTAL_QUITACAO_INDEX_KEY ou FIREBASE_PRIVATE_KEY.')
  }
  const { adminDb } = await import('./firebase-admin')
  const { compraQuitacao } = await import('../utils/quitacoes/vinculo')
  const veiculos = adminDb.collection('veiculos')
  const snapshot = await veiculos.select('sellerCpf', 'terceiro', 'dataAquisicao', 'portalQuitacaoChave').get()
  const candidatos = snapshot.docs.filter((doc) => {
    const chave = compraQuitacao(doc.data())?.chave ?? null
    return chave !== (doc.get('portalQuitacaoChave') ?? null)
  })

  let alterados = 0
  if (aplicar) {
    for (const doc of candidatos) {
      const gravou = await adminDb.runTransaction(async (tx) => {
        const atual = await tx.get(doc.ref)
        if (!atual.exists) return false
        const chave = compraQuitacao(atual.data())?.chave ?? null
        if (chave === (atual.get('portalQuitacaoChave') ?? null)) return false
        tx.update(doc.ref, { portalQuitacaoChave: chave })
        return true
      })
      if (gravou) alterados++
    }
  }

  console.log(aplicar
    ? `Índices atualizados: ${alterados}. Veículos analisados: ${snapshot.size}.`
    : `Simulação: ${candidatos.length} índices a atualizar entre ${snapshot.size} veículos. Nenhum dado alterado.`)
}

main().catch(() => {
  console.error('Não foi possível preparar os vínculos. Confira as credenciais e a configuração.')
  process.exitCode = 1
})
