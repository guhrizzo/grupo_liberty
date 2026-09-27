import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import { decrypt } from '@/utils/crypto'
import type { Veiculo } from '@/app/dashboard/veiculos/actions'

/**
 * Descriptografa um CPF salvo. Registros gravados antes da criptografia
 * (texto plano, sem o separador ':' do formato 'ivHex:encryptedHex') caem no
 * fallback e retornam o valor bruto, para não quebrar veículos já cadastrados.
 */
function decryptCpfOrRaw(value: string | null | undefined): string {
  if (!value) return ''
  if (!value.includes(':')) return value
  return decrypt(value) || value
}

/**
 * Lista todos os veículos (inclusive dados internos: CPF do cliente/vendedor,
 * custos, financiamento). Fica fora do arquivo de server actions de propósito:
 * tudo que é exportado de um arquivo 'use server' pode ser chamado direto por
 * POST, sem passar pela página. Quem chama aqui é responsável por filtrar o
 * que vai para o cliente.
 */
export async function listarVeiculos(): Promise<Veiculo[]> {
  try {
    const snapshot = await adminDb.collection('veiculos')
      .orderBy('created_at', 'desc')
      .get()

    const vehicles: Veiculo[] = []
    snapshot.forEach((doc: any) => {
      const data = doc.data()
      const loc = data.localizacao
      const localizacao = loc === 'jau' ? 'Jaú/SP' : loc === 'bauru' ? 'Bauru/SP' : (loc || 'Jaú/SP')
      vehicles.push({
        id: doc.id,
        marca: data.marca,
        modelo: data.modelo,
        ano: data.ano,
        cor: data.cor || null,
        quilometragem: data.quilometragem || null,
        preco: data.preco ?? null,
        precoComDesconto: data.precoComDesconto ?? null,
        tabelaFipe: data.tabelaFipe ?? null,
        cambio: data.cambio,
        combustivel: data.combustivel,
        placa: data.placa || null,
        renavam: data.renavam || null,
        descricao: data.descricao || null,
        fotos: data.fotos || [],
        localizacao,
        // Migração: veículos salvos antes desse campo existir usam a antiga
        // 'finalidade' como fallback — 'venda' (ou ausente) permanece público,
        // 'pessoal' permanece privado, preservando a visibilidade que já tinham.
        publico:
          typeof data.publico === 'boolean' ? data.publico : data.finalidade !== 'pessoal',
        vendidoEm: data.vendidoEm ?? null,
        terceiro: typeof data.terceiro === 'boolean' ? data.terceiro : false,
        terceiroInfo: data.terceiroInfo ?? null,
        cpfCliente: decryptCpfOrRaw(data.cpfCliente) || null,
        telefoneCliente: data.telefoneCliente || null,
        telefoneAcessoria: data.telefoneAcessoria || null,
        valorParcela: data.valorParcela ?? null,
        custoAcumulado: data.custoAcumulado ?? null,
        precoAquisicao: data.precoAquisicao ?? null,
        custoEfetivoTotal: data.custoEfetivoTotal ?? null,
        debitos: data.debitos ?? null,
        debitosItens: Array.isArray(data.debitosItens)
          ? (data.debitosItens as Array<{
              chave: string
              valor: number
              label?: string
            }>)
          : null,
        parcelasRestantes: data.parcelasRestantes ?? null,
        banco: data.banco || null,
        bancoCodigo: data.bancoCodigo || null,
        quitacaoPercent:
          typeof data.quitacaoPercent === 'number' ? data.quitacaoPercent : null,
        descontoPercent:
          typeof data.descontoPercent === 'number' ? data.descontoPercent : null,
        bancoCnpjs: Array.isArray(data.bancoCnpjs) ? (data.bancoCnpjs as string[]) : [],
        taxaJuros: data.taxaJuros ?? null,
        taxaPeriodicidade:
          data.taxaPeriodicidade === 'anual' || data.taxaPeriodicidade === 'mensal'
            ? data.taxaPeriodicidade
            : null,
        valorEntrada: data.valorEntrada ?? null,
        sellerName: data.sellerName || null,
        sellerCpf: decryptCpfOrRaw(data.sellerCpf) || null,
        sellerBirthDate: data.sellerBirthDate || null,
        sellerCity: data.sellerCity || null,
        isVehicleInSellersName: data.isVehicleInSellersName ?? null,
        registeredOwnerName: data.registeredOwnerName || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        created_by: data.created_by || null,
      })
    })

    return vehicles
  } catch (error) {
    console.error('Erro ao buscar veículos:', error)
    return []
  }
}
