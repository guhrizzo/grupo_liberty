'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { Button, Input, Select, Textarea, useToast } from '@/app/components/ui'
import { formatDate } from '@/utils/format'
import { formatarDocumento } from '@/utils/portal/documento'
import { formatarCentavosInvestimento, hojeInvestimento, SITUACOES_OPCAO, type OpcaoInvestimento } from '@/utils/investimentos/modelo'
import type { carregarInvestimentosInternos } from '@/utils/investimentos/repositorio'
import { cadastrarPosicaoInvestimento, localizarTitularInvestimento, salvarOpcaoInvestimento } from './actions'

type Dados = Awaited<ReturnType<typeof carregarInvestimentosInternos>>
const card = 'rounded-xl border border-neutral-200 bg-white p-5'

export default function PainelInvestimentosInterno({ opcoes, posicoes }: Dados) {
  const [busca, setBusca] = useState('')
  const filtro = busca.trim().toLocaleLowerCase('pt-BR')
  const resultados = posicoes.filter((posicao) =>
    `${posicao.nomeCliente} ${posicao.opcaoNome} ${posicao.referencia}`.toLocaleLowerCase('pt-BR').includes(filtro))
  return (
    <div className="space-y-7">
      <section className="space-y-3" aria-labelledby="posicoes-investimento">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="posicoes-investimento" className="text-xl font-semibold">Posições dos clientes</h2>
          <span className="text-sm text-neutral-600">{posicoes.filter(({ situacao }) => situacao === 'ativa').length} ativas</span>
        </div>
        <div className="max-w-sm">
          <Input label="Buscar posição" type="search" placeholder="Ex.: nome do cliente ou referência" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {resultados.length > 0 ? (
          <ul className="space-y-2">
            {resultados.map((posicao) => (
              <li key={posicao.id}>
                <Link href={`/dashboard/investimentos/${posicao.id}`} className={`${card} flex flex-wrap items-center justify-between gap-2 hover:border-liberty focus-visible:outline-2 focus-visible:outline-liberty`}>
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold text-neutral-900">{posicao.nomeCliente} · {posicao.opcaoNome}</h3>
                    <p className="text-sm text-neutral-600">{posicao.referencia} · {posicao.situacao === 'ativa' ? 'Ativa' : 'Encerrada'}</p>
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold">{formatarCentavosInvestimento(posicao.totais.saldo)}</p>
                    <p className="text-neutral-600">Base {formatDate(posicao.dataBase)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className={card}>{filtro ? 'Nenhuma posição corresponde à busca.' : 'Nenhuma posição cadastrada.'}</p>}
        <NovaPosicao opcoes={opcoes} />
      </section>
      <section className="space-y-3" aria-labelledby="catalogo-investimentos">
        <h2 id="catalogo-investimentos" className="text-xl font-semibold">Catálogo de investimentos</h2>
        <details className={card}>
          <summary className="cursor-pointer font-semibold">Cadastrar opção</summary>
          <FormOpcao />
        </details>
        {opcoes.map((opcao) => (
          <details key={opcao.id} className={card}>
            <summary className="cursor-pointer font-semibold">
              {opcao.nome} <span className="ml-2 text-sm font-normal text-neutral-600">· {SITUACOES_OPCAO.find(({ value }) => value === opcao.situacao)?.label}</span>
            </summary>
            <FormOpcao key={opcao.atualizadaEm} opcao={opcao} />
          </details>
        ))}
      </section>
    </div>
  )
}

function FormOpcao({ opcao }: { opcao?: OpcaoInvestimento & { id: string } }) {
  const [situacao, setSituacao] = useState(opcao?.situacao ?? 'rascunho')
  const registro = useRef('')
  const [pendente, iniciar] = useTransition()
  const toast = useToast()
  const publica = situacao === 'publicada'

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const form = evento.currentTarget
    const dados = new FormData(form)
    dados.set('situacao', situacao)
    if (!opcao) {
      registro.current ||= crypto.randomUUID()
      dados.set('registroId', registro.current)
    }
    iniciar(async () => {
      try {
        const resultado = await salvarOpcaoInvestimento(dados)
        if (resultado.erro) toast.error(resultado.erro)
        else {
          toast.success('Opção salva.')
          if (!opcao) {
            registro.current = ''
            form.reset()
            setSituacao('rascunho')
          }
        }
      } catch {
        toast.error('Não foi possível salvar. Tente novamente.')
      }
    })
  }

  return (
    <form method="post" onSubmit={salvar} className="mt-4 space-y-3">
      {opcao && <><input name="id" type="hidden" value={opcao.id} /><input name="versao" type="hidden" value={opcao.atualizadaEm} /></>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="nome" label="Nome da opção" placeholder="Ex.: Nome comercial da opção" required minLength={2} maxLength={100} defaultValue={opcao?.nome} />
        <Input name="categoria" label="Categoria" placeholder="Ex.: Categoria informada no contrato" required maxLength={80} defaultValue={opcao?.categoria} />
        <Input name="prazo" label="Prazo" placeholder="Ex.: Prazo definido na documentação" required={publica} maxLength={120} defaultValue={opcao?.prazo} />
        <Input name="liquidez" label="Liquidez" placeholder="Ex.: Regras e prazo para solicitar resgate" required={publica} maxLength={180} defaultValue={opcao?.liquidez} />
      </div>
      <Textarea name="descricao" label="Descrição" placeholder="Descreva como a opção funciona" required={publica} maxLength={3000} defaultValue={opcao?.descricao} />
      <Textarea name="riscos" label="Riscos" placeholder="Descreva os riscos e as limitações da opção" required={publica} maxLength={3000} defaultValue={opcao?.riscos} />
      <Textarea name="condicoes" label="Condições" placeholder="Informe as regras e os custos aplicáveis" required={publica} maxLength={3000} defaultValue={opcao?.condicoes} />
      <div className="max-w-xs">
        <Select label="Visibilidade" value={situacao} options={SITUACOES_OPCAO} onChange={(e) => setSituacao(e.target.value as typeof situacao)} />
      </div>
      <Button type="submit" size="sm" loading={pendente}>Salvar opção</Button>
    </form>
  )
}

function NovaPosicao({ opcoes }: { opcoes: Dados['opcoes'] }) {
  const publicadas = opcoes.filter(({ situacao }) => situacao === 'publicada')
  const [opcaoId, setOpcaoId] = useState('')
  const [documento, setDocumento] = useState('')
  const [titular, setTitular] = useState<{ documento: string; nome: string }>()
  const [pendente, iniciar] = useTransition()
  const registro = useRef('')
  const toast = useToast()

  function buscar() {
    setTitular(undefined)
    iniciar(async () => {
      try {
        const resposta = await localizarTitularInvestimento(documento)
        if (resposta.erro) toast.error(resposta.erro)
        else setTitular(resposta.titular)
      } catch {
        toast.error('Não foi possível localizar o cliente.')
      }
    })
  }

  function abrir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!titular) return
    const form = evento.currentTarget
    const dados = new FormData(form)
    registro.current ||= crypto.randomUUID()
    dados.set('registroId', registro.current)
    dados.set('documento', titular.documento)
    dados.set('opcaoId', opcaoId)

    iniciar(async () => {
      try {
        const resposta = await cadastrarPosicaoInvestimento(dados)
        if (resposta.erro) toast.error(resposta.erro)
        else {
          toast.success('Posição cadastrada.')
          registro.current = ''
          form.reset()
          setDocumento('')
          setOpcaoId('')
          setTitular(undefined)
        }
      } catch {
        toast.error('Não foi possível confirmar. Confira a posição antes de tentar novamente.')
      }
    })
  }

  return (
    <details className={card}>
      <summary className="cursor-pointer font-semibold">Vincular nova posição a um cliente</summary>
      {publicadas.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">Publique uma opção no catálogo para vincular a posição.</p>
      ) : (
        <form method="post" onSubmit={abrir} className="mt-4 space-y-3">
          <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto]">
            <Input label="CPF ou CNPJ do cliente" placeholder="Ex.: 000.000.000-00" value={documento} maxLength={30} disabled={pendente}
              onChange={(e) => { setDocumento(e.target.value); setTitular(undefined) }} autoComplete="off" />
            <Button type="button" variant="secondary" onClick={buscar} disabled={pendente || !documento.trim()}>Localizar cliente</Button>
          </div>
          {titular && <p role="status" className="text-sm">Titular confirmado: <strong>{titular.nome}</strong> · {formatarDocumento(titular.documento)}</p>}
          <Select label="Opção de investimento" value={opcaoId} onChange={(e) => setOpcaoId(e.target.value)}
            options={[{ value: '', label: 'Selecione uma opção' }, ...publicadas.map(({ id, nome }) => ({ value: id, label: nome }))]} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input name="referencia" label="Referência da posição" required maxLength={100} placeholder="Ex.: INV-2026-001" />
            <Input name="data" label="Data de abertura" type="date" required max={hojeInvestimento()} defaultValue={hojeInvestimento()} />
            <Input name="valor" label="Aporte inicial (R$)" required inputMode="decimal" placeholder="Ex.: 10.000,00" />
          </div>
          <Button type="submit" size="sm" disabled={!titular || !opcaoId} loading={pendente}>Registrar posição</Button>
        </form>
      )}
    </details>
  )
}
