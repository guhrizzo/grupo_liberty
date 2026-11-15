'use client'

import { useMemo, useRef, useState } from 'react'
import { IconAlertTriangle, IconFileSpreadsheet, IconLink } from '@tabler/icons-react'
import { Button, Modal, SegmentedControl, useToast } from '@/app/components/ui'
import { formatCurrency } from '@/utils/format'
import { maskCPFCNPJ, maskPhone } from '@/utils/masks'
import { importarProspeccoes } from './prospeccao-actions'
import { PROSPECCAO_COLUNAS } from './prospeccao-parse'
import {
  CAMPOS_COMPARADOS,
  aplicarMapa,
  celulasNotacaoCientifica,
  classificarLinhas,
  lerMatriz,
  trocarCampo,
  type Campo,
  type CampoDivergente,
  type LeituraMatriz,
  type LinhaClassificada,
  type MapaColunas,
  type Ref,
} from './prospeccao-importacao'
import { EXTENSOES_PLANILHA, lerArquivoPlanilha, type AbaPlanilha } from './ler-arquivo-planilha'
import type { LinhaImportacao, Prospeccao, ProspeccaoInput } from './types'

/** Limite por chamada ao servidor (IMPORT_MAX em prospeccao-actions). */
const PARTE = 400
const AMOSTRA = 5

const ROTULO: Record<Campo, string> = Object.fromEntries(
  PROSPECCAO_COLUNAS.map((c) => [c.key, c.label]),
) as Record<Campo, string>

const MONEY: Campo[] = ['valorEntrada', 'valorFinanciado', 'valorParcela']

function fmt(p: ProspeccaoInput, campo: Campo): string {
  const v = p[campo]
  if (v === null || v === '') return '—'
  if (MONEY.includes(campo)) return formatCurrency(v as number)
  if (campo === 'cpfCnpj') return maskCPFCNPJ(String(v))
  if (campo === 'telefone1' || campo === 'telefone2' || campo === 'telefone3') return maskPhone(String(v))
  return String(v)
}

function fmtTelefones(p: ProspeccaoInput): string {
  const t = [p.telefone1, p.telefone2, p.telefone3].filter(Boolean).map(maskPhone)
  return t.length ? t.join(' · ') : '—'
}

type Vista = 'novos' | 'divergentes' | 'duplicados'

