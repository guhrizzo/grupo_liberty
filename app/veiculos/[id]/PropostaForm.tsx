'use client'

import { useState } from 'react'
import { IconLoader2, IconSend, IconMessage2 } from '@tabler/icons-react'
import { enviarPropostaAction } from './actions'

interface PropostaFormProps {
  veiculoId: string
  veiculoModelo: string
}

export default function PropostaForm({ veiculoId, veiculoModelo }: PropostaFormProps) {
  const [valor, setValor] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const formData = new FormData()
    formData.append('veiculo_id', veiculoId)
    formData.append('valor', valor)
    formData.append('mensagem', mensagem)

    try {
      const res = await enviarPropostaAction(formData)
      if (res.error) {
        setError(res.error)
      } else if (res.success) {
        setSuccess(res.success)
        setValor('')
        setMensagem('')
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao enviar sua proposta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line)] glass-strong p-6">
      <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-[var(--color-neon)] opacity-10 blur-3xl" />
      <div className="relative">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg neon-glow bg-[var(--color-bg-3)] mb-4">
          <IconMessage2 size={20} className="text-[var(--color-neon-soft)]" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">Enviar Proposta</h3>
        <p className="text-xs text-[var(--color-text-md)] mb-5">
          Tem interesse neste <span className="text-white font-semibold">{veiculoModelo}</span>? Envie sua proposta e nossa equipe retorna em breve.
        </p>

        {success && (
          <div className="mb-4 rounded-lg bg-[var(--color-success)]/10 border border-[var(--color-success)]/40 p-3.5 text-xs font-semibold text-[var(--color-success)]">
            {success}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/40 p-3.5 text-xs font-semibold text-[var(--color-danger)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="valorProposta" className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--color-text-lo)] mb-1.5">
              Valor da Proposta (R$) — Opcional
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-lo)] font-medium">R$</span>
              <input
                id="valorProposta"
                type="text"
                placeholder="Ex: 115.000"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-2)] pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-[var(--color-text-mute)] focus:border-[var(--color-neon)] transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="mensagemProposta" className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--color-text-lo)] mb-1.5">
              Mensagem *
            </label>
            <textarea
              id="mensagemProposta"
              required
              rows={4}
              placeholder="Olá! Tenho interesse no veículo. Gostaria de saber mais informações e agendar uma visita."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-2)] px-3.5 py-2.5 text-sm text-white placeholder:text-[var(--color-text-mute)] focus:border-[var(--color-neon)] transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--color-neon)] hover:bg-[var(--color-neon-soft)] text-[#001018] font-extrabold py-3 text-sm transition-all shadow-[0_0_18px_-4px_rgba(0,212,255,0.7)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <IconLoader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <IconSend size={16} stroke={2.5} />
                Enviar Mensagem
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
