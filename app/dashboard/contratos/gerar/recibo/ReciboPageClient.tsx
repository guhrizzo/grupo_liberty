'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { IconArrowLeft, IconFileDownload, IconReceipt } from '@tabler/icons-react'
import { Button, Input, Select, useToast } from '@/app/components/ui'
import { maskCPFCNPJ, maskMoney, maskPhone, maskPlate, maskRenavam, onlyDigits } from '@/utils/masks'
import { listarClientesContratoAction } from '../actions'
import { baixarPdf } from '../baixar-pdf'
import { Bloco, Marcar } from '../campos'
import { useBuscaPlaca } from '../useBuscaPlaca'
import { numeroDe, type ClienteContrato, type VeiculoParaContrato } from '../types'
import { gerarReciboAction } from './actions'
import HistoricoRecibos from './HistoricoRecibos'
import { FORMAS_RECIBO, reciboVazio, validarRecibo, type ReciboInput } from './types'

const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ReciboPageClient({ veiculos }: { veiculos: VeiculoParaContrato[] }) {
  const toast = useToast()
  const [isPending, startTransition] = useTransition()
  const [r, setR] = useState<ReciboInput>(reciboVazio)
  const [clientes, setClientes] = useState<ClienteContrato[]>([])
  const [recarregarHistorico, setRecarregarHistorico] = useState(0)

  const { pagador: p, veiculo: v, recebedor: e, pagamento: g } = r
  const setP = (campo: keyof ReciboInput['pagador'], valor: string) => setR((a) => ({ ...a, pagador: { ...a.pagador, [campo]: valor } }))
  const setV = (campo: keyof ReciboInput['veiculo'], valor: string) => setR((a) => ({ ...a, veiculo: { ...a.veiculo, [campo]: valor } }))
  const setE = (campo: keyof ReciboInput['recebedor'], valor: string) => setR((a) => ({ ...a, recebedor: { ...a.recebedor, [campo]: valor } }))
  const setG = (campo: keyof ReciboInput['pagamento'], valor: string) => setR((a) => ({ ...a, pagamento: { ...a.pagamento, [campo]: valor } }))

  // Busca por placa (hook compartilhado com o contrato): ao completar a placa, preenche marca,
  // modelo, ano, cor, chassi e RENAVAM. Não roda com veículo do estoque escolhido.
  const { buscando: buscandoPlaca, marcarJaBuscada } = useBuscaPlaca(v.placa, !v.veiculoId, (d) => {
    setR((a) => ({
      ...a,
      veiculo: {
        ...a.veiculo,
        marca: d.marca || a.veiculo.marca,
        modelo: d.modelo || a.veiculo.modelo,
        ano: d.anoModelo ? onlyDigits(String(d.anoModelo)).slice(0, 4) : a.veiculo.ano,
        cor: d.cor || a.veiculo.cor,
        chassi: d.chassi ? String(d.chassi).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17) : a.veiculo.chassi,
        renavam: d.renavam ? maskRenavam(String(d.renavam)) : a.veiculo.renavam,
      },
    }))
  })

  // Data do pagamento padrão = hoje (fuso do navegador). Fica para depois da montagem
  // para não divergir na hidratação quando o servidor está em outro fuso.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const d = new Date()
      const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      setR((a) => (a.pagamento.data ? a : { ...a, pagamento: { ...a.pagamento, data: hoje } }))
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    let vivo = true
    listarClientesContratoAction().then((x) => vivo && setClientes(x))
    return () => {
      vivo = false
    }
  }, [])

  const pendencia = useMemo(() => validarRecibo(r), [r])
  const valor = numeroDe(g.valor) || 0
  const total = g.valorTotal.trim() ? numeroDe(g.valorTotal) : NaN
  const saldo = Number.isFinite(total) ? Math.max(0, total - valor) : null

  function escolherCliente(id: string) {
    const c = clientes.find((x) => x.id === id)?.contratante
    if (!c) return
    setR((a) => ({
      ...a,
      pagador: { nome: c.nome, documento: onlyDigits(c.cpf), endereco: c.endereco, telefone: maskPhone(c.telefone), email: c.email },
    }))
  }

  function escolherVeiculo(id: string) {
    const x = veiculos.find((q) => q.id === id)
    if (!x) {
      setR((a) => ({ ...a, veiculo: { ...a.veiculo, veiculoId: '' } }))
      return
    }
    // Já temos os dados do estoque: não consulta essa placa de novo se o veículo for desmarcado.
    marcarJaBuscada(x.placa)
    setR((a) => ({
      ...a,
      veiculo: { ...a.veiculo, veiculoId: x.id, marca: x.marca, modelo: x.modelo, ano: x.ano, placa: x.placa, renavam: x.renavam },
    }))
  }

  function gerar() {
    if (pendencia) {
      toast.error(pendencia, 'Faltam dados')
      return
    }
    startTransition(async () => {
      const res = await gerarReciboAction(r)
      if ('error' in res) {
        toast.error(res.error, 'Não foi possível gerar')
        return
      }
      baixarPdf(res.pdfBase64, res.fileName)
      setRecarregarHistorico((n) => n + 1)
      toast.success(res.guardadoNoVeiculo ? 'Recibo gerado e guardado no veículo.' : 'Recibo gerado.')
      res.avisos.forEach((a) => toast.error(a))
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-liberty/10 text-liberty">
            <IconReceipt size={22} stroke={2} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-neutral-950 md:text-3xl">Recibo de pagamento</h1>
            <p className="mt-0.5 text-xs text-neutral-500 md:text-sm">
              {pendencia ? (
                <>
                  Preencha os dados do pagamento recebido. <span className="font-semibold text-amber-700">Falta: {pendencia}</span>
                </>
              ) : (
                <span className="font-semibold text-emerald-700">Tudo preenchido. Gere o PDF.</span>
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

      <div className="mx-auto w-full max-w-3xl">
        <form
          onSubmit={(ev) => {
            ev.preventDefault()
            gerar()
          }}
          className="space-y-4"
        >
          <Bloco titulo="Pagador (cliente)">
            {clientes.length > 0 && (
              <Select
                id="rc-cliente-salvo"
                label="Cliente salvo (preenche os dados)"
                value=""
                onChange={(ev) => escolherCliente(ev.target.value)}
                options={[
                  { value: '', label: 'Selecione...' },
                  ...clientes.map((x) => ({ value: x.id, label: `${x.contratante.nome} — ${maskCPFCNPJ(x.contratante.cpf)}` })),
                ]}
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="rc-nome" label="Nome completo" placeholder="Nome completo" value={p.nome} onChange={(ev) => setP('nome', ev.target.value)} autoComplete="off" />
              <Input id="rc-doc" label="CPF ou CNPJ" placeholder="000.000.000-00" value={maskCPFCNPJ(p.documento)} onChange={(ev) => setP('documento', onlyDigits(ev.target.value).slice(0, 14))} inputMode="numeric" autoComplete="off" />
              <Input id="rc-tel" label="Telefone (opcional)" placeholder="(00) 00000-0000" value={p.telefone} onChange={(ev) => setP('telefone', maskPhone(ev.target.value))} inputMode="tel" autoComplete="off" />
              <Input id="rc-email" label="E-mail (opcional)" type="email" placeholder="cliente@email.com" value={p.email} onChange={(ev) => setP('email', ev.target.value)} autoComplete="off" />
            </div>
            <Input id="rc-endereco" label="Endereço (opcional)" placeholder="Rua, número, bairro, cidade/UF" value={p.endereco} onChange={(ev) => setP('endereco', ev.target.value)} autoComplete="off" />
          </Bloco>

          <Bloco titulo="Veículo">
            <Select
              id="rc-veiculo"
              label="Veículo do estoque (preenche os dados e guarda o recibo nele)"
              value={v.veiculoId}
              onChange={(ev) => escolherVeiculo(ev.target.value)}
              options={[{ value: '', label: 'Nenhum (digitar à mão)' }, ...veiculos.map((x) => ({ value: x.id, label: x.rotulo }))]}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="rc-marca" label="Marca" placeholder="Ex.: Volkswagen" value={v.marca} onChange={(ev) => setV('marca', ev.target.value)} autoComplete="off" />
              <Input id="rc-modelo" label="Modelo" placeholder="Ex.: Polo 1.0 MPI" value={v.modelo} onChange={(ev) => setV('modelo', ev.target.value)} autoComplete="off" />
              <Input id="rc-ano" label="Ano (opcional)" placeholder="AAAA" value={v.ano} onChange={(ev) => setV('ano', onlyDigits(ev.target.value).slice(0, 4))} inputMode="numeric" autoComplete="off" />
              <Input id="rc-cor" label="Cor (opcional)" placeholder="Ex.: Branca" value={v.cor} onChange={(ev) => setV('cor', ev.target.value)} autoComplete="off" />
              <Input id="rc-placa" label="Placa" placeholder="AAA0A00" value={v.placa} onChange={(ev) => setV('placa', maskPlate(ev.target.value))} hint={buscandoPlaca ? 'Buscando dados da placa…' : 'Ao completar a placa, preenche marca, modelo, ano, cor, chassi e RENAVAM.'} autoComplete="off" />
              <Input id="rc-chassi" label="Chassi (opcional)" placeholder="17 caracteres" value={v.chassi} onChange={(ev) => setV('chassi', ev.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17))} autoComplete="off" />
              <Input id="rc-renavam" label="RENAVAM (opcional)" placeholder="00000000000" value={v.renavam} onChange={(ev) => setV('renavam', maskRenavam(ev.target.value))} inputMode="numeric" autoComplete="off" />
            </div>
            {v.veiculoId && (
              <Marcar id="rc-guardar" checked={r.guardarNoVeiculo} onChange={(c) => setR((a) => ({ ...a, guardarNoVeiculo: c }))}>
                Guardar o recibo nos documentos do veículo
              </Marcar>
            )}
          </Bloco>

          <Bloco titulo="Pagamento recebido">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="rc-valor" label="Valor recebido (R$)" placeholder="R$ 0,00" value={g.valor} onChange={(ev) => setG('valor', maskMoney(ev.target.value))} inputMode="numeric" autoComplete="off" />
              <Input id="rc-data" label="Data do pagamento" type="date" value={g.data} onChange={(ev) => setG('data', ev.target.value)} />
              <Select id="rc-forma" label="Forma de pagamento" value={g.forma} onChange={(ev) => setG('forma', ev.target.value)} options={FORMAS_RECIBO.map((f) => ({ value: f.value, label: f.label }))} />
              <Input id="rc-total" label="Valor total do contrato (opcional)" placeholder="R$ 0,00" value={g.valorTotal} onChange={(ev) => setG('valorTotal', maskMoney(ev.target.value))} inputMode="numeric" autoComplete="off" hint="Preencha para mostrar o saldo restante e marcar pagamento parcial." />
            </div>
            <Input id="rc-ref" label="Referente a" placeholder="Ex.: sinal da compra do veículo" value={g.referencia} onChange={(ev) => setG('referencia', ev.target.value)} autoComplete="off" />
            {saldo !== null && valor > 0 && (
              <p className="text-xs text-neutral-500">
                Recebido {reais(valor)} de {reais(total)}: saldo restante {reais(saldo)}.
              </p>
            )}
          </Bloco>

          <Bloco titulo="Quem recebeu">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="rc-r-nome" label="Nome ou razão social" placeholder="Razão social" value={e.nome} onChange={(ev) => setE('nome', ev.target.value)} autoComplete="off" />
              <Input id="rc-r-cnpj" label="CNPJ" placeholder="00.000.000/0000-00" value={maskCPFCNPJ(e.cnpj)} onChange={(ev) => setE('cnpj', onlyDigits(ev.target.value).slice(0, 14))} inputMode="numeric" autoComplete="off" />
              <Input id="rc-r-resp" label="Responsável (assina o recibo)" placeholder="Nome completo" value={e.responsavel} onChange={(ev) => setE('responsavel', ev.target.value)} autoComplete="off" />
              <Input id="rc-r-cpf" label="CPF do responsável" placeholder="000.000.000-00" value={maskCPFCNPJ(e.responsavelCpf)} onChange={(ev) => setE('responsavelCpf', onlyDigits(ev.target.value).slice(0, 11))} inputMode="numeric" autoComplete="off" />
            </div>
            <Input id="rc-r-end" label="Endereço" placeholder="Rua, número, bairro, cidade/UF" value={e.endereco} onChange={(ev) => setE('endereco', ev.target.value)} autoComplete="off" />
          </Bloco>
        </form>

        <div className="mt-4">
          <HistoricoRecibos recarregar={recarregarHistorico} />
        </div>
      </div>
    </div>
  )
}
