'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { IconFilePencil, IconFileDownload } from '@tabler/icons-react'
import { Button, Input, Modal, Select, useToast } from '@/app/components/ui'
import { ESTADOS_CIVIS, precisaConjuge } from '@/utils/cobrancas/pessoa'
import { maskCPFCNPJ, maskMoney, maskPhone, maskPlate, maskRenavam, moneyFromNumber, onlyDigits } from '@/utils/masks'
import { gerarContratoAction, listarClientesContratoAction } from './actions'
import {
  TIPOS_CONTRATO_GERADO,
  conjugeVazio,
  contratanteVazio,
  locacaoVazia,
  prestacaoVazia,
  veiculoContratoVazio,
  type ClienteContrato,
  type TipoContratoGerado,
} from './types'

/** Veículo do estoque como o formulário o usa para pré-preencher. */
export interface VeiculoParaContrato {
  id: string
  rotulo: string
  marcaModelo: string
  ano: string
  placa: string
  fipe: number | null
  renavam: string
  banco: string
  valorParcela: number | null
  parcelasAtraso: number | null
}

const soDigitos = (v: string, max: number) => onlyDigits(v).slice(0, max)
const maskCep = (v: string) => soDigitos(v, 8).replace(/^(\d{5})(\d)/, '$1-$2')

function baixarPdf(base64: string, nome: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export default function GerarContratoSection({ veiculos }: { veiculos: VeiculoParaContrato[] }) {
  const [aberto, setAberto] = useState(false)
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-neutral-700">
            <IconFilePencil size={18} className="text-liberty-deep" />
            Gerar contrato preenchido
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Escolha o modelo, preencha os dados e baixe o contrato pronto em PDF.
          </p>
        </div>
        <Button variant="liberty" size="sm" leftIcon={<IconFileDownload size={14} />} onClick={() => setAberto(true)}>
          Gerar contrato
        </Button>
      </div>
      {aberto && <GerarContratoModal veiculos={veiculos} onClose={() => setAberto(false)} />}
    </section>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 p-3.5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">{titulo}</p>
      {children}
    </div>
  )
}

function Marcar({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-liberty,#0a84ff)]" />
      {children}
    </label>
  )
}

