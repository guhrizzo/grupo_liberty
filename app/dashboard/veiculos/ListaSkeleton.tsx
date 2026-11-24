'use client'

import { useLayoutEffect } from 'react'
import { SkeletonCard, SkeletonRows } from '@/app/components/ui'
import { useModoVisualizacao } from '../../components/useModoVisualizacao'

const CHAVE_MODO = 'dashboard_veiculos_modo'

// Roda no HTML inicial, antes da primeira pintura: o servidor não conhece o modo salvo
// e, sem isso, o skeleton apareceria sempre em blocos até a hidratação.
const SCRIPT_MODO = `try{document.documentElement.setAttribute('data-modo-veiculos',localStorage.getItem('${CHAVE_MODO}')==='lista'?'lista':'blocos')}catch(e){}`

/**
 * Placeholder da lista de estoque no formato escolhido (blocos ou lista).
 * Os dois formatos são renderizados e o CSS (globals.css) mostra só o do modo salvo.
 */
export default function ListaSkeleton() {
  const [modo] = useModoVisualizacao(CHAVE_MODO)

  // Navegação dentro do app: o script inline não roda, então o modo vem do hook.
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-modo-veiculos', modo)
  }, [modo])

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_MODO }} />
      <div className="sk-veiculos-blocos grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="sk-veiculos-lista">
        <SkeletonRows linhas={6} miniatura selos={2} />
      </div>
    </>
  )
}
