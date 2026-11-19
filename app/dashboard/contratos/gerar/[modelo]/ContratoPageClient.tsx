'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { IconArrowLeft, IconFileDownload, IconFileText } from '@tabler/icons-react'
import { Button, Input, SegmentedControl, Select, useToast } from '@/app/components/ui'
import { ESTADOS_CIVIS } from '@/utils/cobrancas/pessoa'
import { maskCPFCNPJ, maskMoney, maskPhone, maskPlate, maskRenavam, moneyFromNumber, onlyDigits } from '@/utils/masks'
import { gerarContratoAction, listarClientesContratoAction } from '../actions'
import { baixarPdf } from '../baixar-pdf'
import { Bloco, Marcar } from '../campos'
import ContratoPreview from '../ContratoPreview'
import { montarContratoGerado } from '../montar'
import {
  FORMAS_PAGAMENTO,
  TIPOS_CONTRATO_GERADO,
  TIPO_LOCACAO,
  TIPO_PRESTACAO_CASAL,
  TIPO_RECUPERACAO,
  TESTEMUNHAS_PADRAO,
  TIPO_PROMESSA_PARCELADA,
  compraVazia,
  ehPrestacao,
  contratanteVazio,
  numeroDe,
  prestacaoVazia,
  validarGerarContrato,
  veiculoContratoVazio,
  type ClienteContrato,
  type ContratanteInput,
  type GerarContratoInput,
  type TipoContratoGerado,
  type VeiculoParaContrato,
} from '../types'

type Aba = 'dados' | 'contrato'

const ABAS: { value: Aba; label: string }[] = [
  { value: 'dados', label: 'Preencher dados' },
  { value: 'contrato', label: 'Contrato' },
]

const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
const placaLimpa = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '')

