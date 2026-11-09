'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Select, Textarea, useToast } from '@/app/components/ui'
import { formatDate } from '@/utils/format'
import { DIAS_SEMANA, rotuloDia } from '@/utils/pendencias/semanais'
import type { UsuarioOpcao } from '../types'
import {
  alternarTarefaSemanalAtiva,
  concluirTarefaSemanal,
  excluirTarefaSemanal,
  salvarTarefaSemanal,
} from './actions'
import type { TarefaSemanal } from './types'

function Estado({ t, hoje }: { t: TarefaSemanal; hoje: string }) {
  if (!t.ativa) return <span className="font-bold text-neutral-500">Pausada</span>
  if (!t.ocorrencia) return <span className="text-neutral-500">Começa na próxima {DIAS_SEMANA[t.diaSemana]}</span>
  if (t.concluida) {
    return (
      <span className="font-bold text-emerald-700 adobe-dark:text-emerald-300">
        Feita{t.concluidaPorNome ? ` por ${t.concluidaPorNome}` : ''}
      </span>
    )
  }
  const atrasada = t.ocorrencia < hoje
  return (
    <span className={`font-bold ${atrasada ? 'text-rose-700 adobe-dark:text-rose-300' : 'text-amber-700 adobe-dark:text-amber-300'}`}>
      {atrasada ? `Atrasada (${formatDate(t.ocorrencia)})` : 'Para hoje'}
    </span>
  )
}

export default function SemanaisClient({
  tarefas,
  usuarios,
  admSupremo,
  meuUid,
  hoje,
}: {
  tarefas: TarefaSemanal[]
  usuarios: UsuarioOpcao[]
  admSupremo: boolean
  meuUid: string
  hoje: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [ocupado, setOcupado] = useState(false)
  const [dia, setDia] = useState('2')
  const [responsavel, setResponsavel] = useState('')

  const minhas = tarefas.filter((t) => t.responsavelUid === meuUid && t.ativa)

  async function executar(fn: () => Promise<{ success?: string; error?: string }>) {
    setOcupado(true)
    try {
      const r = await fn()
      if (r.error) toast.error(r.error)
      else if (r.success) toast.success(r.success)
      router.refresh()
    } finally {
      setOcupado(false)
    }
  }

  async function criar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const dados = new FormData(form)
    dados.set('diaSemana', dia)
    dados.set('responsavelUid', responsavel)
    setOcupado(true)
    try {
      const r = await salvarTarefaSemanal(dados)
      if (r.error) return toast.error(r.error)
      toast.success(r.success ?? 'Salvo.')
      form.reset()
      router.refresh()
    } finally {
      setOcupado(false)
    }
  }

  const botao =
    'rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-bold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer disabled:opacity-50'

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-neutral-950">Tarefas semanais</h1>
        <p className="text-sm text-neutral-500">
          Rotina que se repete toda semana, por funcionário. A tarefa do dia aparece no sininho até ser marcada como feita.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-neutral-900">Minha rotina</h2>
        {minhas.length === 0 ? (
          <p className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
            Você não tem tarefas semanais.
          </p>
        ) : (
          <ul className="space-y-2">
            {minhas.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-neutral-900">{t.titulo}</p>
                  <p className="text-[11px] text-neutral-500">
                    {rotuloDia(t.diaSemana)} · <Estado t={t} hoje={hoje} />
                  </p>
                  {t.descricao && <p className="mt-1 text-xs text-neutral-600">{t.descricao}</p>}
                </div>
                {t.ocorrencia && (
                  <button
                    type="button"
                    disabled={ocupado}
                    className={botao}
                    onClick={() => executar(() => concluirTarefaSemanal(t.id, !t.concluida))}
                  >
                    {t.concluida ? 'Desfazer' : 'Marcar como feita'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {admSupremo && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-neutral-900">Cadastrar tarefa semanal</h2>
          <form onSubmit={criar} className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input label="Tarefa" name="titulo" placeholder="Ex.: Verificar quitações" required />
            </div>
            <Select label="Dia da semana" value={dia} onChange={(e) => setDia(e.target.value)}>
              {DIAS_SEMANA.map((nome, i) => (
                <option key={nome} value={String(i)}>
                  {rotuloDia(i)}
                </option>
              ))}
            </Select>
            <Select
              label="Funcionário"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Escolha..."
            >
              {usuarios.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.nome}
                </option>
              ))}
            </Select>
            <div className="sm:col-span-2">
              <Textarea label="Detalhes (opcional)" name="descricao" rows={2} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={ocupado || !responsavel}>
                Cadastrar
              </Button>
            </div>
          </form>

          <h2 className="pt-2 text-sm font-bold text-neutral-900">
            Todas as tarefas <span className="font-normal text-neutral-500">({tarefas.length})</span>
          </h2>
          {tarefas.length === 0 ? (
            <p className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
              Nenhuma tarefa semanal cadastrada.
            </p>
          ) : (
            <ul className="space-y-2">
              {tarefas.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-neutral-900">{t.titulo}</p>
                    <p className="text-[11px] text-neutral-500">
                      {rotuloDia(t.diaSemana)} · {t.responsavelNome} · <Estado t={t} hoje={hoje} />
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={ocupado}
                      className={botao}
                      onClick={() => executar(() => alternarTarefaSemanalAtiva(t.id, !t.ativa))}
                    >
                      {t.ativa ? 'Pausar' : 'Reativar'}
                    </button>
                    <button
                      type="button"
                      disabled={ocupado}
                      className={`${botao} text-rose-600`}
                      onClick={() => {
                        if (window.confirm('Excluir esta tarefa semanal?')) {
                          void executar(() => excluirTarefaSemanal(t.id))
                        }
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
