'use client'

import { useState, useTransition } from 'react'
import { IconDeviceDesktop, IconCircleCheck } from '@tabler/icons-react'
import { Button, useToast } from '@/app/components/ui'
import { logout } from '@/app/login/actions'
import { criarCodigoDispositivo } from './actions'

interface Props {
  porta: number
  state: string
  email: string
}

export default function ConsentimentoDispositivo({ porta, state, email }: Props) {
  const toast = useToast()
  const [autorizando, startAutorizar] = useTransition()
  const [trocando, startTrocar] = useTransition()
  const [redirecionado, setRedirecionado] = useState(false)

  function autorizar() {
    startAutorizar(async () => {
      const res = await criarCodigoDispositivo()
      if (res.error || !res.code) {
        toast.error(res.error ?? 'Não foi possível autorizar.', 'Falha')
        return
      }
      const url = `http://127.0.0.1:${Number(porta)}/callback?code=${encodeURIComponent(
        res.code,
      )}&state=${encodeURIComponent(state)}`
      setRedirecionado(true)
      window.location.href = url
    })
  }

  function trocarConta() {
    startTrocar(async () => {
      try {
        await logout()
      } catch {
        /* logout redireciona via exceção do Next — ignora */
      }
      window.location.reload()
    })
  }

  if (redirecionado) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <IconCircleCheck size={26} />
        </div>
        <h1 className="text-lg font-bold text-neutral-900">Tudo certo!</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Pode fechar esta aba e voltar para o app Liberty Car.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-liberty/10 text-liberty">
        <IconDeviceDesktop size={22} />
      </div>
      <h1 className="text-xl font-black tracking-tight text-neutral-900">
        Entrar no app de desktop?
      </h1>
      <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
        Você está prestes a autorizar o app Liberty Car neste computador como{' '}
        <strong className="text-neutral-900">{email}</strong>.
      </p>

      <div className="mt-6 space-y-2">
        <Button
          variant="liberty"
          fullWidth
          loading={autorizando}
          loadingLabel="Autorizando…"
          onClick={autorizar}
        >
          Autorizar
        </Button>
        <Button
          variant="secondary"
          fullWidth
          loading={trocando}
          disabled={autorizando}
          onClick={trocarConta}
        >
          Não sou eu / trocar de conta
        </Button>
      </div>
    </div>
  )
}
