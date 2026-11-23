'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import { Button, Input, Select, Textarea, useToast } from '@/app/components/ui'
import { hojeInvestimento, TIPOS_MOVIMENTO, type SituacaoPosicao } from '@/utils/investimentos/modelo'
import { atualizarSituacaoInvestimento, corrigirMovimentoInvestimento, salvarMovimentoInvestimento } from '../actions'

const card = 'rounded-xl border border-neutral-200 bg-white p-5'

export function FormMovimento({ id, dataBase, situacao, saldo }: {
  id: string; dataBase: string; situacao: SituacaoPosicao; saldo: number
}) {
  const [tipo, setTipo] = useState('')
  const [pendente, iniciar] = useTransition()
  const registro = useRef('')
  const toast = useToast()
  const ativa = situacao === 'ativa'

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const form = evento.currentTarget
    const dados = new FormData(form)
    registro.current ||= crypto.randomUUID()
    dados.set('movimentoId', registro.current)
    dados.set('tipo', tipo)
    iniciar(async () => {
      try {
        const resposta = await salvarMovimentoInvestimento(id, dados)
        if (resposta.erro) toast.error(resposta.erro)
        else {
          toast.success('Movimentação registrada.')
          form.reset()
          registro.current = ''
          setTipo('')
        }
      } catch {
        toast.error('Não foi possível confirmar. Confira o extrato antes de tentar novamente.')
      }
    })
  }

  function alterarSituacao() {
    if (!window.confirm(ativa ? 'Encerrar esta posição?' : 'Reabrir esta posição para novos registros?')) return
    iniciar(async () => {
      try {
        const resposta = await atualizarSituacaoInvestimento(id, ativa ? 'encerrada' : 'ativa')
        if (resposta.erro) toast.error(resposta.erro)
        else toast.success(ativa ? 'Posição encerrada.' : 'Posição reaberta.')
      } catch {
        toast.error('Não foi possível alterar a situação.')
      }
    })
  }

  return (
    <section className={card} aria-labelledby="gerenciar-posicao">
      <h2 id="gerenciar-posicao" className="font-semibold text-neutral-900">Gerenciar posição</h2>
      {ativa && (
        <form method="post" onSubmit={salvar} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label="Tipo de movimentação" options={[{ value: '', label: 'Selecione o tipo' }, ...TIPOS_MOVIMENTO]}
              value={tipo} onChange={(e) => setTipo(e.target.value)} />
            <Input name="valor" label="Valor registrado (R$)" required inputMode="decimal"
              placeholder={tipo === 'resultado' || tipo === 'ajuste' ? 'Ex.: -20,00 ou 100,00' : 'Ex.: 500,00'} />
            <Input name="data" label="Data" type="date" required min={dataBase} max={hojeInvestimento()} defaultValue={hojeInvestimento()} />
          </div>
          <Textarea name="descricao" label="Descrição visível ao cliente" maxLength={500} required={tipo === 'ajuste'} placeholder="Ex.: Resultado registrado no período" />
          <Button type="submit" size="sm" loading={pendente} disabled={!tipo}>Registrar movimentação</Button>
        </form>
      )}
      <div className="mt-4 border-t border-neutral-200 pt-3">
        <Button type="button" size="sm" variant="secondary" disabled={pendente || (ativa && saldo !== 0)} onClick={alterarSituacao}>
          {ativa ? 'Encerrar posição' : 'Reabrir posição'}
        </Button>
        {ativa && saldo !== 0 && <p className="mt-2 text-sm text-neutral-600">O saldo registrado precisa estar zerado para encerrar a posição.</p>}
      </div>
    </section>
  )
}

export function FormEstorno({ id, movimentoId }: { id: string; movimentoId: string }) {
  const [pendente, iniciar] = useTransition()
  const toast = useToast()

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!window.confirm('Estornar este lançamento no extrato? A movimentação original ficará no histórico.')) return
    const dados = new FormData(evento.currentTarget)
    iniciar(async () => {
      try {
        const resposta = await corrigirMovimentoInvestimento(id, movimentoId, dados)
        if (resposta.erro) toast.error(resposta.erro)
        else toast.success('Estorno registrado no extrato.')
      } catch {
        toast.error('Não foi possível registrar o estorno.')
      }
    })
  }

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-semibold text-neutral-600">Estornar lançamento</summary>
      <form method="post" onSubmit={salvar} className="mt-2 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input name="motivo" label="Motivo do estorno" placeholder="Ex.: Valor lançado incorretamente" required maxLength={500} />
        </div>
        <Button type="submit" variant="secondary" size="sm" loading={pendente}>Confirmar estorno</Button>
      </form>
    </details>
  )
}
