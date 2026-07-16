'use client'

import { useState } from 'react'
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
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs transition-all hover:shadow-md">
      <h3 className="text-lg font-bold text-neutral-900 mb-2">
        Enviar Proposta
      </h3>
      <p className="text-xs text-neutral-500 mb-6">
        Tem interesse neste {veiculoModelo}? Envie uma proposta ou mensagem de interesse e nossa equipe retornará em breve.
      </p>

      {success && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-850">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-850">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="valorProposta" className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">
            Valor da Proposta (R$ - Opcional)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-sm text-neutral-400 font-medium">R$</span>
            <input
              id="valorProposta"
              type="text"
              placeholder="Ex: 115.000"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 pl-10 pr-3.5 py-2.5 text-sm font-medium focus:border-neutral-900 focus:bg-white focus:outline-hidden transition-all duration-200"
            />
          </div>
        </div>

        <div>
          <label htmlFor="mensagemProposta" className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">
            Mensagem / Observações *
          </label>
          <textarea
            id="mensagemProposta"
            required
            rows={4}
            placeholder="Olá! Tenho interesse no veículo. Gostaria de saber mais informações e agendar uma visita."
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-3.5 py-2.5 text-sm font-medium focus:border-neutral-900 focus:bg-white focus:outline-hidden transition-all duration-200 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-semibold py-3 text-sm transition-all duration-200 shadow-xs hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Enviando...
            </>
          ) : 'Enviar Mensagem de Interesse'}
        </button>
      </form>
    </div>
  )
}
