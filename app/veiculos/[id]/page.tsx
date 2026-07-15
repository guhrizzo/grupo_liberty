import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'

export default async function VeiculoPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: veiculo, error } = await supabase
    .from('veiculos')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !veiculo) {
    notFound()
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-4xl bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        <h1 className="text-3xl font-bold text-neutral-950">
          {veiculo.marca} {veiculo.modelo}
        </h1>
        <p className="text-xl font-bold text-neutral-700 mt-2">{formatCurrency(veiculo.preco)}</p>

        {veiculo.fotos && veiculo.fotos.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mt-6">
            {veiculo.fotos.map((url: string, index: number) => (
              <div key={index} className="relative aspect-video rounded-lg overflow-hidden border border-neutral-200">
                <Image src={url} alt={`${veiculo.marca} ${veiculo.modelo} - Foto ${index + 1}`} fill className="object-cover" />
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold">Detalhes</h2>
          <div className="grid grid-cols-2 gap-4 text-sm text-neutral-600">
            <p>Ano: {veiculo.ano}</p>
            {veiculo.cor && <p>Cor: {veiculo.cor}</p>}
            {veiculo.quilometragem && <p>Quilometragem: {veiculo.quilometragem.toLocaleString()} km</p>}
            <p>Câmbio: {veiculo.cambio}</p>
            <p>Combustível: {veiculo.combustivel}</p>
          </div>
          {veiculo.descricao && (
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <h3 className="font-semibold text-sm mb-2">Descrição</h3>
              <p className="text-sm text-neutral-600 whitespace-pre-line">{veiculo.descricao}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
