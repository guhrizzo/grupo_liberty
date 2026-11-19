'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import LOGO_LIBERTY from '@/app/public/logo-liberty-car-blue.png'
import { montarRecibo } from './montar'
import type { ReciboInput } from './types'

// Simulação do recibo em folha A4, atualizada a cada tecla. Usa as mesmas medidas e o
// mesmo conteúdo do PDF (montarRecibo), então o que aparece aqui é o que será gerado.
// `[campo]` = lacuna ainda não preenchida (destacada).

const LARGURA = 794 // A4 a 96 dpi (px)
const ALTURA = 1123

// Folha de papel: sempre branca com texto escuro, também no tema escuro. Cores fixas (inline):
// o tema escuro repinta as classes de cor e sumiria sobre este fundo.
const C = { ink: '#09090b', muted: '#71717a', faint: '#a1a1aa', line: '#e4e4e7', panel: '#fafafa', amber: '#b45309', amberBg: '#fffbeb', green: '#047857', greenBg: '#ecfdf5' }

function Lacunas({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\[[^\]]*\])/g).map((parte, idx) =>
        /^\[[^\]]*\]$/.test(parte) ? (
          <mark key={idx} className="rounded-sm px-0.5 font-medium" style={{ backgroundColor: '#fde68a', color: '#451a03' }}>
            {parte}
          </mark>
        ) : (
          parte
        ),
      )}
    </>
  )
}

const rotulo: React.CSSProperties = { fontWeight: 700, fontSize: '8pt', letterSpacing: '1px', textTransform: 'uppercase', color: C.faint, marginBottom: '3pt' }

function Linha({ nome, children, ultima }: { nome: string; children: React.ReactNode; ultima?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16pt', marginBottom: ultima ? 0 : '7pt' }}>
      <span style={{ color: C.muted }}>{nome}</span>
      <span style={{ fontWeight: 700, textAlign: 'right' }}>{children}</span>
    </div>
  )
}

export default function ReciboPreview({ input }: { input: ReciboInput }) {
  // Instante da simulação: fixo enquanto a tela está aberta (o PDF usa o momento da geração).
  const agora = useMemo(() => new Date(), [])
  const m = montarRecibo(input, agora)
  const cor = m.badge?.tom === 'integral' ? C.green : m.badge ? C.amber : C.ink

  const [escala, setEscala] = useState(1)
  const raiz = useRef<HTMLDivElement>(null)
  // Encolhe a folha quando a área é mais estreita que um A4.
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
    <div ref={raiz} aria-label="Simulação do recibo" className="w-full">
      <div className="mx-auto" style={{ width: LARGURA * escala, height: ALTURA * escala }}>
        <div
          className="overflow-hidden rounded-sm shadow-md"
          style={{
            width: LARGURA,
            height: ALTURA,
            padding: '44pt 48pt',
            transform: `scale(${escala})`,
            transformOrigin: 'top left',
            backgroundColor: '#fff',
            color: C.ink,
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: '10pt',
            lineHeight: 1.5,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Cabeçalho */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22pt' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_LIBERTY.src} alt="Liberty Car" draggable={false} style={{ width: '120pt' }} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: '16pt', letterSpacing: '1px', textTransform: 'uppercase' }}>Recibo de pagamento</div>
              <div style={{ fontSize: '9pt', color: C.muted, marginTop: '4pt' }}>
                Veículo: <Lacunas texto={m.veiculo.placa} />
              </div>
              <div style={{ fontSize: '9pt', color: C.muted }}>Emitido em: {m.emitidoEm}</div>
            </div>
          </div>

          {m.badge && (
            <div
              style={{
                alignSelf: 'flex-start',
                borderRadius: 999,
                border: `1px solid ${cor}`,
                backgroundColor: m.badge.tom === 'integral' ? C.greenBg : C.amberBg,
                color: cor,
                padding: '5pt 14pt',
                marginBottom: '18pt',
                fontWeight: 700,
                fontSize: '9pt',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
              }}
            >
              {m.badge.texto}
            </div>
          )}

          <div style={{ marginBottom: '14pt' }}>
            <div style={rotulo}>Pagador</div>
            <div style={{ fontSize: '11pt' }}>
              <Lacunas texto={m.pagador.nome} />
            </div>
            <div style={{ color: C.muted }}>
              <Lacunas texto={m.pagador.documento} />
            </div>
            {m.pagador.endereco && <div style={{ color: C.muted }}>{m.pagador.endereco}</div>}
            {m.pagador.contato && <div style={{ color: C.muted }}>{m.pagador.contato}</div>}
          </div>

          <div style={{ marginBottom: '14pt' }}>
            <div style={rotulo}>Recebedor</div>
            <div style={{ fontSize: '11pt' }}>
              <Lacunas texto={m.recebedor.nome} />
            </div>
            {m.recebedor.documento && <div style={{ color: C.muted }}>{m.recebedor.documento}</div>}
            {m.recebedor.endereco && <div style={{ color: C.muted }}>{m.recebedor.endereco}</div>}
          </div>

          <div style={{ marginBottom: '14pt' }}>
            <div style={rotulo}>Veículo</div>
            <div style={{ fontSize: '11pt' }}>
              <Lacunas texto={m.veiculo.linha} />
            </div>
            {m.veiculo.docs && <div style={{ color: C.muted }}>{m.veiculo.docs}</div>}
          </div>

          <div style={{ border: `1px solid ${C.line}`, borderRadius: '10pt', backgroundColor: C.panel, padding: '16pt', marginBottom: '16pt' }}>
            <Linha nome="Referente a">
              <Lacunas texto={m.referencia} />
            </Linha>
            <Linha nome="Data do pagamento">
              <Lacunas texto={m.data} />
            </Linha>
            {m.forma && <Linha nome="Forma de pagamento">{m.forma}</Linha>}
            <div style={{ borderTop: `1px solid ${C.line}`, margin: '9pt 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: m.total === null ? 0 : '7pt' }}>
              <span style={{ color: C.muted }}>Valor recebido</span>
              <span style={{ fontWeight: 700, fontSize: '13pt', color: cor }}>
                <Lacunas texto={m.valorRecebido} />
              </span>
            </div>
            {m.total !== null && m.saldo !== null && (
              <>
                <Linha nome="Valor total do contrato">{m.total}</Linha>
                <Linha nome="Saldo restante" ultima>
                  {m.saldo}
                </Linha>
              </>
            )}
          </div>

          <p style={{ fontSize: '10.5pt', textAlign: 'justify', margin: '0 0 6pt' }}>
            <Lacunas texto={m.declaracao} />
          </p>

          <div style={{ marginTop: '40pt', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '260pt', borderTop: `1px solid ${C.ink}`, paddingTop: '4pt', textAlign: 'center' }}>
              <div style={{ fontWeight: 700 }}>
                <Lacunas texto={m.assinatura.nome} />
              </div>
              <div style={{ color: C.muted }}>{m.assinatura.detalhe}</div>
            </div>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '14pt', borderTop: `1px solid ${C.line}`, fontSize: '8pt', color: C.faint, textAlign: 'center' }}>
            Liberty Car · grupolibertycar.com.br · Jaú/SP
          </div>
        </div>
      </div>
    </div>
  )
}
