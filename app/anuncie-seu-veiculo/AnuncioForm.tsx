'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  IconUser,
  IconMail,
  IconPhone,
  IconCar,
  IconCash,
  IconGauge,
  IconSend,
  IconCircleCheck,
  IconSpeakerphone,
} from '@tabler/icons-react'
import { Button, Input, Select, Textarea, useToast } from '../components/ui'
import { onlyDigits, parseMoney } from '@/utils/masks'
import { validarCPF } from '@/utils/validadorCpf'
import { CAMBIO_OPCOES, COMBUSTIVEL_OPCOES } from '@/utils/veiculos/opcoes'
import PhotoUploadField, { type LocalFoto } from './PhotoUploadField'

const ANO_MAX = new Date().getFullYear() + 1
const PLACA_RE = /^[A-Z]{3}-?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/

const CAMBIO_SELECT = [{ value: '', label: 'Selecione…' }, ...CAMBIO_OPCOES]
const COMBUSTIVEL_SELECT = [{ value: '', label: 'Selecione…' }, ...COMBUSTIVEL_OPCOES]

export default function AnuncioForm() {
  const toast = useToast()

  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')

  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [ano, setAno] = useState('')
  const [cor, setCor] = useState('')
  const [cambio, setCambio] = useState('')
  const [combustivel, setCombustivel] = useState('')
  const [quilometragem, setQuilometragem] = useState('')
  const [precoDesejado, setPrecoDesejado] = useState('')
  const [placa, setPlaca] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const [fotos, setFotos] = useState<LocalFoto[]>([])
  const [website, setWebsite] = useState('') // honeypot
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  // Trava síncrona: `loading` só vira true no próximo render, então um segundo
  // submit (Enter, duplo-clique rápido) que chegue antes disso ainda passaria.
  const enviandoRef = useRef(false)

  function validar(): string | null {
    if (nome.trim().length < 2) return 'Informe seu nome completo.'
    if (!validarCPF(cpf)) return 'Informe um CPF válido.'
    if (!email.includes('@') || email.trim().length < 5) return 'Informe um e-mail válido.'
    if (onlyDigits(telefone).length < 10) return 'Informe um telefone/WhatsApp válido com DDD.'
    if (!marca.trim()) return 'Informe a marca do veículo.'
    if (!modelo.trim()) return 'Informe o modelo do veículo.'
    const anoNum = Number(onlyDigits(ano))
    if (!anoNum || anoNum < 1900 || anoNum > ANO_MAX) {
      return `Informe um ano entre 1900 e ${ANO_MAX}.`
    }
    if (!cor.trim()) return 'Informe a cor do veículo.'
    if (!cambio) return 'Selecione o câmbio.'
    if (!combustivel) return 'Selecione o combustível.'
    if (onlyDigits(quilometragem) === '') return 'Informe a quilometragem.'
    if (parseMoney(precoDesejado) <= 0) return 'Informe o preço desejado.'
    if (!observacoes.trim()) return 'Escreva algumas informações sobre o veículo.'
    if (placa.trim() && !PLACA_RE.test(placa.trim().toUpperCase())) {
      return 'Placa inválida. Use ABC-1234 ou ABC1D23.'
    }
    if (fotos.length < 1) return 'Envie ao menos 1 foto do veículo.'
    if (fotos.length > 10) return 'Envie no máximo 10 fotos.'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (enviandoRef.current) return
    const erro = validar()
    if (erro) {
      toast.error(erro, 'Revise o formulário')
      return
    }

    enviandoRef.current = true
    setLoading(true)
    const fd = new FormData()
    fd.append('website', website)
    fd.append('nome', nome.trim())
    fd.append('cpf', onlyDigits(cpf))
    fd.append('email', email.trim())
    fd.append('telefone', telefone.trim())
    fd.append('marca', marca.trim())
    fd.append('modelo', modelo.trim())
    fd.append('ano', onlyDigits(ano))
    fd.append('cor', cor.trim())
    fd.append('cambio', cambio)
    fd.append('combustivel', combustivel)
    fd.append('quilometragem', onlyDigits(quilometragem))
    fd.append('precoDesejado', precoDesejado)
    fd.append('placa', placa.trim())
    fd.append('observacoes', observacoes.trim())
    for (const f of fotos) fd.append('fotos', f.file)

    try {
      const res = await fetch('/api/anuncios', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'Não foi possível enviar seu anúncio.', 'Erro ao enviar')
        return
      }
      setEnviado(true)
    } catch {
      toast.error('Falha de conexão. Tente novamente.', 'Erro ao enviar')
    } finally {
      setLoading(false)
      enviandoRef.current = false
    }
  }

  if (enviado) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <IconCircleCheck size={30} stroke={2} />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Anúncio recebido!</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600 leading-relaxed">
          Nossa equipe vai avaliar as informações e as fotos do seu veículo e
          entrar em contato pelo telefone ou e-mail que você informou.
        </p>
        <Link href="/" className="mt-6 inline-block">
          <Button variant="secondary" size="sm">Voltar para o site</Button>
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Honeypot — escondido de gente, atrativo pra bots */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-neutral-900">
          <IconUser size={18} className="text-liberty" /> Seus dados
        </h3>
        <p className="mb-5 text-xs text-neutral-500">
          Usamos para entrar em contato e formalizar a proposta. Seu CPF é
          guardado de forma criptografada.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nome completo"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: João da Silva"
            leftIcon={<IconUser size={14} />}
          />
          <Input
            label="CPF"
            required
            mask="cpfCnpj"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
            inputMode="numeric"
            leftIcon={<span className="text-[10px] font-bold text-neutral-400">CPF</span>}
          />
          <Input
            label="E-mail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="joao@email.com"
            leftIcon={<IconMail size={14} />}
          />
          <Input
            label="Telefone / WhatsApp"
            type="tel"
            required
            mask="phone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(14) 99999-9999"
            leftIcon={<IconPhone size={14} />}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-neutral-900">
          <IconCar size={18} className="text-liberty" /> O veículo
        </h3>
        <p className="mb-5 text-xs text-neutral-500">
          Quanto mais completo, mais rápido conseguimos avaliar.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Marca"
            required
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            placeholder="Ex: Volkswagen"
          />
          <Input
            label="Modelo"
            required
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            placeholder="Ex: Gol 1.6 MSI"
          />
          <Input
            label="Ano"
            required
            inputMode="numeric"
            maxLength={4}
            value={ano}
            onChange={(e) => setAno(onlyDigits(e.target.value).slice(0, 4))}
            placeholder={String(new Date().getFullYear())}
          />
          <Input
            label="Cor"
            required
            value={cor}
            onChange={(e) => setCor(e.target.value)}
            placeholder="Ex: Prata"
          />
          <Select
            label="Câmbio"
            options={CAMBIO_SELECT}
            value={cambio}
            onChange={(e) => setCambio(e.target.value)}
          />
          <Select
            label="Combustível"
            options={COMBUSTIVEL_SELECT}
            value={combustivel}
            onChange={(e) => setCombustivel(e.target.value)}
          />
          <Input
            label="Quilometragem"
            required
            inputMode="numeric"
            value={quilometragem}
            onChange={(e) => setQuilometragem(onlyDigits(e.target.value).slice(0, 7))}
            placeholder="Ex: 80000"
            leftIcon={<IconGauge size={14} />}
          />
          <Input
            label="Preço desejado (R$)"
            required
            mask="money"
            inputMode="decimal"
            value={precoDesejado}
            onChange={(e) => setPrecoDesejado(e.target.value)}
            placeholder="Ex: 45.000,00"
            leftIcon={<IconCash size={14} />}
          />
          <Input
            label="Placa (opcional)"
            mask="plate"
            value={placa}
            onChange={(e) => setPlaca(e.target.value)}
            placeholder="ABC-1234 ou ABC1D23"
            containerClassName="sm:col-span-2"
          />
        </div>

        <div className="mt-4">
          <Textarea
            label="Informações do veículo"
            required
            rows={4}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            maxLength={2000}
            placeholder="Estado de conservação, itens e opcionais, revisões, único dono, pneus, débitos/financiamento pendente, motivo da venda…"
          />
        </div>

        <div className="mt-5">
          <PhotoUploadField fotos={fotos} onChange={setFotos} max={10} disabled={loading} />
        </div>
      </section>

      <div className="flex flex-col items-center gap-3">
        <Button
          type="submit"
          variant="liberty"
          size="lg"
          loading={loading}
          loadingLabel="Enviando anúncio…"
          leftIcon={<IconSend size={15} stroke={2.5} />}
        >
          Enviar anúncio
        </Button>
        <p className="flex items-center gap-1.5 text-center text-xs text-neutral-400">
          <IconSpeakerphone size={12} />
          Enviar não é uma venda — é só o começo. A equipe avalia e responde.
        </p>
      </div>
    </form>
  )
}
