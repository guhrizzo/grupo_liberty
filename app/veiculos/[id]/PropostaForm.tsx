'use client'

import { useState } from 'react'
import {
  IconSend,
  IconMessage2,
  IconCash,
  IconUser,
  IconPhone,
  IconMail,
} from '@tabler/icons-react'
import { enviarPropostaAction } from './actions'
import { Button, Input, Textarea, useToast } from '../../components/ui'
import { maskMoney, parseMoney, maskPhone, maskCPFCNPJ } from '@/utils/masks'
import { validarCPF } from '@/utils/validadorCpf'

interface PropostaFormProps {
  veiculoId: string
  veiculoModelo: string
  userEmail?: string
}

export default function PropostaForm({
  veiculoId,
  veiculoModelo,
  userEmail = '',
}: PropostaFormProps) {
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState(userEmail)
  const [valor, setValor] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nome.trim() || nome.trim().length < 2) {
      toast.error('Informe seu nome completo.')
      return
    }

    if (!cpf.trim() || !validarCPF(cpf)) {
      toast.error('Informe um CPF válido para elaboração do contrato.')
      return
    }

    if (!telefone.trim() || telefone.trim().length < 8) {
      toast.error('Informe seu telefone / WhatsApp.')
      return
    }

    if (!email.trim() || !email.includes('@')) {
      toast.error('Informe um e-mail válido para receber nossa resposta.')
      return
    }

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
    formData.append('nome', nome.trim())
    formData.append('cpf', cpf.replace(/\D/g, ''))
    formData.append('telefone', telefone.trim())
    formData.append('email', email.trim())
    formData.append('valor', String(valorNumerico))
    formData.append('mensagem', mensagem.trim())

    try {
      const res = await enviarPropostaAction(formData)
      if (res.error) {
        toast.error(res.error, 'Não foi possível enviar')
      } else if (res.success) {
        toast.success(res.success, 'Proposta enviada!')
        setNome('')
        setCpf('')
        setTelefone('')
        if (!userEmail) setEmail('')
        setValor('')
        setMensagem('')
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Ocorreu um erro ao enviar sua proposta.'
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
        <h3 className="text-lg font-bold text-neutral-900 mb-1">Faça sua Proposta</h3>
        <p className="text-xs text-neutral-600 mb-5 leading-relaxed">
          Preencha seus dados abaixo para enviar sua proposta ou dúvida sobre este{' '}
          <span className="text-neutral-900 font-semibold">{veiculoModelo}</span>. Nossa equipe responderá em breve!
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="nomeCliente"
            label="Seu Nome Completo"
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: João da Silva"
            leftIcon={<IconUser size={14} />}
          />

          <Input
            id="cpfCliente"
            label="Seu CPF"
            type="text"
            required
            value={cpf}
            onChange={(e) => setCpf(maskCPFCNPJ(e.target.value))}
            placeholder="000.000.000-00"
            leftIcon={
              <span className="text-[10px] font-bold text-neutral-400">CPF</span>
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="telefoneCliente"
              label="Telefone / WhatsApp"
              type="tel"
              required
              value={telefone}
              onChange={(e) => setTelefone(maskPhone(e.target.value))}
              placeholder="(14) 99999-9999"
              leftIcon={<IconPhone size={14} />}
            />

            <Input
              id="emailCliente"
              label="E-mail de Contato"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao@email.com"
              leftIcon={<IconMail size={14} />}
            />
          </div>

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
            rows={3}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Olá! Tenho interesse neste veículo. Gostaria de receber mais informações e simular o financiamento."
          />

          <Button
            type="submit"
            variant="liberty"
            loading={loading}
            loadingLabel="Enviando proposta..."
            leftIcon={<IconSend size={14} stroke={2.5} />}
            fullWidth
          >
            Enviar Proposta
          </Button>
        </form>
      </div>
    </div>
  )
}