export default function ImportarPlanilhaModal({
  open,
  onClose,
  existentes,
  onImportado,
}: {
  open: boolean
  onClose: () => void
  existentes: Prospeccao[]
  /** Recarrega a lista depois de gravar (inclusive quando a importação para no meio). */
  onImportado: () => Promise<void>
}) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const [arquivo, setArquivo] = useState<{
    nome: string
    abas: AbaPlanilha[]
  } | null>(null)
  const [abaIdx, setAbaIdx] = useState(0)
  const [lendo, setLendo] = useState(false)
  const [vista, setVista] = useState<Vista>('novos')
  const [progresso, setProgresso] = useState<{
    parte: number
    total: number
  } | null>(null)

  // Ajustes valem só para a leitura em que foram feitos: trocar de arquivo,
  // aba ou texto volta ao mapa detectado e zera as confirmações.
  const [ajusteMapa, setAjusteMapa] = useState<{
    base: LeituraMatriz
    mapa: MapaColunas
  } | null>(null)
  // Confirmações guardadas pela linha da planilha (não pelo índice do
  // registro): trocar uma coluna não desmarca o que já foi confirmado.
  const [ajusteConf, setAjusteConf] = useState<{
    base: LeituraMatriz
    linhas: Set<number>
  } | null>(null)

  const linhasBrutas = useMemo(() => arquivo?.abas[abaIdx]?.linhas ?? [], [arquivo, abaIdx])

  const leitura = useMemo(() => lerMatriz(linhasBrutas), [linhasBrutas])
  const mapa = ajusteMapa?.base === leitura ? ajusteMapa.mapa : leitura.mapa
  const { registros, origem, ignoradas } = useMemo(
    () => aplicarMapa(leitura.matriz, mapa),
    [leitura, mapa],
  )
  const suspeitas = useMemo(() => celulasNotacaoCientifica(leitura.matriz, mapa), [leitura, mapa])
  const celulaSuspeita = useMemo(
    () => new Set(suspeitas.map((s) => `${s.linha}:${s.coluna}`)),
    [suspeitas],
  )

  const existentesDados = useMemo(() => existentes.map((p) => ({ id: p.id, dados: p })), [existentes])
  const porId = useMemo(() => new Map(existentes.map((p) => [p.id, p])), [existentes])
  const classificadas = useMemo(
    () => classificarLinhas(registros, existentesDados),
    [registros, existentesDados],
  )
  const linhasMarcadas = ajusteConf?.base === leitura ? ajusteConf.linhas : null
  const marcados = new Set(
    linhasMarcadas ? classificadas.filter((l) => linhasMarcadas.has(origem[l.indice])).map((l) => l.indice) : [],
  )

  const novos = classificadas.filter((l) => l.classe === 'novo')
  const divergentes = classificadas.filter((l) => l.classe === 'divergente')
  const duplicados = classificadas.filter((l) => l.classe === 'duplicado')
  const aGravar = classificadas.filter(
    (l) => l.classe === 'novo' || (l.classe === 'divergente' && marcados.has(l.indice)),
  )
  const temNome = mapa.includes('nomeExecutado')
  const temDados = leitura.matriz.length > 0
  const importando = progresso !== null

  function limpar() {
    setArquivo(null)
    setAbaIdx(0)
    setVista('novos')
    setAjusteMapa(null)
    setAjusteConf(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function fechar() {
    if (importando) return
    limpar()
    onClose()
  }

  async function escolherArquivo(file: File | undefined) {
    if (!file) return
    setLendo(true)
    try {
      const abas = await lerArquivoPlanilha(file)
      setArquivo({ nome: file.name, abas })
      setAbaIdx(0)
      setVista('novos')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível ler o arquivo.')
    } finally {
      setLendo(false)
    }
  }

  function mudarCampo(coluna: number, valor: string) {
    setAjusteMapa({
      base: leitura,
      mapa: trocarCampo(mapa, coluna, valor ? (valor as Campo) : null),
    })
  }

  function marcar(indices: number[], ligado: boolean) {
    const next = new Set(linhasMarcadas ?? [])
    for (const i of indices) {
      if (ligado) next.add(origem[i])
      else next.delete(origem[i])
    }
    setAjusteConf({ base: leitura, linhas: next })
  }

  async function importar() {
    if (importando || aGravar.length === 0 || !temNome) return
    const linhas: LinhaImportacao[] = aGravar.map((l) => ({
      dados: l.registro,
      confirmado: l.classe === 'divergente',
    }))
    const total = Math.ceil(linhas.length / PARTE)
    let importados = 0
    let dupServidor = 0
    let pendServidor = 0
    try {
      for (let p = 0; p < total; p++) {
        setProgresso({ parte: p + 1, total })
        const res = await importarProspeccoes(linhas.slice(p * PARTE, (p + 1) * PARTE))
        if (res.error) {
          // O servidor informa quantos gravou desta parte antes do erro.
          importados += res.importados ?? 0
          toast.error(
            total > 1
              ? `Parte ${p + 1} de ${total}: ${res.error} No total, ${importados} lead(s) entraram.`
              : res.error,
          )
          await onImportado()
          return
        }
        importados += res.importados ?? 0
        dupServidor += res.duplicados ?? 0
        pendServidor += res.pendentes ?? 0
      }
      const dup = duplicados.length + dupServidor
      const pend =
        divergentes.length - divergentes.filter((l) => marcados.has(l.indice)).length + pendServidor
      toast.success(
        [
          `${importados} lead(s) importado(s).`,
          dup ? `${dup} duplicado(s) ignorado(s).` : '',
          pend ? `${pend} divergente(s) não confirmado(s) ficaram de fora.` : '',
        ]
          .filter(Boolean)
          .join(' '),
      )
      await onImportado()
      limpar()
      onClose()
    } catch (err) {
      toast.error(
        `${err instanceof Error ? err.message : 'Erro inesperado.'} ${importados} lead(s) já tinham entrado.`,
      )
      await onImportado()
    } finally {
      setProgresso(null)
    }
  }

  /** Lead correspondente (cadastrado ou linha anterior desta planilha). */
  function correspondente(ref: Ref): { titulo: string; dados: ProspeccaoInput } | null {
    if (ref.tipo === 'existente') {
      const p = porId.get(ref.id)
      return p ? { titulo: 'Cadastrado', dados: p } : null
    }
    const l = classificadas[ref.indice]
    return l ? { titulo: `Linha ${ref.indice + 1} desta planilha`, dados: l.registro } : null
  }

  const opcoesVista = [
    { value: 'novos' as const, label: `Novos (${novos.length})` },
    {
      value: 'divergentes' as const,
      label: `Divergentes (${divergentes.length})`,
    },
    {
      value: 'duplicados' as const,
      label: `Duplicados (${duplicados.length})`,
    },
  ]

  return (
    <Modal
      open={open}
      onClose={fechar}
      title="Importar planilha"
      description="Carregue o arquivo do Excel (.xlsx, .xls ou .xml). Confira as colunas e a prévia antes de importar."
      size="lg"
      className="max-h-[92vh] overflow-y-auto sm:max-w-6xl"
    >
      <div className="space-y-4 pt-2">
        {/* ── Entrada ─────────────────────────────────────────── */}
        <div className="rounded-lg border border-neutral-200 p-3">
          <p className="mb-2 text-xs font-semibold text-neutral-700">Arquivo do Excel</p>
          <input
            ref={inputRef}
            type="file"
            accept={EXTENSOES_PLANILHA}
            className="hidden"
            onChange={(e) => escolherArquivo(e.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={lendo || importando}
              leftIcon={<IconFileSpreadsheet size={16} stroke={2.2} />}
            >
              {lendo ? 'Lendo...' : arquivo ? 'Trocar arquivo' : 'Escolher arquivo'}
            </Button>
            {arquivo && (
              <span className="truncate text-xs text-neutral-600" title={arquivo.nome}>
                {arquivo.nome}
              </span>
            )}
          </div>
          {arquivo && arquivo.abas.length > 1 && (
            <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
              Aba:
              <select
                value={abaIdx}
                onChange={(e) => setAbaIdx(Number(e.target.value))}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
              >
                {arquivo.abas.map((a, i) => (
                  <option key={a.nome + i} value={i}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {!temDados ? (
          <p className="text-xs text-neutral-500">
            {arquivo ? 'Nenhuma linha com dados nesta aba.' : 'Aguardando o arquivo da planilha.'}
          </p>
        ) : (
          <>
            {/* ── Colunas ─────────────────────────────────────── */}
            <section className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-neutral-800">1. Confira as colunas</h3>
                <p className="text-[11px] text-neutral-500">
                  {leitura.porCabecalho
                    ? 'Reconhecidas pelo cabeçalho.'
                    : 'Sem cabeçalho: reconhecidas pela posição — confira com atenção.'}{' '}
                  Troque o campo no topo da coluna se estiver errado.
                </p>
              </div>
              {!temNome && (
                <p className="flex items-center gap-1.5 rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
                  <IconAlertTriangle size={14} stroke={2.2} />
                  Nenhuma coluna está marcada como &quot;Nome do Executado&quot;. O nome é obrigatório para
                  importar.
                </p>
              )}
              {suspeitas.length > 0 && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs text-rose-800">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <IconAlertTriangle size={14} stroke={2.2} />
                    {suspeitas.length} CPF/telefone(s) vieram em notação científica (ex.: 1,23E+10) — os
                    números originais se perderam.
                  </p>
                  <p className="mt-1">
                    No Excel, formate a coluna como <strong>Texto</strong>, redigite os números e carregue o
                    arquivo de novo. Se importar assim, esses campos entram errados.
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {suspeitas.slice(0, 5).map((s) => {
                      const nomeCol = mapa.indexOf('nomeExecutado')
                      const nome = nomeCol >= 0 ? leitura.matriz[s.linha][nomeCol] : ''
                      return (
                        <li key={`${s.linha}:${s.coluna}`}>
                          {nome || `Linha ${s.linha + 1}`} — {ROTULO[s.campo]}: <strong>{s.valor}</strong>
                        </li>
                      )
                    })}
                    {suspeitas.length > 5 && <li>e mais {suspeitas.length - 5}.</li>}
                  </ul>
                </div>
              )}
              <div className="max-h-72 overflow-auto rounded-lg border border-neutral-200">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead className="sticky top-0 z-10 bg-neutral-50">
                    <tr>
                      {mapa.map((campo, j) => (
                        <th
                          key={j}
                          className={`min-w-35 border-b border-r border-neutral-200 px-2 py-1.5 align-top font-normal last:border-r-0 ${
                            campo ? '' : 'bg-amber-50'
                          }`}
                        >
                          <div
                            className="mb-1 truncate font-semibold text-neutral-700"
                            title={leitura.cabecalho?.[j] || `Coluna ${j + 1}`}
                          >
                            {leitura.cabecalho?.[j] || `Coluna ${j + 1}`}
                          </div>
                          <select
                            value={campo ?? ''}
                            onChange={(e) => mudarCampo(j, e.target.value)}
                            aria-label={`Campo da coluna ${leitura.cabecalho?.[j] || j + 1}`}
                            className={`w-full rounded-md border px-1.5 py-1 text-[11px] ${
                              campo
                                ? 'border-neutral-300 bg-white text-neutral-800'
                                : 'border-amber-300 bg-amber-50 text-amber-800'
                            }`}
                          >
                            <option value="">Ignorar coluna</option>
                            {PROSPECCAO_COLUNAS.map(({ key, label }) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {leitura.matriz.slice(0, AMOSTRA).map((linha, i) => (
                      <tr key={i}>
                        {linha.map((c, j) => (
                          <td
                            key={j}
                            className={`max-w-55 truncate border-r border-neutral-100 px-2 py-1 last:border-r-0 ${
                              celulaSuspeita.has(`${i}:${j}`)
                                ? 'bg-rose-100 font-semibold text-rose-800'
                                : mapa[j]
                                  ? 'text-neutral-800'
                                  : 'bg-amber-50/50 text-neutral-400'
                            }`}
                            title={c}
                          >
                            {c || ' '}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {leitura.matriz.length > AMOSTRA && (
                <p className="text-[11px] text-neutral-500">
                  Amostra das {AMOSTRA} primeiras de {leitura.matriz.length} linhas.
                </p>
              )}
            </section>

            {/* ── Prévia consolidada ──────────────────────────── */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-800">2. Confira como os leads vão ficar</h3>
              <p className="text-xs text-neutral-600">
                <strong className="text-emerald-700">{novos.length} novo(s)</strong> ·{' '}
                <strong className="text-amber-700">{divergentes.length} divergente(s)</strong> (precisam de
                confirmação) · <strong className="text-neutral-700">{duplicados.length} duplicado(s)</strong>{' '}
                (não serão importados)
                {ignoradas > 0 && <> · {ignoradas} linha(s) sem nome ignorada(s)</>}
              </p>
              <SegmentedControl
                options={opcoesVista}
                value={vista}
                onChange={setVista}
                ariaLabel="Categoria da prévia"
              />

              {vista === 'novos' && <TabelaRegistros linhas={novos} />}

              {vista === 'divergentes' &&
                (divergentes.length === 0 ? (
                  <Vazio texto="Nenhum lead divergente." />
                ) : (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
                      <input
                        type="checkbox"
                        checked={divergentes.every((l) => marcados.has(l.indice))}
                        onChange={(e) =>
                          marcar(
                            divergentes.map((l) => l.indice),
                            e.target.checked,
                          )
                        }
                        className="h-4 w-4 cursor-pointer accent-liberty-deep"
                      />
                      Marcar todos ({divergentes.filter((l) => marcados.has(l.indice)).length} de{' '}
                      {divergentes.length} marcado(s))
                    </label>
                    <p className="text-[11px] text-neutral-500">
                      Os marcados entram como lead novo, ligado ao lead parecido (aparece o selo{' '}
                      <IconLink size={11} className="inline" /> relacionados na lista).
                    </p>
                    <div className="max-h-112 space-y-2 overflow-auto pr-1">
                      {divergentes.map((l) => (
                        <CartaoDivergente
                          key={l.indice}
                          linha={l}
                          marcado={marcados.has(l.indice)}
                          onMarcar={(v) => marcar([l.indice], v)}
                          correspondente={correspondente}
                        />
                      ))}
                    </div>
                  </div>
                ))}

              {vista === 'duplicados' &&
                (duplicados.length === 0 ? (
                  <Vazio texto="Nenhum lead duplicado." />
                ) : (
                  <div className="max-h-80 overflow-auto rounded-lg border border-neutral-200">
                    <table className="w-full border-collapse text-left text-[11px]">
                      <thead className="sticky top-0 bg-neutral-50">
                        <tr>
                          {['Linha', 'Nome do Executado', 'CPF/CNPJ', 'Placa', 'Igual a'].map((h) => (
                            <th
                              key={h}
                              className="whitespace-nowrap border-b border-neutral-200 px-2 py-1.5 font-semibold text-neutral-700"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {duplicados.map((l) => {
                          const igual = l.correspondencias.find((c) => c.divergencias.length === 0)
                          const c = igual ? correspondente(igual.ref) : null
                          return (
                            <tr key={l.indice}>
                              <td className="px-2 py-1 text-neutral-500">{l.indice + 1}</td>
                              <td className="px-2 py-1 text-neutral-800">{l.registro.nomeExecutado}</td>
                              <td className="whitespace-nowrap px-2 py-1">{fmt(l.registro, 'cpfCnpj')}</td>
                              <td className="whitespace-nowrap px-2 py-1">{fmt(l.registro, 'placa')}</td>
                              <td className="px-2 py-1 text-neutral-600">
                                {c ? `${c.titulo}: ${c.dados.nomeExecutado}` : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
            </section>
          </>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {progresso && (
            <span className="mr-auto text-xs text-neutral-500">
              Importando parte {progresso.parte} de {progresso.total}...
            </span>
          )}
          <Button type="button" variant="secondary" onClick={fechar} disabled={importando}>
            Cancelar
          </Button>
          <Button
            variant="liberty"
            onClick={importar}
            disabled={importando || aGravar.length === 0 || !temNome}
          >
            {importando ? 'Importando...' : `Importar ${aGravar.length || ''}`.trim()}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function Vazio({ texto }: { texto: string }) {
  return (
    <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-6 text-center text-xs text-neutral-500">
      {texto}
    </p>
  )
}

/** Prévia dos registros já nos campos do lead. */
function TabelaRegistros({ linhas }: { linhas: LinhaClassificada[] }) {
  if (linhas.length === 0) return <Vazio texto="Nenhum lead novo." />
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-neutral-200">
      <table className="w-full border-collapse text-left text-[11px]">
        <thead className="sticky top-0 bg-neutral-50">
          <tr>
            <th className="border-b border-neutral-200 px-2 py-1.5 font-semibold text-neutral-700">Linha</th>
            {PROSPECCAO_COLUNAS.map(({ key, label }) => (
              <th
                key={key}
                className="whitespace-nowrap border-b border-neutral-200 px-2 py-1.5 font-semibold text-neutral-700"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {linhas.map((l) => (
            <tr key={l.indice}>
              <td className="px-2 py-1 text-neutral-500">{l.indice + 1}</td>
              {PROSPECCAO_COLUNAS.map(({ key }) => {
                const v = fmt(l.registro, key)
                return (
                  <td
                    key={key}
                    className={`px-2 py-1 ${key === 'endereco' ? 'min-w-55' : 'whitespace-nowrap'} ${
                      v === '—' ? 'text-neutral-300' : 'text-neutral-800'
                    }`}
                  >
                    {v}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const LINHAS_COMPARACAO: CampoDivergente[] = [...CAMPOS_COMPARADOS, 'telefones']

function CartaoDivergente({
  linha,
  marcado,
  onMarcar,
  correspondente,
}: {
  linha: LinhaClassificada
  marcado: boolean
  onMarcar: (v: boolean) => void
  correspondente: (ref: Ref) => { titulo: string; dados: ProspeccaoInput } | null
}) {
  const valor = (p: ProspeccaoInput, c: CampoDivergente) => (c === 'telefones' ? fmtTelefones(p) : fmt(p, c))
  const rotulo = (c: CampoDivergente) => (c === 'telefones' ? 'Telefones' : ROTULO[c])

  return (
    <div
      className={`rounded-lg border p-3 ${marcado ? 'border-amber-400 bg-amber-50/40' : 'border-neutral-200'}`}
    >
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={marcado}
          onChange={(e) => onMarcar(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-liberty-deep"
        />
        <span className="text-xs">
          <strong className="text-neutral-900">{linha.registro.nomeExecutado}</strong>{' '}
          <span className="text-neutral-500">· linha {linha.indice + 1} da planilha</span>
          <span className="block text-neutral-600">Incluir como lead novo, ligado ao(s) parecido(s)</span>
        </span>
      </label>
      <div className="mt-2 space-y-2">
        {linha.correspondencias.map((c, k) => {
          const atual = correspondente(c.ref)
          if (!atual) return null
          const diverge = new Set(c.divergencias)
          // Mostra os campos que têm valor em algum dos lados.
          const campos = LINHAS_COMPARACAO.filter(
            (f) => valor(atual.dados, f) !== '—' || valor(linha.registro, f) !== '—',
          )
          return (
            <div key={k} className="overflow-x-auto rounded-md border border-neutral-200">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="w-40 px-2 py-1 font-semibold text-neutral-600">Campo</th>
                    <th className="px-2 py-1 font-semibold text-neutral-600">{atual.titulo}</th>
                    <th className="px-2 py-1 font-semibold text-neutral-600">Planilha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {campos.map((f) => (
                    <tr key={f} className={diverge.has(f) ? 'bg-amber-100/70' : undefined}>
                      <td className="px-2 py-1 text-neutral-600">
                        {rotulo(f)}
                        {diverge.has(f) && <span className="ml-1 font-semibold text-amber-700">≠</span>}
                      </td>
                      <td className="px-2 py-1 text-neutral-800">{valor(atual.dados, f)}</td>
                      <td
                        className={`px-2 py-1 ${diverge.has(f) ? 'font-semibold text-amber-900' : 'text-neutral-800'}`}
                      >
                        {valor(linha.registro, f)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </div>
  )
}
