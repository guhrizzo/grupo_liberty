import Link from 'next/link'
import Image from 'next/image'
import { IconCar } from '@tabler/icons-react'
import { PublicVeiculo } from './dashboard/veiculos/public'

interface PublicSoldVehiclesListProps {
  veiculos: PublicVeiculo[]
}

/**
 * Vitrine enxuta dos veículos já vendidos (seção "Vendidos recentemente" da
 * home). Sem filtros nem busca — é prova social. Cada card leva à página do
 * veículo, que mostra o estado "vendido" e esconde o formulário de proposta.
 */
export default function PublicSoldVehiclesList({ veiculos }: PublicSoldVehiclesListProps) {
  const ordenados = [...veiculos].sort((a, b) => {
    const ta = a.vendidoEm ? new Date(a.vendidoEm).getTime() : 0
    const tb = b.vendidoEm ? new Date(b.vendidoEm).getTime() : 0
    return tb - ta
  })

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {ordenados.map((v) => {
        return (
          <Link
            key={v.id}
            href={`/veiculos/${v.id}`}
            aria-label={`${v.marca} ${v.modelo} ${v.ano} — vendido`}
            className="group relative rounded-2xl border border-neutral-200 bg-white overflow-hidden liberty-card-hover"
          >
            <div className="relative aspect-16/10 bg-neutral-100 overflow-hidden">
              {v.fotos && v.fotos.length > 0 ? (
                <Image
                  src={v.fotos[0]}
                  alt={`${v.marca} ${v.modelo}`}
                  fill
                  className="object-cover grayscale transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-neutral-400">
                  <IconCar size={48} stroke={1.2} />
                </div>
              )}
              <div className="absolute inset-0 bg-neutral-900/10" />
              <span className="absolute top-3 left-3 inline-flex items-center rounded-md bg-neutral-900/90 backdrop-blur-sm text-white text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 border border-neutral-700 shadow-sm">
                Vendido
              </span>
            </div>

            <div className="p-5">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-400">
                {v.marca}
              </span>
              <h4 className="text-lg font-bold text-neutral-900 leading-snug truncate mt-0.5">
                {v.modelo}
              </h4>

              <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-neutral-500">
                <span>{v.ano}</span>
                <span className="text-neutral-300">•</span>
                {v.quilometragem != null ? (
                  <span>{v.quilometragem.toLocaleString('pt-BR')} km</span>
                ) : (
                  <span>Km não inf.</span>
                )}
                <span className="text-neutral-300">•</span>
                <span className="uppercase">{v.cambio}</span>
              </div>

              {/* Preço não aparece: por quanto o veículo foi vendido é interno. */}
              <div className="mt-4 pt-4 border-t border-neutral-200">
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Vendido
                </p>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