function GerarContratoModal({ veiculos, onClose }: { veiculos: VeiculoParaContrato[]; onClose: () => void }) {
  const toast = useToast()
  const [isPending, startTransition] = useTransition()
  const [tipo, setTipo] = useState<TipoContratoGerado>('prestacao-de-servico')
  const [c, setC] = useState(contratanteVazio)
  const [conj, setConj] = useState(conjugeVazio)
  const [v, setV] = useState(veiculoContratoVazio)
  const [p, setP] = useState(prestacaoVazia)
  const [l, setL] = useState(locacaoVazia)
  const [salvarCliente, setSalvarCliente] = useState(false)
  const [clientes, setClientes] = useState<ClienteContrato[]>([])

  useEffect(() => {
    let vivo = true
    listarClientesContratoAction().then((r) => vivo && setClientes(r))
    return () => {
      vivo = false
    }
  }, [])

  const casado = precisaConjuge(c.estadoCivil)
  const tipoInfo = useMemo(() => TIPOS_CONTRATO_GERADO.find((t) => t.value === tipo)!, [tipo])

  function escolherCliente(id: string) {
    const cli = clientes.find((x) => x.id === id)
    if (!cli) return
    setC({ ...cli.contratante, cpf: maskCPFCNPJ(cli.contratante.cpf), telefone: maskPhone(cli.contratante.telefone) })
    setConj(cli.conjuge ? { ...cli.conjuge, cpf: maskCPFCNPJ(cli.conjuge.cpf) } : conjugeVazio())
  }

  function escolherVeiculo(id: string) {
    const x = veiculos.find((q) => q.id === id)
    if (!x) {
      setV((a) => ({ ...a, veiculoId: '' }))
      return
    }
    setV({
      veiculoId: x.id,
      marcaModelo: x.marcaModelo,
      ano: x.ano,
      placa: x.placa,
      fipe: moneyFromNumber(x.fipe),
      renavam: x.renavam,
    })
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

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await gerarContratoAction({ tipo, contratante: c, conjuge: conj, veiculo: v, prestacao: p, locacao: l, salvarCliente })
      if ('error' in res) {
        toast.error(res.error, 'Não foi possível gerar')
        return
      }
      baixarPdf(res.pdfBase64, res.fileName)
      toast.success(res.guardadoNoVeiculo ? 'Contrato gerado e guardado no veículo.' : 'Contrato gerado.')
      res.avisos.forEach((a) => toast.error(a))
      onClose()
    })
  }

  return (
    <Modal open onClose={onClose} size="lg" title="Gerar contrato" description={tipoInfo.descricao}>
      <form onSubmit={enviar} className="space-y-4">
        <Select
          id="gc-tipo"
          label="Modelo de contrato"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoContratoGerado)}
          options={TIPOS_CONTRATO_GERADO.map((t) => ({ value: t.value, label: t.label }))}
        />

        <Bloco titulo="Contratante">
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
          <Input id="gc-nome" label="Nome completo" value={c.nome} onChange={(e) => setC({ ...c, nome: e.target.value })} autoComplete="off" required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input id="gc-rg" label="RG" value={c.rg} onChange={(e) => setC({ ...c, rg: e.target.value })} autoComplete="off" required />
            <Input id="gc-cpf" label="CPF" value={c.cpf} onChange={(e) => setC({ ...c, cpf: maskCPFCNPJ(e.target.value).slice(0, 14) })} inputMode="numeric" placeholder="000.000.000-00" autoComplete="off" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <Input id="gc-cep" label="CEP" value={c.cep} onChange={(e) => setC({ ...c, cep: maskCep(e.target.value) })} onBlur={buscarCep} inputMode="numeric" placeholder="00000-000" autoComplete="off" />
            <Input id="gc-endereco" label="Endereço" value={c.endereco} onChange={(e) => setC({ ...c, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade/UF" autoComplete="off" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              id="gc-estado-civil"
              label="Estado civil"
              value={c.estadoCivil}
              onChange={(e) => setC({ ...c, estadoCivil: e.target.value })}
              options={[{ value: '', label: 'Selecione...' }, ...ESTADOS_CIVIS.map((e) => ({ value: e.value, label: e.label }))]}
              required
            />
            <Input id="gc-profissao" label="Profissão" value={c.profissao} onChange={(e) => setC({ ...c, profissao: e.target.value })} autoComplete="off" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input id="gc-email" label="E-mail" type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} autoComplete="off" required />
            <Input id="gc-telefone" label="Telefone (opcional)" value={c.telefone} onChange={(e) => setC({ ...c, telefone: maskPhone(e.target.value) })} inputMode="tel" autoComplete="off" />
          </div>
          <Marcar id="gc-salvar" checked={salvarCliente} onChange={setSalvarCliente}>
            Salvar cliente para os próximos contratos
          </Marcar>
        </Bloco>

        {casado && (
          <Bloco titulo="Cônjuge (assina o contrato)">
            <Input id="gc-conj-nome" label="Nome completo" value={conj.nome} onChange={(e) => setConj({ ...conj, nome: e.target.value })} autoComplete="off" required />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="gc-conj-rg" label="RG" value={conj.rg} onChange={(e) => setConj({ ...conj, rg: e.target.value })} autoComplete="off" />
              <Input id="gc-conj-cpf" label="CPF" value={conj.cpf} onChange={(e) => setConj({ ...conj, cpf: maskCPFCNPJ(e.target.value).slice(0, 14) })} inputMode="numeric" autoComplete="off" required />
            </div>
            <Input id="gc-conj-prof" label="Profissão" value={conj.profissao} onChange={(e) => setConj({ ...conj, profissao: e.target.value })} autoComplete="off" />
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
            <Input id="gc-marca" label="Marca/modelo" value={v.marcaModelo} onChange={(e) => setV({ ...v, marcaModelo: e.target.value })} autoComplete="off" required />
            <Input id="gc-ano" label="Ano" value={v.ano} onChange={(e) => setV({ ...v, ano: soDigitos(e.target.value, 4) })} inputMode="numeric" autoComplete="off" required />
            <Input id="gc-fipe" label="FIPE (R$)" value={v.fipe} onChange={(e) => setV({ ...v, fipe: maskMoney(e.target.value) })} inputMode="numeric" autoComplete="off" required />
            <Input id="gc-placa" label="Placa" value={v.placa} onChange={(e) => setV({ ...v, placa: maskPlate(e.target.value) })} autoComplete="off" required />
            <Input id="gc-renavam" label="RENAVAM" value={v.renavam} onChange={(e) => setV({ ...v, renavam: maskRenavam(e.target.value) })} inputMode="numeric" autoComplete="off" required />
          </div>
        </Bloco>

        {tipo === 'prestacao-de-servico' ? (
          <Bloco titulo="Financiamento e proposta">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="gc-banco" label="Banco financiado" value={p.banco} onChange={(e) => setP({ ...p, banco: e.target.value })} autoComplete="off" required />
              <Input id="gc-vparcela" label="Valor da parcela (R$)" value={p.valorParcela} onChange={(e) => setP({ ...p, valorParcela: maskMoney(e.target.value) })} inputMode="numeric" autoComplete="off" required />
              <Input id="gc-qtd" label="Qtd. de parcelas" value={p.qtdParcelas} onChange={(e) => setP({ ...p, qtdParcelas: soDigitos(e.target.value, 3) })} inputMode="numeric" autoComplete="off" required />
              <Input id="gc-pagas" label="Parcelas pagas" value={p.parcelasPagas} onChange={(e) => setP({ ...p, parcelasPagas: soDigitos(e.target.value, 3) })} inputMode="numeric" autoComplete="off" required />
              <Input id="gc-atraso" label="Parcelas em atraso" value={p.parcelasAtraso} onChange={(e) => setP({ ...p, parcelasAtraso: soDigitos(e.target.value, 3) })} inputMode="numeric" autoComplete="off" required />
              <Input id="gc-prazo" label="Prazo (meses)" value={p.prazo} onChange={(e) => setP({ ...p, prazo: soDigitos(e.target.value, 3) })} inputMode="numeric" autoComplete="off" required />
              <Input id="gc-proposta" label="Valor da proposta (R$)" value={p.valorProposta} onChange={(e) => setP({ ...p, valorProposta: maskMoney(e.target.value) })} inputMode="numeric" autoComplete="off" required />
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
        ) : (
          <Bloco titulo="Locação">
            <div className="grid gap-3 sm:grid-cols-3">
              <Input id="gc-lprazo" label="Prazo (meses)" value={l.prazo} onChange={(e) => setL({ ...l, prazo: soDigitos(e.target.value, 3) })} inputMode="numeric" autoComplete="off" required />
              <Input id="gc-semanal" label="Valor semanal (R$)" value={l.valorSemanal} onChange={(e) => setL({ ...l, valorSemanal: maskMoney(e.target.value) })} inputMode="numeric" autoComplete="off" required />
              <Input id="gc-caucao" label="Caução (R$)" value={l.caucao} onChange={(e) => setL({ ...l, caucao: maskMoney(e.target.value) })} inputMode="numeric" hint="0 se não houver" autoComplete="off" required />
            </div>
          </Bloco>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="liberty" loading={isPending} loadingLabel="Gerando...">
            Gerar PDF
          </Button>
        </div>
      </form>
    </Modal>
  )
}