const soDigitos = (v: string, max: number) => onlyDigits(v).slice(0, max)
const maskCep = (v: string) => soDigitos(v, 8).replace(/^(\d{5})(\d)/, '$1-$2')
const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ContratoPageClient({ tipo, veiculos }: { tipo: TipoContratoGerado; veiculos: VeiculoParaContrato[] }) {
  const toast = useToast()
  const [isPending, startTransition] = useTransition()
  const [c, setC] = useState(contratanteVazio)
  const [w, setW] = useState(contratanteVazio)
  const [v, setV] = useState(veiculoContratoVazio)
  const [p, setP] = useState(prestacaoVazia)
  const [k, setK] = useState(() => {
    const base = compraVazia(tipo === TIPO_PROMESSA_PARCELADA)
    // Locação: a testemunha I é fixa por padrão; a II varia de contrato para contrato.
    return tipo === TIPO_LOCACAO ? { ...base, testemunhas: [{ ...TESTEMUNHAS_PADRAO[0] }, { nome: '', cpf: '' }] } : base
  })
  const [salvarCliente, setSalvarCliente] = useState(false)
  const [clientes, setClientes] = useState<ClienteContrato[]>([])
  const [aba, setAba] = useState<Aba>('dados')

  const info = useMemo(() => TIPOS_CONTRATO_GERADO.find((t) => t.value === tipo)!, [tipo])
  const parcelado = tipo === TIPO_PROMESSA_PARCELADA
  const prestacao = ehPrestacao(tipo)
  const casal = tipo === TIPO_PRESTACAO_CASAL
  const recuperacao = tipo === TIPO_RECUPERACAO
  const locacao = tipo === TIPO_LOCACAO
  const vincendas = Math.max(0, (Number(p.qtdParcelas) || 0) - (Number(p.parcelasPagas) || 0))

  // Data de assinatura padrão = hoje, no fuso do navegador. Fica para depois da
  // montagem: o servidor pode estar em outro fuso e o dia divergiria na hidratação.
  useEffect(() => {
    if (!parcelado) return
    const id = window.setTimeout(() => {
      const d = new Date()
      const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      setK((a) => (a.dataAssinatura ? a : { ...a, dataAssinatura: hoje }))
    }, 0)
    return () => window.clearTimeout(id)
  }, [parcelado])

  useEffect(() => {
    let vivo = true
    listarClientesContratoAction().then((r) => vivo && setClientes(r))
    return () => {
      vivo = false
    }
  }, [])

  const input = useMemo<GerarContratoInput>(
    () => ({ tipo, contratante: c, vendedor2: w, veiculo: v, prestacao: p, compra: k, salvarCliente }),
    [tipo, c, w, v, p, k, salvarCliente],
  )
  const contrato = useMemo(() => montarContratoGerado(input), [input])
  const pendencia = useMemo(() => validarGerarContrato(input), [input])

  const mudarIntermediador = (campo: keyof typeof k.intermediador, valor: string) =>
    setK((a) => ({ ...a, intermediador: { ...a.intermediador, [campo]: valor } }))
  const mudarLocacao = (campo: keyof typeof k.locacao, valor: string) =>
    setK((a) => ({ ...a, locacao: { ...a.locacao, [campo]: valor } }))
  const mudarConta = (campo: keyof typeof k.conta, valor: string) =>
    setK((a) => ({ ...a, conta: { ...a.conta, [campo]: valor } }))
  const mudarTestemunha = (idx: number, campo: 'nome' | 'cpf', valor: string) =>
    setK((a) => ({ ...a, testemunhas: a.testemunhas.map((t, n) => (n === idx ? { ...t, [campo]: valor } : t)) }))
  const mudarVencimento = (idx: number, valor: string) =>
    setK((a) => {
      const v2 = [...a.vencimentos]
      while (v2.length <= idx) v2.push('')
      v2[idx] = valor
      return { ...a, vencimentos: v2 }
    })
  const qtdPagamentos = Math.min(60, Math.max(0, Number(k.pagamentos) || 0))
  const somaParcelas = qtdPagamentos * (numeroDe(k.valorPagamento) || 0)
  const totalContrato = numeroDe(k.valorTotal) || 0
  const somaDiverge = parcelado && somaParcelas > 0 && totalContrato > 0 && Math.abs(somaParcelas - totalContrato) > 0.01

  // ─── Busca por placa (Sistema Puxa Placa) ───────────────────────────────
  // Mesmo endpoint do cadastro de veículo. Assim que a placa fica completa e válida,
  // busca sozinha (debounce de 600 ms) e preenche marca, modelo, ano, cor, chassi e
  // RENAVAM. Não roda quando um veículo do estoque está escolhido: os dados dele valem.
  const [buscandoPlaca, setBuscandoPlaca] = useState(false)
  const placaJaBuscadaRef = useRef('')

  const buscarDadosPlaca = useCallback(
    async (placa: string) => {
      setBuscandoPlaca(true)
      try {
        const res = await fetch(`/api/consulta-placa?placa=${placa}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.message || err.error || 'Não encontramos registro para a placa informada.')
        }
        const data = await res.json()
        setV((a) => ({
          ...a,
          ano: data.anoModelo ? soDigitos(String(data.anoModelo), 4) : a.ano,
          renavam: data.renavam ? maskRenavam(String(data.renavam)) : a.renavam,
        }))
        setK((a) => ({
          ...a,
          marca: data.marca || a.marca,
          modelo: data.modelo || a.modelo,
          cor: data.cor || a.cor,
          chassi: data.chassi ? String(data.chassi).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17) : a.chassi,
        }))
        if (data.rouboFurto && data.rouboFurto !== 'NAO') {
          toast.error(`Status retornado: ${data.rouboFurto}. Confira antes de seguir com o contrato.`, 'Ocorrência de roubo/furto')
        } else {
          toast.success('Marca, modelo, ano, cor, chassi e RENAVAM preenchidos. Confira os dados.', 'Placa encontrada')
        }
      } catch (err) {
        // Permite tentar de novo quando a placa for editada.
        placaJaBuscadaRef.current = ''
        toast.error(err instanceof Error ? err.message : 'Erro ao consultar a placa.', 'Falha na busca')
      } finally {
        setBuscandoPlaca(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    if (v.veiculoId) return
    const placa = placaLimpa(v.placa)
    if (!PLACA_REGEX.test(placa)) {
      placaJaBuscadaRef.current = ''
      return
    }
    if (placaJaBuscadaRef.current === placa) return
    const id = window.setTimeout(() => {
      placaJaBuscadaRef.current = placa
      void buscarDadosPlaca(placa)
    }, 600)
    return () => window.clearTimeout(id)
  }, [v.placa, v.veiculoId, buscarDadosPlaca])

  function escolherVeiculo(id: string) {
    const x = veiculos.find((q) => q.id === id)
    if (!x) {
      setV((a) => ({ ...a, veiculoId: '' }))
      return
    }
    // Já temos os dados do estoque: não consulta essa placa de novo se o veículo for desmarcado.
    placaJaBuscadaRef.current = placaLimpa(x.placa)
    setV({ veiculoId: x.id, ano: x.ano, placa: x.placa, renavam: x.renavam })
    setK((a) => ({ ...a, marca: x.marca, modelo: x.modelo }))
    setP((a) => ({
      ...a,
      banco: x.banco || a.banco,
      valorParcela: x.valorParcela ? moneyFromNumber(x.valorParcela) : a.valorParcela,
      parcelasAtraso: x.parcelasAtraso != null ? String(x.parcelasAtraso) : a.parcelasAtraso,
    }))
  }

  function gerar() {
    if (pendencia) {
      toast.error(pendencia, 'Faltam dados')
      return
    }
    startTransition(async () => {
      const res = await gerarContratoAction(input)
      if ('error' in res) {
        toast.error(res.error, 'Não foi possível gerar')
        return
      }
      baixarPdf(res.pdfBase64, res.fileName)
      toast.success(res.guardadoNoVeiculo ? 'Contrato gerado e guardado no veículo.' : 'Contrato gerado.')
      res.avisos.forEach((a) => toast.error(a))
    })
  }

  return (
    <div className="space-y-4">
      {/* ── Cabeçalho ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-liberty/10 text-liberty">
            <IconFileText size={22} stroke={2} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-neutral-950 md:text-3xl">{info.label}</h1>
            <p className="mt-0.5 text-xs text-neutral-500 md:text-sm">
              {pendencia ? (
                <>
                  Preencha os dados e confira o resultado na aba Contrato. <span className="font-semibold text-amber-700">Falta: {pendencia}</span>
                </>
              ) : (
                <span className="font-semibold text-emerald-700">Tudo preenchido. Confira a prévia e gere o PDF.</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard/contratos/gerar"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition-ui hover:bg-neutral-50 md:px-4"
          >
            <IconArrowLeft size={14} stroke={2.5} />
            <span className="hidden sm:inline">Voltar para modelos</span>
          </Link>
          <Button variant="liberty" leftIcon={<IconFileDownload size={16} />} onClick={gerar} loading={isPending} loadingLabel="Gerando..." disabled={!!pendencia} title={pendencia ?? undefined}>
            Gerar PDF
          </Button>
        </div>
      </div>

      {/* Fixo no topo ao rolar. O <main> do dashboard tem 2rem de padding no topo e a rolagem
          acontece dentro dele: `-top-8` anula esse padding e a faixa cola no topo, sem deixar a folha
          aparecer acima. As margens negativas compensam o padding lateral. */}
      <div className="sticky -top-8 z-20 -mx-4 bg-slate-50/90 px-4 py-2 backdrop-blur md:-mx-8 md:px-8 adobe-dark:bg-[var(--color-adobe-bg-0)]/90">
        <SegmentedControl options={ABAS} value={aba} onChange={setAba} ariaLabel="Seção do contrato" />
      </div>

      {aba === 'contrato' && (
        <section aria-label="Prévia do contrato" className="space-y-3">
          {pendencia && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Os campos em amarelo ainda estão vazios. Volte em &quot;Preencher dados&quot; para completar.
            </p>
          )}
          <div className="rounded-xl border border-neutral-200 bg-neutral-100 p-3 md:p-5 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-3">
            <ContratoPreview contrato={contrato} />
          </div>
        </section>
      )}

      <div className={`mx-auto w-full max-w-3xl ${aba === 'dados' ? '' : 'hidden'}`}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            gerar()
          }}
          className="space-y-4"
        >
          <Bloco titulo={casal ? 'Vendedor I' : prestacao ? 'Vendedor' : recuperacao ? 'Contratante' : locacao ? 'Locatário' : 'Comprador'}>
            <PessoaCampos
              prefixo="gc"
              c={c}
              setC={setC}
              clientes={clientes}
              comRg={casal || recuperacao}
              comTelefone={!parcelado}
            />
            <Marcar id="gc-salvar" checked={salvarCliente} onChange={setSalvarCliente}>
              Salvar cliente para os próximos contratos
            </Marcar>
          </Bloco>

          {casal && (
            <Bloco titulo="Vendedor II">
              <PessoaCampos prefixo="gc2" c={w} setC={setW} clientes={clientes} comRg comTelefone />
            </Bloco>
          )}

          <Bloco titulo="Veículo">
            <Select
              id="gc-veiculo"
              label="Veículo do estoque (preenche os dados e guarda o contrato nele)"
              value={v.veiculoId}
              onChange={(e) => escolherVeiculo(e.target.value)}
              options={[{ value: '', label: 'Nenhum (digitar à mão)' }, ...veiculos.map((x) => ({ value: x.id, label: x.rotulo }))]}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="gc-marca" label="Marca" placeholder="Ex.: Hyundai" value={k.marca} onChange={(e) => setK({ ...k, marca: e.target.value })} autoComplete="off" />
              <Input id="gc-modelo" label="Modelo" placeholder="Ex.: HB20 1.0 Sense" value={k.modelo} onChange={(e) => setK({ ...k, modelo: e.target.value })} autoComplete="off" />
              <Input id="gc-ano" label="Ano" placeholder="AAAA" value={v.ano} onChange={(e) => setV({ ...v, ano: soDigitos(e.target.value, 4) })} inputMode="numeric" autoComplete="off" />
              <Input id="gc-cor" label="Cor" placeholder="Ex.: Branca" value={k.cor} onChange={(e) => setK({ ...k, cor: e.target.value })} autoComplete="off" />
              <Input
                id="gc-placa"
                label="Placa"
                placeholder="AAA0A00"
                value={v.placa}
                onChange={(e) => setV({ ...v, placa: maskPlate(e.target.value) })}
                hint={buscandoPlaca ? 'Buscando dados da placa…' : 'Ao completar a placa, preenche marca, modelo, ano, cor, chassi e RENAVAM.'}
                autoComplete="off"
              />
              <Input id="gc-chassi" label="Chassi" placeholder="17 caracteres" value={k.chassi} onChange={(e) => setK({ ...k, chassi: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17) })} autoComplete="off" />
              <Input id="gc-renavam" label="RENAVAM" placeholder="00000000000" value={v.renavam} onChange={(e) => setV({ ...v, renavam: maskRenavam(e.target.value) })} inputMode="numeric" autoComplete="off" />
              {!locacao && (
                <Input id="gc-categoria" label="Categoria" placeholder="Ex.: Particular" value={k.categoria} onChange={(e) => setK({ ...k, categoria: e.target.value })} autoComplete="off" />
              )}
            </div>
            {!locacao && (
              <Input id="gc-conservacao" label="Estado de conservação" placeholder="Ex.: Bom estado, sem avarias" value={k.conservacao} onChange={(e) => setK({ ...k, conservacao: e.target.value })} autoComplete="off" />
            )}
          </Bloco>

          {locacao && (
            <>
              <Bloco titulo="Condições da locação">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input id="gc-l-aluguel" label="Aluguel mensal (R$)" placeholder="R$ 0,00" value={k.locacao.aluguel} onChange={(e) => mudarLocacao('aluguel', maskMoney(e.target.value))} inputMode="numeric" autoComplete="off" />
                  <Input id="gc-l-dia" label="Dia do vencimento" placeholder="Ex.: 15" value={k.locacao.diaVencimento} onChange={(e) => mudarLocacao('diaVencimento', soDigitos(e.target.value, 2))} inputMode="numeric" hint="De 1 a 31" autoComplete="off" />
                  <Input id="gc-l-entrada" label="Entrada na assinatura (R$)" placeholder="R$ 0,00" value={k.locacao.entrada} onChange={(e) => mudarLocacao('entrada', maskMoney(e.target.value))} inputMode="numeric" autoComplete="off" />
                  <Input id="gc-l-primeiro" label="Primeiro pagamento" type="date" value={k.locacao.primeiroPagamento} onChange={(e) => mudarLocacao('primeiroPagamento', e.target.value)} />
                  <Input id="gc-l-parcelas" label="Parcelas até a opção de compra" placeholder="36" value={k.locacao.parcelas} onChange={(e) => mudarLocacao('parcelas', soDigitos(e.target.value, 3))} inputMode="numeric" autoComplete="off" />
                  <Input id="gc-l-franquia" label="Franquia do seguro (R$)" placeholder="R$ 0,00" value={k.locacao.franquia} onChange={(e) => mudarLocacao('franquia', maskMoney(e.target.value))} inputMode="numeric" autoComplete="off" />
                </div>
                <p className="text-xs text-neutral-500">
                  Valor total do contrato (calculado): {reais((numeroDe(k.locacao.entrada) || 0) + (Number(k.locacao.parcelas) || 0) * (numeroDe(k.locacao.aluguel) || 0))}
                </p>
              </Bloco>

              <Bloco titulo="Testemunhas">
                {[0, 1].map((idx) => (
                  <div key={idx} className="grid gap-3 sm:grid-cols-[1fr_11rem]">
                    <Input id={`gc-lt${idx}-nome`} label={`Testemunha ${idx + 1} — nome`} value={k.testemunhas[idx]?.nome ?? ''} onChange={(e) => mudarTestemunha(idx, 'nome', e.target.value)} autoComplete="off" />
                    <Input id={`gc-lt${idx}-cpf`} label="CPF" placeholder="000.000.000-00" value={maskCPFCNPJ(k.testemunhas[idx]?.cpf ?? '')} onChange={(e) => mudarTestemunha(idx, 'cpf', soDigitos(e.target.value, 11))} inputMode="numeric" autoComplete="off" />
                  </div>
                ))}
              </Bloco>
            </>
          )}

          {recuperacao && (
            <>
              <Bloco titulo="Alienação fiduciária">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input id="gc-banco" label="Instituição financeira" placeholder="Ex.: Omni, Bradesco" value={p.banco} onChange={(e) => setP({ ...p, banco: e.target.value })} autoComplete="off" />
                  <Input id="gc-ncontrato" label="Nº do contrato" placeholder="Número do financiamento" value={k.numeroContrato} onChange={(e) => setK({ ...k, numeroContrato: e.target.value })} autoComplete="off" />
                </div>
              </Bloco>

              <Bloco titulo="Conta para recebimento">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input id="gc-c-titular" label="Titular da conta" value={k.conta.titular} onChange={(e) => mudarConta('titular', e.target.value)} autoComplete="off" />
                  <Input id="gc-c-doc" label="CPF/CNPJ do titular" placeholder="000.000.000-00" value={maskCPFCNPJ(k.conta.documento)} onChange={(e) => mudarConta('documento', soDigitos(e.target.value, 14))} inputMode="numeric" autoComplete="off" />
                  <Input id="gc-c-banco" label="Banco" value={k.conta.banco} onChange={(e) => mudarConta('banco', e.target.value)} autoComplete="off" />
                  <Input id="gc-c-agencia" label="Agência" value={k.conta.agencia} onChange={(e) => mudarConta('agencia', e.target.value)} autoComplete="off" />
                  <Input id="gc-c-conta" label="Conta" value={k.conta.conta} onChange={(e) => mudarConta('conta', e.target.value)} autoComplete="off" />
                  <Input id="gc-c-tipo" label="Tipo da conta" placeholder="Ex.: Corrente, Poupança" value={k.conta.tipoConta} onChange={(e) => mudarConta('tipoConta', e.target.value)} autoComplete="off" />
                </div>
                <Input id="gc-c-pix" label="Chave PIX (opcional)" value={k.conta.chavePix} onChange={(e) => mudarConta('chavePix', e.target.value)} autoComplete="off" />
              </Bloco>
            </>
          )}

          {!recuperacao && !locacao && (
          <Bloco titulo="Financiamento do veículo">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="gc-banco" label="Instituição financeira" placeholder="Ex.: Omni, Bradesco" value={p.banco} onChange={(e) => setP({ ...p, banco: e.target.value })} autoComplete="off" />
              <Input id="gc-tipofin" label="Tipo de financiamento" placeholder="Ex.: CDC, Leasing" value={k.tipoFinanciamento} onChange={(e) => setK({ ...k, tipoFinanciamento: e.target.value })} autoComplete="off" />
              <Input id="gc-vfinanciado" label="Valor total financiado (R$)" placeholder="R$ 0,00" value={k.valorFinanciado} onChange={(e) => setK({ ...k, valorFinanciado: maskMoney(e.target.value) })} inputMode="numeric" autoComplete="off" />
              <Input id="gc-vparcela" label="Valor de cada parcela (R$)" placeholder="R$ 0,00" value={p.valorParcela} onChange={(e) => setP({ ...p, valorParcela: maskMoney(e.target.value) })} inputMode="numeric" autoComplete="off" />
              <Input id="gc-qtd" label="Quantidade total de parcelas" placeholder="Ex.: 48" value={p.qtdParcelas} onChange={(e) => setP({ ...p, qtdParcelas: soDigitos(e.target.value, 3) })} inputMode="numeric" autoComplete="off" />
              <Input id="gc-pagas" label="Parcelas já quitadas" placeholder="0" value={p.parcelasPagas} onChange={(e) => setP({ ...p, parcelasPagas: soDigitos(e.target.value, 3) })} inputMode="numeric" autoComplete="off" />
              <Input id="gc-atraso" label="Parcelas em atraso" placeholder="0" value={p.parcelasAtraso} onChange={(e) => setP({ ...p, parcelasAtraso: soDigitos(e.target.value, 3) })} inputMode="numeric" autoComplete="off" />
              <Input id="gc-saldo" label="Saldo devedor aproximado (R$)" placeholder="R$ 0,00" value={k.saldoDevedor} onChange={(e) => setK({ ...k, saldoDevedor: maskMoney(e.target.value) })} inputMode="numeric" autoComplete="off" />
            </div>
            <p className="text-xs text-neutral-500">Parcelas vincendas (calculadas): {vincendas}</p>
          </Bloco>
          )}

          {prestacao && (
            <Bloco titulo="Pagamento ao vendedor e cláusulas opcionais">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input id="gc-vtotal" label="Valor pago ao vendedor (R$)" placeholder="R$ 0,00" value={k.valorTotal} onChange={(e) => setK({ ...k, valorTotal: maskMoney(e.target.value) })} inputMode="numeric" autoComplete="off" />
                <Input id="gc-dpag" label="Pagamento à vista até" type="date" value={k.dataPagamento} onChange={(e) => setK({ ...k, dataPagamento: e.target.value })} />
              </div>
              <Marcar id="gc-limpa" checked={k.limpaNome} onChange={(x) => setK({ ...k, limpaNome: x })}>
                Incluir o serviço “Limpa Nome” (cláusula 1.6)
              </Marcar>
              <Marcar id="gc-seguro" checked={k.seguroPrestamista} onChange={(x) => setK({ ...k, seguroPrestamista: x })}>
                Incluir as cláusulas do seguro prestamista (5.3 a 5.3.3)
              </Marcar>
            </Bloco>
          )}

          {!prestacao && !recuperacao && !locacao && (
          <Bloco titulo="Quitação e pagamento">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="gc-prazoq" label="Prazo para quitar (meses)" placeholder="12" value={k.prazoQuitacao} onChange={(e) => setK({ ...k, prazoQuitacao: soDigitos(e.target.value, 3) })} inputMode="numeric" autoComplete="off" />
              <Input id="gc-vtotal" label="Valor total do contrato (R$)" placeholder="R$ 0,00" value={k.valorTotal} onChange={(e) => setK({ ...k, valorTotal: maskMoney(e.target.value) })} inputMode="numeric" autoComplete="off" />
            </div>
            {!parcelado && (
              <Select id="gc-forma" label="Forma de pagamento" value={k.formaPagamento} onChange={(e) => setK({ ...k, formaPagamento: e.target.value })} options={FORMAS_PAGAMENTO.map((f) => ({ value: f.value, label: f.label }))} />
            )}
          </Bloco>
          )}

          {parcelado && (
            <>
              <Bloco titulo="Pagamento parcelado">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input id="gc-npag" label="Quantidade de parcelas" placeholder="2" value={k.pagamentos} onChange={(e) => setK({ ...k, pagamentos: soDigitos(e.target.value, 2) })} inputMode="numeric" hint="De 1 a 60" autoComplete="off" />
                  <Input id="gc-vpag" label="Valor de cada parcela (R$)" placeholder="R$ 0,00" value={k.valorPagamento} onChange={(e) => setK({ ...k, valorPagamento: maskMoney(e.target.value) })} inputMode="numeric" autoComplete="off" />
                </div>
                {qtdPagamentos > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: qtdPagamentos }, (_, idx) => (
                      <Input key={idx} id={`gc-venc-${idx}`} label={`Vencimento da parcela ${idx + 1}`} type="date" value={k.vencimentos[idx] ?? ''} onChange={(e) => mudarVencimento(idx, e.target.value)} />
                    ))}
                  </div>
                )}
                {somaDiverge && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {qtdPagamentos} parcelas de {reais(numeroDe(k.valorPagamento))} somam {reais(somaParcelas)}, diferente do valor total do contrato ({reais(totalContrato)}). Confira antes de gerar.
                  </p>
                )}
              </Bloco>

              <Bloco titulo="Intermediador">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input id="gc-i-razao" label="Razão social" value={k.intermediador.razaoSocial} onChange={(e) => mudarIntermediador('razaoSocial', e.target.value)} autoComplete="off" />
                  <Input id="gc-i-cnpj" label="CNPJ" placeholder="00.000.000/0000-00" value={maskCPFCNPJ(k.intermediador.cnpj)} onChange={(e) => mudarIntermediador('cnpj', soDigitos(e.target.value, 14))} inputMode="numeric" autoComplete="off" />
                </div>
                <Input id="gc-i-endereco" label="Endereço da sede" value={k.intermediador.endereco} onChange={(e) => mudarIntermediador('endereco', e.target.value)} autoComplete="off" />
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">Sócio administrador</p>
                <Input id="gc-i-nome" label="Nome completo" value={k.intermediador.nome} onChange={(e) => mudarIntermediador('nome', e.target.value)} autoComplete="off" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input id="gc-i-nac" label="Nacionalidade" value={k.intermediador.nacionalidade} onChange={(e) => mudarIntermediador('nacionalidade', e.target.value)} autoComplete="off" />
                  <Input id="gc-i-civil" label="Estado civil" value={k.intermediador.estadoCivil} onChange={(e) => mudarIntermediador('estadoCivil', e.target.value)} autoComplete="off" />
                  <Input id="gc-i-cpf" label="CPF" placeholder="000.000.000-00" value={maskCPFCNPJ(k.intermediador.cpf)} onChange={(e) => mudarIntermediador('cpf', soDigitos(e.target.value, 11))} inputMode="numeric" autoComplete="off" />
                  <Input id="gc-i-email" label="E-mail" type="email" value={k.intermediador.email} onChange={(e) => mudarIntermediador('email', e.target.value)} autoComplete="off" />
                </div>
              </Bloco>

              <Bloco titulo="Testemunhas">
                {[0, 1].map((idx) => (
                  <div key={idx} className="grid gap-3 sm:grid-cols-[1fr_11rem]">
                    <Input id={`gc-t${idx}-nome`} label={`Testemunha ${idx + 1} — nome`} value={k.testemunhas[idx]?.nome ?? ''} onChange={(e) => mudarTestemunha(idx, 'nome', e.target.value)} autoComplete="off" />
                    <Input id={`gc-t${idx}-cpf`} label="CPF" placeholder="000.000.000-00" value={maskCPFCNPJ(k.testemunhas[idx]?.cpf ?? '')} onChange={(e) => mudarTestemunha(idx, 'cpf', soDigitos(e.target.value, 11))} inputMode="numeric" autoComplete="off" />
                  </div>
                ))}
              </Bloco>

              <Bloco titulo="Local e data da assinatura">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input id="gc-cidade" label="Cidade/UF" placeholder="Jaú/SP" value={k.cidade} onChange={(e) => setK({ ...k, cidade: e.target.value })} autoComplete="off" />
                  <Input id="gc-data" label="Data" type="date" value={k.dataAssinatura} onChange={(e) => setK({ ...k, dataAssinatura: e.target.value })} />
                </div>
              </Bloco>
            </>
          )}
        </form>
      </div>
    </div>
  )
}

/** Dados pessoais de quem assina (comprador ou vendedor), com CEP que preenche o endereço. */
function PessoaCampos({
  prefixo,
  c,
  setC,
  clientes,
  comRg = false,
  comTelefone = true,
}: {
  prefixo: string
  c: ContratanteInput
  setC: React.Dispatch<React.SetStateAction<ContratanteInput>>
  clientes: ClienteContrato[]
  comRg?: boolean
  comTelefone?: boolean
}) {
  const id = (n: string) => `${prefixo}-${n}`

  function escolherCliente(clienteId: string) {
    const cli = clientes.find((x) => x.id === clienteId)
    if (!cli) return
    setC({
      ...cli.contratante,
      nacionalidade: cli.contratante.nacionalidade || 'brasileiro(a)',
      cpf: maskCPFCNPJ(cli.contratante.cpf),
      telefone: maskPhone(cli.contratante.telefone),
    })
  }

  async function buscarCep() {
    const d = soDigitos(c.cep, 8)
    if (d.length !== 8 || c.endereco.trim()) return
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`)
      const j = (await r.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
      if (j.erro) return
      const end = [j.logradouro, j.bairro, [j.localidade, j.uf].filter(Boolean).join('/')].filter(Boolean).join(', ')
      setC((a) => (a.endereco.trim() ? a : { ...a, endereco: end }))
    } catch {
      // sem internet/CEP: o usuário digita o endereço.
    }
  }

  return (
    <>
      {clientes.length > 0 && (
        <Select
          id={id('cliente-salvo')}
          label="Cliente salvo (preenche os dados)"
          value=""
          onChange={(e) => escolherCliente(e.target.value)}
          options={[
            { value: '', label: 'Selecione...' },
            ...clientes.map((x) => ({ value: x.id, label: `${x.contratante.nome} — ${maskCPFCNPJ(x.contratante.cpf)}` })),
          ]}
        />
      )}
      <Input id={id('nome')} label="Nome completo" placeholder="Nome completo" value={c.nome} onChange={(e) => setC({ ...c, nome: e.target.value })} autoComplete="off" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input id={id('nacionalidade')} label="Nacionalidade" placeholder="brasileiro(a)" value={c.nacionalidade} onChange={(e) => setC({ ...c, nacionalidade: e.target.value })} autoComplete="off" />
        <Select
          id={id('estado-civil')}
          label="Estado civil"
          value={c.estadoCivil}
          onChange={(e) => setC({ ...c, estadoCivil: e.target.value })}
          options={[{ value: '', label: 'Selecione...' }, ...ESTADOS_CIVIS.map((e) => ({ value: e.value, label: e.label }))]}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input id={id('profissao')} label="Profissão" placeholder="Ex.: Motorista" value={c.profissao} onChange={(e) => setC({ ...c, profissao: e.target.value })} autoComplete="off" />
        <Input id={id('cpf')} label="CPF" value={c.cpf} onChange={(e) => setC({ ...c, cpf: maskCPFCNPJ(e.target.value).slice(0, 14) })} inputMode="numeric" placeholder="000.000.000-00" autoComplete="off" />
      </div>
      {comRg && (
        <Input id={id('rg')} label="RG" placeholder="00.000.000-0" value={c.rg} onChange={(e) => setC({ ...c, rg: e.target.value.slice(0, 30) })} autoComplete="off" />
      )}
      <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
        <Input id={id('cep')} label="CEP" value={c.cep} onChange={(e) => setC({ ...c, cep: maskCep(e.target.value) })} onBlur={buscarCep} inputMode="numeric" placeholder="00000-000" hint="Preenche o endereço" autoComplete="off" />
        <Input id={id('endereco')} label="Endereço" value={c.endereco} onChange={(e) => setC({ ...c, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade/UF" autoComplete="off" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {comTelefone && (
          <Input id={id('telefone')} label="Telefone" placeholder="(00) 00000-0000" value={c.telefone} onChange={(e) => setC({ ...c, telefone: maskPhone(e.target.value) })} inputMode="tel" autoComplete="off" />
        )}
        <Input id={id('email')} label="E-mail" placeholder="nome@exemplo.com" type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} autoComplete="off" />
      </div>
    </>
  )
}
