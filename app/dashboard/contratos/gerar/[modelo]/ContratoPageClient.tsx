'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { IconArrowLeft, IconFileDownload, IconFileText } from '@tabler/icons-react'
import { Button, Input, SegmentedControl, Select, useToast } from '@/app/components/ui'
import { ESTADOS_CIVIS, precisaConjuge } from '@/utils/cobrancas/pessoa'
import { maskCPFCNPJ, maskMoney, maskPhone, maskPlate, maskRenavam, moneyFromNumber, onlyDigits } from '@/utils/masks'
import { gerarContratoAction, listarClientesContratoAction } from '../actions'
import { baixarPdf } from '../baixar-pdf'
import { Bloco, Marcar } from '../campos'
import ContratoPreview from '../ContratoPreview'
import { montarContratoGerado } from '../montar'
import {
  FORMAS_PAGAMENTO,
  TIPOS_CONTRATO_GERADO,
  TIPO_PROMESSA,
  compraVazia,
  conjugeVazio,
  contratanteVazio,
  locacaoVazia,
  prestacaoVazia,
  validarGerarContrato,
  veiculoContratoVazio,
  type ClienteContrato,
  type GerarContratoInput,
  type TipoContratoGerado,
  type VeiculoParaContrato,
} from '../types'

type Aba = 'dados' | 'contrato'

const ABAS: { value: Aba; label: string }[] = [
  { value: 'dados', label: 'Preencher dados' },
  { value: 'contrato', label: 'Contrato' },
]

const soDigitos = (v: string, max: number) => onlyDigits(v).slice(0, max)
const maskCep = (v: string) => soDigitos(v, 8).replace(/^(\d{5})(\d)/, '$1-$2')

// A promessa de compra não usa cônjuge: valor fixo do formulário.
const CONJUGE_VAZIO = conjugeVazio()

