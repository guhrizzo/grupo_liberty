'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { IconBellRinging, IconCheck, IconEye, IconSend, IconTrash } from '@tabler/icons-react'
import { Breadcrumb, Button, ConfirmDialog, EmptyState, Select, Textarea, useToast } from '@/app/components/ui'
import { formatDateTime } from '@/utils/format'
import {
  TAREFA_PRIORIDADE,
  TAREFA_PRIORIDADE_ORDEM,
  type TarefaPrioridade,
} from '@/constants/tarefas'
import { enviarLembrete, excluirLembrete, marcarLembreteVisto } from './actions'
import { LEMBRETE_TEXTO_MAX, type Lembrete } from './types'

const CARD =
  'rounded-2xl border border-neutral-200 bg-white shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2'

export default function LembretesClient({
  lembretes,
  ceo,
}: {
  lembretes: Lembrete[]
  ceo: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [isPending, startTransition] = useTransition()
  const [texto, setTexto] = useState('')
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>('normal')
  const [excluirId, setExcluirId] = useState<string | null>(null)

  function executar(acao: () => Promise<{ success?: string; error?: string }>, onOk?: () => void) {
    startTransition(async () => {
      const result = await acao()
      if (result.error) toast.error(result.error)
      else {
        toast.success(result.success || 'Feito.')
        onOk?.()
        router.refresh()
      }
    })
  }

  const novos = lembretes.filter((l) => !l.vistoEm).length

  return (
    <div className="space-y-5 pb-28 md:space-y-6 md:pb-0">
      <header className="min-w-0">
        <div className="hidden md:block">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Demandas', href: '/dashboard/demandas' },
              { label: 'Lembretes ao CEO' },
            ]}
          />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-950 md:mt-1 md:text-3xl adobe-dark:text-adobe-text-hi">
          Lembretes ao CEO
        </h1>
        <p className="mt-0.5 text-xs text-neutral-500 md:mt-1 md:text-sm adobe-dark:text-adobe-text-lo">
          {ceo
            ? `Lembretes enviados pela equipe${novos > 0 ? ` — ${novos} ainda não ${novos === 1 ? 'visto' : 'vistos'}` : ''}.`
            : 'Envie um lembrete direto ao CEO. Só ele lê; você acompanha aqui se já foi visto.'}
        </p>
      </header>

      {!ceo && (
        <form
          className={CARD + ' space-y-3 p-4'}
          onSubmit={(e) => {
            e.preventDefault()
            executar(
              () => enviarLembrete(texto, prioridade),
              () => {
                setTexto('')
                setPrioridade('normal')
              },
            )
          }}
        >
          <Textarea
            label="Novo lembrete"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={LEMBRETE_TEXTO_MAX}
            rows={3}
            placeholder="Ex.: confirmar a reunião com o fornecedor na sexta"
          />
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-full sm:w-56">
              <Select
                aria-label="Prioridade"
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as TarefaPrioridade)}
                options={TAREFA_PRIORIDADE_ORDEM.map((p) => ({ value: p, label: TAREFA_PRIORIDADE[p].label }))}
              />
            </div>
            <Button
              type="submit"
              variant="liberty"
              leftIcon={<IconSend size={16} stroke={2.5} />}
              loading={isPending}
              disabled={!texto.trim()}
            >
              Enviar ao CEO
            </Button>
          </div>
        </form>
      )}

      {lembretes.length === 0 ? (
        <EmptyState
          icon={<IconBellRinging size={28} />}
          title={ceo ? 'Nenhum lembrete recebido' : 'Você ainda não enviou lembretes'}
        />
      ) : (
        <ul className="space-y-3">
          {lembretes.map((l) => (
            <li key={l.id} className={CARD + ' p-4'}>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    'inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ' +
                    TAREFA_PRIORIDADE[l.prioridade].classes
                  }
                >
                  {TAREFA_PRIORIDADE[l.prioridade].label}
                </span>
                <span
                  className={
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ' +
                    (l.vistoEm
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 adobe-dark:border-emerald-500/30 adobe-dark:bg-emerald-500/10 adobe-dark:text-emerald-300'
                      : 'border-amber-200 bg-amber-50 text-amber-700 adobe-dark:border-amber-500/30 adobe-dark:bg-amber-500/10 adobe-dark:text-amber-300')
                  }
                >
                  {l.vistoEm ? <IconCheck size={11} stroke={3} /> : null}
                  {l.vistoEm ? 'Visto' : 'Novo'}
                </span>
                <span className="text-[11px] text-neutral-500 adobe-dark:text-adobe-text-lo">
                  {ceo ? `${l.autorNome} · ` : ''}
                  {formatDateTime(l.criadoEm)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-900 adobe-dark:text-adobe-text-hi">
                {l.texto}
              </p>
              {(ceo || !l.vistoEm) && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {ceo && (
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<IconEye size={14} />}
                      disabled={isPending}
                      onClick={() => executar(() => marcarLembreteVisto(l.id, !l.vistoEm))}
                    >
                      {l.vistoEm ? 'Marcar como não visto' : 'Marcar como visto'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<IconTrash size={14} />}
                    disabled={isPending}
                    onClick={() => setExcluirId(l.id)}
                  >
                    Excluir
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={excluirId !== null}
        onClose={() => setExcluirId(null)}
        onConfirm={() => {
          if (excluirId) executar(() => excluirLembrete(excluirId), () => setExcluirId(null))
        }}
        title="Excluir este lembrete?"
        description="Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        tone="danger"
      />
    </div>
  )
}
