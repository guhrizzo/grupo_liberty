'use client'

import { useState } from 'react'
import { IconSend, IconMessage2, IconCash } from '@tabler/icons-react'
import { enviarPropostaAction } from './actions'
import { Button, Input, Textarea, useToast } from '../../components/ui'
import { maskMoney, parseMoney } from '@/utils/masks'

interface PropostaFormProps {
  veiculoId: string
  veiculoModelo: string
}

export default function PropostaForm({ veiculoId, veiculoModelo }: PropostaFormProps) {
  const [valor, setValor] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const valorNumerico = parseMoney(valor)
    if (valor && valorNumerico <= 0) {
      toast.error('Informe um valor de proposta válido.')
      return
    }
    if (!mensagem.trim()) {
      toast.error('Escreva uma mensagem para a equipe.')
      return
    }

    setLoading(true)

    const formData = new FormData()
    formData.append('veiculo_id', veiculoId)
    formData.append('valor', String(valorNumerico))
    formData.append('mensagem', mensagem)

    try {
      const res = await enviarPropostaAction(formData)
      if (res.error) {
        toast.error(res.error, 'Não foi possível enviar')
      } else if (res.success) {
        toast.success(res.success, 'Proposta enviada')
        setValor('')
        setMensagem('')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ocorreu um erro ao enviar sua proposta.'
      toast.error(message, 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="relative">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-liberty/10 liberty-glow mb-4">
          <IconMessage2 size={20} className="text-liberty" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900 mb-1">Enviar Proposta</h3>
        <p className="text-xs text-neutral-600 mb-5">
          Tem interesse neste <span className="text-neutral-900 font-semibold">{veiculoModelo}</span>? Envie sua proposta e nossa equipe retorna em breve.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="valorProposta"
            label="Valor da Proposta (R$) — Opcional"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={valor}
            onChange={(e) => setValor(maskMoney(e.target.value))}
            placeholder="Ex: R$ 115.000,00"
            leftIcon={<IconCash size={14} />}
          />

          <Textarea
            id="mensagemProposta"
            label="Mensagem *"
            required
            rows={4}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Olá! Tenho interesse no veículo. Gostaria de saber mais informações e agendar uma visita."
          />

          <Button
            type="submit"
            variant="liberty"
            loading={loading}
            loadingLabel="Enviando..."
            leftIcon={<IconSend size={14} stroke={2.5} />}
            fullWidth
          >
            Enviar Mensagem
          </Button>
        </form>
      </div>
    </div>
  )
}
