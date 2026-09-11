import 'server-only'
import { adminDb, adminStorage } from '@/utils/firebase/admin'

/**
 * Extrai o caminho do objeto dentro do bucket do Firebase Storage a partir de
 * uma URL pública. Cobre os dois formatos que o Firebase Storage gera
 * (`storage.googleapis.com/<bucket>/<path>` e `<bucket>.firebasestorage.app/<path>`).
 * Retorna `null` para URLs de outro provedor (ex.: Supabase, configurado em
 * next.config.ts mas sem suporte a exclusão aqui) — o chamador deve logar em
 * vez de ignorar a falha em silêncio.
 */
export function extractFirebaseStoragePath(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'storage.googleapis.com') {
      const segments = parsed.pathname.replace(/^\//, '').split('/')
      segments.shift() // remove o nome do bucket
      const path = segments.join('/')
      return path || null
    }
    if (parsed.hostname.endsWith('.firebasestorage.app')) {
      const path = parsed.pathname.replace(/^\//, '')
      return path || null
    }
    return null
  } catch {
    return null
  }
}

/**
 * Apaga um veículo e todos os artefatos ligados a ele: fotos no Storage,
 * documentos `veiculo_contratos` + seus PDFs, e o próprio doc do veículo.
 *
 * NÃO faz checagem de permissão — o chamador garante o acesso
 * (`deleteVehicle` após `assertPodeGerenciarVeiculos`; o cron `limpar-vendidos`
 * via `CRON_SECRET`). Também não chama `revalidatePath` — isso é
 * responsabilidade da server action que a envolve.
 *
 * Falha em foto/contrato individual apenas loga e segue; se o doc não existe,
 * retorna sem erro (pode haver concorrência entre o cron e uma exclusão manual).
 */
export async function apagarVeiculoCompleto(id: string): Promise<void> {
  const docRef = adminDb.collection('veiculos').doc(id)
  const doc = await docRef.get()
  if (!doc.exists) return

  const veiculo = doc.data()
  const bucket = adminStorage.bucket()

  // 1. Remover fotos do Storage
  if (veiculo?.fotos?.length) {
    for (const url of veiculo.fotos) {
      const filePath = extractFirebaseStoragePath(url)
      if (!filePath) {
        console.warn(`Foto com URL de provedor não suportado para exclusão automática: ${url}`)
        continue
      }
      try {
        await bucket.file(filePath).delete()
      } catch (deleteFileErr) {
        console.error(`Erro ao deletar arquivo ${filePath} do Firebase Storage:`, deleteFileErr)
      }
    }
  }

  // 2. Remover contratos anexados (PDFs) e seus arquivos no Storage
  const contratosSnap = await adminDb
    .collection('veiculo_contratos')
    .where('veiculoId', '==', id)
    .get()

  if (!contratosSnap.empty) {
    const batch = adminDb.batch()
    for (const cDoc of contratosSnap.docs) {
      const cData = cDoc.data() as { storagePath?: string }
      if (cData.storagePath) {
        try {
          await bucket.file(cData.storagePath).delete()
        } catch (storageErr) {
          console.error(`Erro ao deletar contrato ${cDoc.id} do Storage:`, storageErr)
        }
      }
      batch.delete(cDoc.ref)
    }
    await batch.commit()
  }

  // 3. Deletar o doc do veículo
  await docRef.delete()
}