export default function ContratoPageClient({ tipo, veiculos }: { tipo: TipoContratoGerado; veiculos: VeiculoParaContrato[] }) {
  const toast = useToast()
  const [isPending, startTransition] = useTransition()
  const [c, setC] = useState(contratanteVazio)
  const [conj, setConj] = useState(conjugeVazio)
  const [v, setV] = useState(veiculoContratoVazio)
  const [p, setP] = useState(prestacaoVazia)
  const [l, setL] = useState(locacaoVazia)
  const [k, setK] = useState(compraVazia)
  const [salvarCliente, setSalvarCliente] = useState(false)
  const [clientes, setClientes] = useState<ClienteContrato[]>([])
  const [aba, setAba] = useState<Aba>('dados')

  const info = useMemo(() => TIPOS_CONTRATO_GERADO.find((t) => t.value === tipo)!, [tipo])
  const promessa = tipo === TIPO_PROMESSA
  const casado = precisaConjuge(c.estadoCivil) && !promessa
  const vincendas = Math.max(0, (Number(p.qtdParcelas) || 0) - (Number(p.parcelasPagas) || 0))

  useEffect(() => {
    let vivo = true
    listarClientesContratoAction().then((r) => vivo && setClientes(r))
    return () => {
      vivo = false
    }
  }, [])

  const input = useMemo<GerarContratoInput>(
    () => ({
      tipo,
      contratante: c,
      conjuge: promessa ? CONJUGE_VAZIO : conj,
      veiculo: v,
      prestacao: p,
      locacao: l,
      compra: k,
      salvarCliente,
    }),
    [tipo, promessa, c, conj, v, p, l, k, salvarCliente],
  )
  const contrato = useMemo(() => montarContratoGerado(input), [input])
  const pendencia = useMemo(() => validarGerarContrato(input), [input])

  function escolherCliente(id: string) {
    const cli = clientes.find((x) => x.id === id)
    if (!cli) return
    setC({
      ...cli.contratante,
      nacionalidade: cli.contratante.nacionalidade || 'brasileiro(a)',
      cpf: maskCPFCNPJ(cli.contratante.cpf),
      telefone: maskPhone(cli.contratante.telefone),
    })
    setConj(cli.conjuge ? { ...cli.conjuge, cpf: maskCPFCNPJ(cli.conjuge.cpf) } : conjugeVazio())
  }

  function escolherVeiculo(id: string) {
    const x = veiculos.find((q) => q.id === id)
    if (!x) {
      setV((a) => ({ ...a, veiculoId: '' }))
      return
    }
    setV({ veiculoId: x.id, marcaModelo: x.marcaModelo, ano: x.ano, placa: x.placa, fipe: moneyFromNumber(x.fipe), renavam: x.renavam })
    setK((a) => ({ ...a, marca: x.marca, modelo: x.modelo }))
    setP((a) => ({
      ...a,
      banco: x.banco || a.banco,
      valorParcela: x.valorParcela ? moneyFromNumber(x.valorParcela) : a.valorParcela,
      parcelasAtraso: x.parcelasAtraso != null ? String(x.parcelasAtraso) : a.parcelasAtraso,
    }))
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

      {/* Fixo no topo ao rolar; as margens negativas compensam o padding do <main>. */}
      <div className="sticky top-0 z-20 -mx-4 bg-slate-50/90 px-4 py-2 backdrop-blur md:-mx-8 md:px-8 adobe-dark:bg-[var(--color-adobe-bg-0)]/90">
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
          <Bloco titulo={promessa ? 'Comprador' : 'Contratante'}>
            {clientes.length > 0 && (
              <Select
                id="gc-cliente-salvo"
                label="Cliente salvo (preenche os dados)"
                value=""
                onChange={(e) => escolherCliente(e.target.value)}
                options={[
                  { value: '', label: 'Selecione...' },
                  ...clientes.map((x) => ({ value: x.id, label: `${x.contratante.nome} — ${maskCPFCNPJ(x.contratante.cpf)}` })),
                ]}
              />
            )}
            <Input id="gc-nome" label="Nome completo" placeholder="Nome completo" value={c.nome} onChange={(e) => setC({ ...c, nome: e.target.value })} autoComplete="off" />
            {promessa ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input id="gc-nacionalidade" label="Nacionalidade" placeholder="brasileiro(a)" value={c.nacionalidade} onChange={(e) => setC({ ...c, nacionalidade: e.target.value })} autoComplete="off" />
                  <Select
                    id="gc-estado-civil"
                    label="Estado civil"
                    value={c.estadoCivil}
                    onChange={(e) => setC({ ...c, estadoCivil: e.target.value })}
                    options={[{ value: '', label: 'Selecione...' }, ...ESTADOS_CIVIS.map((e) => ({ value: e.value, label: e.label }))]}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input id="gc-profissao" label="Profissão" placeholder="Ex.: Motorista" value={c.profissao} onChange={(e) => setC({ ...c, profissao: e.target.value })} autoComplete="off" />
                  <Input id="gc-cpf" label="CPF" value={c.cpf} onChange={(e) => setC({ ...c, cpf: maskCPFCNPJ(e.target.value).slice(0, 14) })} inputMode="numeric" placeholder="000.000.000-00" autoComplete="off" />
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input id="gc-rg" label="RG" placeholder="00.000.000-0" value={c.rg} onChange={(e) => setC({ ...c, rg: e.target.value })} autoComplete="off" />
                  <Input id="gc-cpf" label="CPF" value={c.cpf} onChange={(e) => setC({ ...c, cpf: maskCPFCNPJ(e.target.value).slice(0, 14) })} inputMode="numeric" placeholder="000.000.000-00" autoComplete="off" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    id="gc-estado-civil"
                    label="Estado civil"
                    value={c.estadoCivil}
                    onChange={(e) => setC({ ...c, estadoCivil: e.target.value })}
                    options={[{ value: '', label: 'Selecione...' }, ...ESTADOS_CIVIS.map((e) => ({ value: e.value, label: e.label }))]}
                  />
                  <Input id="gc-profissao" label="Profissão" placeholder="Ex.: Motorista" value={c.profissao} onChange={(e) => setC({ ...c, profissao: e.target.value })} autoComplete="off" />
                </div>
              </>
            )}
            <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
              <Input id="gc-cep" label="CEP" value={c.cep} onChange={(e) => setC({ ...c, cep: maskCep(e.target.value) })} onBlur={buscarCep} inputMode="numeric" placeholder="00000-000" hint="Preenche o endereço" autoComplete="off" />
              <Input id="gc-endereco" label="Endereço" value={c.endereco} onChange={(e) => setC({ ...c, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade/UF" autoComplete="off" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="gc-telefone" label={promessa ? 'Telefone' : 'Telefone (opcional)'} placeholder="(00) 00000-0000" value={c.telefone} onChange={(e) => setC({ ...c, telefone: maskPhone(e.target.value) })} inputMode="tel" autoComplete="off" />
              <Input id="gc-email" label="E-mail" placeholder="nome@exemplo.com" type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} autoComplete="off" />
            </div>
            <Marcar id="gc-salvar" checked={salvarCliente} onChange={setSalvarCliente}>
              Salvar cliente para os próximos contratos
            </Marcar>
          </Bloco>

          {casado && (
            <Bloco titulo="Cônjuge (assina o contrato)">
              <Input id="gc-conj-nome" label="Nome completo" placeholder="Nome completo" value={conj.nome} onChange={(e) => setConj({ ...conj, nome: e.target.value })} autoComplete="off" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input id="gc-conj-rg" label="RG" placeholder="00.000.000-0" value={conj.rg} onChange={(e) => setConj({ ...conj, rg: e.target.value })} autoComplete="off" />
                <Input id="gc-conj-cpf" label="CPF" placeholder="000.000.000-00" value={conj.cpf} onChange={(e) => setConj({ ...conj, cpf: maskCPFCNPJ(e.target.value).slice(0, 14) })} inputMode="numeric" autoComplete="off" />
              </div>
              <Input id="gc-conj-prof" label="Profissão" placeholder="Ex.: Motorista" value={conj.profissao} onChange={(e) => setConj({ ...conj, profissao: e.target.value })} autoComplete="off" />
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
            {promessa ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input id="gc-marca" label="Marca" placeholder="Ex.: Hyundai" value={k.marca} onChange={(e) => setK({ ...k, marca: e.target.value })} autoComplete="off" />
                  <Input id="gc-modelo" label="Modelo" placeholder="Ex.: HB20 1.0 Sense" value={k.modelo} onChange={(e) => setK({ ...k, modelo: e.target.value })} autoComplete="off" />
                  <Input id="gc-ano" label="Ano" placeholder="AAAA" value={v.ano} onChange={(e) => setV({ ...v, ano: soDigitos(e.target.value, 4) })} inputMode="numeric" autoComplete="off" />
                  <Input id="gc-cor" label="Cor" placeholder="Ex.: Branca" value={k.cor} onChange={(e) => setK({ ...k, cor: e.target.value })} autoComplete="off" />
                  <Input id="gc-placa" label="Placa" placeholder="AAA0A00" value={v.placa} onChange={(e) => setV({ ...v, placa: maskPlate(e.target.value) })} autoComplete="off" />
                  <Input id="gc-chassi" label="Chassi" placeholder="17 caracteres" value={k.chassi} onChange={(e) => setK({ ...k, chassi: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17) })} autoComplete="off" />
                  <Input id="gc-renavam" label="RENAVAM" placeholder="00000000000" value={v.renavam} onChange={(e) => setV({ ...v, renavam: maskRenavam(e.target.value) })} inputMode="numeric" autoComplete="off" />
                  <Input id="gc-categoria" label="Categoria" placeholder="Ex.: Particular" value={k.categoria} onChange={(e) => setK({ ...k, categoria: e.target.value })} autoComplete="off" />
                </div>
                <Input id="gc-conservacao" label="Estado de conservação" placeholder="Ex.: Bom estado, sem avarias" value={k.conservacao} onChange={(e) => setK({ ...k, conservacao: e.target.value })} autoComplete="off" />
              </>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input id="gc-marcamodelo" label="Marca/modelo" placeholder="Ex.: Hyundai HB20" value={v.marcaModelo} onChange={(e) => setV({ ...v, marcaModelo: e.target.value })} autoComplete="off" />
                <Input id="gc-ano" label="Ano" placeholder="AAAA" value={v.ano} onChange={(e) => setV({ ...v, ano: soDigitos(e.target.value, 4) })} inputMode="numeric" autoComplete="off" />
                <Input id="gc-fipe" label="FIPE (R$)" placeholder="R$ 0,00" value={v.fipe} onChange={(e) => setV({ ...v, fipe: maskMoney(e.target.value) })} inputMode="numeric" autoComplete="off" />
                <Input id="gc-placa" label="Placa" placeholder="AAA0A00" value={v.placa} onChange={(e) => setV({ ...v, placa: maskPlate(e.target.value) })} autoComplete="off" />
                <Input id="gc-renavam" label="RENAVAM" placeholder="00000000000" value={v.renavam} onChange={(e) => setV({ ...v, renavam: maskRenavam(e.target.value) })} inputMode="numeric" autoComplete="off" />
              </div>
            )}
          </Bloco>

          {promessa && (
            <>
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
              <Bloco titulo="Quitação e pagamento">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input id="gc-prazoq" label="Prazo para quitar (meses)" placeholder="12" value={k.prazoQuitacao} onChange={(e) => setK({ ...k, prazoQuitacao: soDigitos(e.target.value, 3) })} inputMode="numeric" autoComplete="off" />
                  <Input id="gc-vtotal" label="Valor total do contrato (R$)" placeholder="R$ 0,00" value={k.valorTotal} onChange={(e) => setK({ ...k, valorTotal: maskMoney(e.target.value) })} inputMode="numeric" autoComplete="off" />
                </div>
                <Select id="gc-forma" label="Forma de pagamento" value={k.formaPagamento} onChange={(e) => setK({ ...k, formaPagamento: e.target.value })} options={FORMAS_PAGAMENTO.map((f) => ({ value: f.value, label: f.label }))} />
              </Bloco>
            </>
          )}

          {tipo === 'prestacao-de-servico' && (
            <Bloco titulo="Financiamento e proposta">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input id="gc-banco" label="Banco financiado" placeholder="Ex.: Omni, Bradesco" value={p.banco} onChange={(e) => setP({ ...p, banco: e.target.value })} autoComplete="off" />
                <Input id="gc-vparcela" label="Valor da parcela (R$)" placeholder="R$ 0,00" value={p.valorParcela} onChange={(e) => setP({ ...p, valorParcela: maskMoney(e.target.value) })} inputMode="numeric" autoComplete="off" />
                <Input id="gc-qtd" label="Qtd. de parcelas" placeholder="Ex.: 48" value={p.qtdParcelas} onChange={(e) => setP({ ...p, qtdParcelas: soDigitos(e.target.value, 3) })} inputMode="numeric" autoComplete="off" />
                <Input id="gc-pagas" label="Parcelas pagas" placeholder="0" value={p.parcelasPagas} onChange={(e) => setP({ ...p, parcelasPagas: soDigitos(e.target.value, 3) })} inputMode="numeric" autoComplete="off" />
                <Input id="gc-atraso" label="Parcelas em atraso" placeholder="0" value={p.parcelasAtraso} onChange={(e) => setP({ ...p, parcelasAtraso: soDigitos(e.target.value, 3) })} inputMode="numeric" autoComplete="off" />
                <Input id="gc-prazo" label="Prazo (meses)" placeholder="Ex.: 12" value={p.prazo} onChange={(e) => setP({ ...p, prazo: soDigitos(e.target.value, 3) })} inputMode="numeric" autoComplete="off" />
                <Input id="gc-proposta" label="Valor da proposta (R$)" placeholder="R$ 0,00" value={p.valorProposta} onChange={(e) => setP({ ...p, valorProposta: maskMoney(e.target.value) })} inputMode="numeric" autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Marcar id="gc-prestamista" checked={p.seguroPrestamista} onChange={(x) => setP({ ...p, seguroPrestamista: x })}>
                  Seguro prestamista (adiciona a cláusula)
                </Marcar>
                <Marcar id="gc-limpa" checked={p.limpaNome} onChange={(x) => setP({ ...p, limpaNome: x })}>
                  Limpa nome (adiciona a cláusula)
                </Marcar>
              </div>
            </Bloco>
          )}

          {tipo === 'locacao-de-veiculo' && (
            <Bloco titulo="Locação">
              <div className="grid gap-3 sm:grid-cols-3">
                <Input id="gc-lprazo" label="Prazo (meses)" placeholder="Ex.: 12" value={l.prazo} onChange={(e) => setL({ ...l, prazo: soDigitos(e.target.value, 3) })} inputMode="numeric" autoComplete="off" />
                <Input id="gc-semanal" label="Valor semanal (R$)" placeholder="R$ 0,00" value={l.valorSemanal} onChange={(e) => setL({ ...l, valorSemanal: maskMoney(e.target.value) })} inputMode="numeric" autoComplete="off" />
                <Input id="gc-caucao" label="Caução (R$)" placeholder="R$ 0,00" value={l.caucao} onChange={(e) => setL({ ...l, caucao: maskMoney(e.target.value) })} inputMode="numeric" hint="0 se não houver" autoComplete="off" />
              </div>
            </Bloco>
          )}
        </form>
      </div>
    </div>
  )
}
