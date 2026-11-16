'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { BlocoContrato, ContratoBlocos } from './blocos'

// Prévia do contrato em folhas A4, atualizada a cada tecla. Usa as mesmas
// medidas do PDF (595×842 pt, margens de 64/80 pt, fonte de 11,5 pt), então as
// quebras de página ficam próximas das do PDF final (um parágrafo nunca é
// cortado ao meio aqui, mas pode ser no PDF).
// `[campo]` = lacuna ainda não preenchida (destacada); `**x**` = negrito.

const LARGURA = 794 // A4 a 96 dpi (px)
const ALTURA = 1123
const MARGEM_V = 64 // pt
const MARGEM_H = 80 // pt
const UTIL = ((842 - 2 * MARGEM_V) * 96) / 72 // altura útil da folha (px)

type Unidade =
  | { k: 'b'; b: Extract<BlocoContrato, { tipo: 'titulo' | 'secao' | 'p' }> }
  | { k: 'a'; letra: string; texto: string; ultima: boolean }
  /** Tabela inteira: nunca é dividida entre duas folhas. */
  | { k: 't'; linhas: [string, string][] }
  /** Todas as assinaturas juntas, na mesma folha (e junto da data). */
  | { k: 's'; itens: { nome: string; documento: string; papel: string }[] }

/** Quebra os blocos em unidades que podem trocar de página (tabela inteira, alínea, assinatura). */
function paraUnidades(blocos: BlocoContrato[]): Unidade[] {
  const out: Unidade[] = []
  for (const b of blocos) {
    if (b.tipo === 'alineas') {
      b.itens.forEach((texto, idx) =>
        out.push({ k: 'a', letra: String.fromCharCode(97 + idx), texto, ultima: idx === b.itens.length - 1 }),
      )
    } else if (b.tipo === 'tabela') {
      out.push({ k: 't', linhas: b.linhas })
    } else if (b.tipo === 'assinaturas') {
      out.push({ k: 's', itens: b.itens })
    } else {
      out.push({ k: 'b', b })
    }
  }
  return out
}

function Lacunas({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\[[^\]]*\])/g).map((parte, idx) =>
        /^\[[^\]]*\]$/.test(parte) ? (
          <mark key={idx} className="rounded-sm bg-amber-200 px-0.5 font-normal text-amber-950">
            {parte}
          </mark>
        ) : (
          parte
        ),
      )}
    </>
  )
}

function Rico({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/\*\*(.+?)\*\*/g).map((parte, idx) =>
        idx % 2 === 1 ? (
          <strong key={idx}>
            <Lacunas texto={parte} />
          </strong>
        ) : (
          <Lacunas key={idx} texto={parte} />
        ),
      )}
    </>
  )
}

// O espaçamento usa padding (e não margin) para a altura medida de cada
// unidade já incluir o espaço depois dela.
function UnidadeView({ u }: { u: Unidade }) {
  switch (u.k) {
    case 'b': {
      const b = u.b
      if (b.tipo === 'titulo')
        // <p role="heading"> e não <h2>: os temas escuro e neon aplicam cor/fonte
        // globais às tags h1–h6, que sumiam sobre a folha branca.
        return (
          <p role="heading" aria-level={2} className="pb-[20pt] text-center text-[14pt] font-bold">
            {b.texto}
          </p>
        )
      if (b.tipo === 'secao')
        return (
          <p role="heading" aria-level={3} className="pb-[8pt] pt-[16pt] font-bold">
            {b.texto}
          </p>
        )
      return b.rotulo ? (
        <div className="flex gap-[6pt] pb-[9pt]">
          <strong className="w-[34pt] shrink-0">{b.rotulo}</strong>
          <p className="flex-1 text-justify">
            <Rico texto={b.texto} />
          </p>
        </div>
      ) : (
        <p className="pb-[9pt] text-justify">
          <Rico texto={b.texto} />
        </p>
      )
    }
    case 'a':
      return (
        <div className={`flex gap-[4pt] text-[10.5pt] ${u.ultima ? 'pb-[9pt]' : 'pb-[3pt]'}`}>
          <span className="w-[16pt] shrink-0">{u.letra}.</span>
          <p className="flex-1 text-justify">
            <Rico texto={u.texto} />
          </p>
        </div>
      )
    case 't':
      return (
        <div className="pb-[12pt]">
          <table className="w-full border-collapse">
            <tbody>
              {u.linhas.map(([rotulo, valor]) => (
                <tr key={rotulo}>
                  <th className="w-[36%] border border-black px-[4pt] py-[1.5pt] text-center font-bold text-black">{rotulo}</th>
                  <td className="h-[1.6em] border border-black px-[6pt] py-[1.5pt] text-black">{valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 's':
      return (
        <div>
          {u.itens.map((a) => (
            <div key={a.papel} className="flex items-end justify-between gap-4 pt-[34pt]">
              <p className="font-bold">
                <Lacunas texto={a.nome} />
                <br />
                <Lacunas texto={a.documento} />
                <br />
                {a.papel}
              </p>
              <span className="mb-[2pt] w-[128pt] shrink-0 border-b border-black" />
            </div>
          ))}
        </div>
      )
  }
}

/**
 * Distribui as unidades em folhas, dadas as alturas medidas. Título de seção e
 * parágrafo que apresenta uma tabela ou uma lista de alíneas não ficam sozinhos
 * no fim da folha: vão junto com o que vem depois.
 */
function paginar(unidades: Unidade[], alturas: number[]): Unidade[][] {
  const paginas: Unidade[][] = [[]]
  let usado = 0
  unidades.forEach((u, i) => {
    const h = alturas[i] ?? 0
    const prox = unidades[i + 1]
    const prende = u.k === 'b' && (u.b.tipo === 'secao' || (u.b.tipo === 'p' && (prox?.k === 't' || prox?.k === 'a' || prox?.k === 's')))
    const precisa = prende ? h + (alturas[i + 1] ?? 0) : h
    if (usado > 0 && usado + precisa > UTIL) {
      paginas.push([])
      usado = 0
    }
    paginas[paginas.length - 1].push(u)
    usado += h
  })
  return paginas
}

const FOLHA: React.CSSProperties = {
  // Folha de papel: sempre branca com texto preto, também no tema escuro.
  backgroundColor: '#fff',
  color: '#000',
  fontFamily: '"Times New Roman", Times, serif',
  fontSize: '11.5pt',
  lineHeight: 1.35,
}

export default function ContratoPreview({ contrato }: { contrato: ContratoBlocos }) {
  const unidades = useMemo(() => paraUnidades(contrato.blocos), [contrato])
  const [paginas, setPaginas] = useState<Unidade[][]>(() => [unidades])
  const [escala, setEscala] = useState(1)
  const medidor = useRef<HTMLDivElement>(null)
  const raiz = useRef<HTMLDivElement>(null)

  // Mede cada unidade (fora da tela, com a largura útil da folha) e reparte em folhas.
  useLayoutEffect(() => {
    const medir = () => {
      const filhos = medidor.current?.children
      if (!filhos || filhos.length !== unidades.length) return
      const alturas = Array.from(filhos, (el) => el.getBoundingClientRect().height)
      setPaginas(paginar(unidades, alturas))
    }
    medir()
    // Refaz quando a fonte do papel terminar de carregar (muda as alturas).
    let ativo = true
    document.fonts?.ready.then(() => ativo && medir())
    return () => {
      ativo = false
    }
  }, [unidades])

  // Encolhe as folhas quando a área é mais estreita que um A4.
  useLayoutEffect(() => {
    const el = raiz.current
    if (!el) return
    const ajustar = () => setEscala(Math.min(1, el.clientWidth / LARGURA))
    ajustar()
    const obs = new ResizeObserver(ajustar)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={raiz} aria-label="Pré-visualização do contrato" className="w-full">
      {/* Medição: invisível e fora do fluxo, com a largura útil da folha. */}
      <div
        ref={medidor}
        aria-hidden
        className="pointer-events-none invisible absolute -left-[9999px] top-0"
        style={{ ...FOLHA, width: `calc(${LARGURA}px - ${2 * MARGEM_H}pt)` }}
      >
        {unidades.map((u, i) => (
          <div key={i}>
            <UnidadeView u={u} />
          </div>
        ))}
      </div>

      <div className="space-y-5">
        {paginas.map((pagina, n) => (
          <figure key={n}>
            <div className="mx-auto" style={{ width: LARGURA * escala, height: ALTURA * escala }}>
              <div
                className="overflow-hidden rounded-sm shadow-md"
                style={{
                  ...FOLHA,
                  width: LARGURA,
                  height: ALTURA,
                  padding: `${MARGEM_V}pt ${MARGEM_H}pt`,
                  transform: `scale(${escala})`,
                  transformOrigin: 'top left',
                }}
              >
                {pagina.map((u, i) => (
                  <UnidadeView key={i} u={u} />
                ))}
              </div>
            </div>
            <figcaption className="mt-1.5 text-center text-[11px] font-semibold text-neutral-500">
              Página {n + 1} de {paginas.length}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
