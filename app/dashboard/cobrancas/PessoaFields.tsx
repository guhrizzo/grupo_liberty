'use client'

import { IconBriefcase, IconId, IconMapPin, IconPhone, IconUser } from '@tabler/icons-react'
import { Input, Select } from '@/app/components/ui'
import { maskCPFCNPJ, maskPhone } from '@/utils/masks'
import { ESTADOS_CIVIS, precisaConjuge } from '@/utils/cobrancas/pessoa'

/** Pessoa no formulário: cpf/telefone mascarados (a action normaliza para dígitos). */
export interface PessoaForm {
  nome: string
  cpf: string
  telefone: string
  endereco: string
  estadoCivil: string
  trabalho: string
}

export const pessoaFormVazia = (): PessoaForm => ({
  nome: '',
  cpf: '',
  telefone: '',
  endereco: '',
  estadoCivil: '',
  trabalho: '',
})

/** Dados do cliente no formulário: pessoa (sem nome, que fica em outro campo) + cônjuge. */
export interface ClienteForm extends Omit<PessoaForm, 'nome'> {
  conjuge: PessoaForm
}

export const clienteFormVazio = (): ClienteForm => ({
  cpf: '',
  telefone: '',
  endereco: '',
  estadoCivil: '',
  trabalho: '',
  conjuge: pessoaFormVazia(),
})

/** Monta o ClienteForm a partir do que está salvo (cpf/telefone em dígitos). */
export function clienteFormDe(c: {
  cpf: string
  telefone: string
  endereco: string
  estadoCivil: string
  trabalho: string
  conjuge: { nome: string; cpf: string; telefone: string; endereco: string; trabalho: string } | null
} | null): ClienteForm {
  if (!c) return clienteFormVazio()
  return {
    cpf: maskCPFCNPJ(c.cpf),
    telefone: maskPhone(c.telefone),
    endereco: c.endereco,
    estadoCivil: c.estadoCivil,
    trabalho: c.trabalho,
    conjuge: c.conjuge
      ? {
          nome: c.conjuge.nome,
          cpf: maskCPFCNPJ(c.conjuge.cpf),
          telefone: maskPhone(c.conjuge.telefone),
          endereco: c.conjuge.endereco,
          estadoCivil: '',
          trabalho: c.conjuge.trabalho,
        }
      : pessoaFormVazia(),
  }
}

interface PessoaFieldsProps {
  idPrefix: string
  value: PessoaForm
  onChange: (patch: Partial<PessoaForm>) => void
  /** Mostra o campo de nome (o cliente tem o nome num campo próprio). */
  comNome?: boolean
  comEstadoCivil?: boolean
  enderecoObrigatorio?: boolean
}

export function PessoaFields({
  idPrefix,
  value,
  onChange,
  comNome = true,
  comEstadoCivil = false,
  enderecoObrigatorio = true,
}: PessoaFieldsProps) {
  return (
    <div className="space-y-3">
      {comNome && (
        <Input
          id={`${idPrefix}-nome`}
          label="Nome completo"
          value={value.nome}
          onChange={(e) => onChange({ nome: e.target.value })}
          autoComplete="off"
          leftIcon={<IconUser size={14} />}
          required
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          id={`${idPrefix}-cpf`}
          label="CPF"
          value={value.cpf}
          onChange={(e) => onChange({ cpf: maskCPFCNPJ(e.target.value).slice(0, 14) })}
          placeholder="000.000.000-00"
          inputMode="numeric"
          autoComplete="off"
          leftIcon={<IconId size={14} />}
          required
        />
        <Input
          id={`${idPrefix}-telefone`}
          label="Telefone"
          value={value.telefone}
          onChange={(e) => onChange({ telefone: maskPhone(e.target.value) })}
          placeholder="(00) 00000-0000"
          inputMode="tel"
          autoComplete="off"
          leftIcon={<IconPhone size={14} />}
          required
        />
      </div>
      <Input
        id={`${idPrefix}-endereco`}
        label="Endereço"
        value={value.endereco}
        onChange={(e) => onChange({ endereco: e.target.value })}
        placeholder="Rua, número, bairro, cidade"
        autoComplete="off"
        leftIcon={<IconMapPin size={14} />}
        required={enderecoObrigatorio}
      />
      {comEstadoCivil && (
        <Select
          id={`${idPrefix}-estadoCivil`}
          label="Estado civil"
          value={value.estadoCivil}
          onChange={(e) => onChange({ estadoCivil: e.target.value })}
          placeholder="Selecione..."
          // O Select mostra a 1ª opção quando o valor é vazio — por isso o "Selecione" é uma opção real.
          options={[{ value: '', label: 'Selecione...' }, ...ESTADOS_CIVIS.map((e) => ({ value: e.value, label: e.label }))]}
          required
        />
      )}
      <Input
        id={`${idPrefix}-trabalho`}
        label="Onde trabalha (opcional)"
        value={value.trabalho}
        onChange={(e) => onChange({ trabalho: e.target.value })}
        autoComplete="off"
        leftIcon={<IconBriefcase size={14} />}
      />
    </div>
  )
}

/** Campos do cliente (CPF, telefone, endereço, estado civil, trabalho) + cônjuge se casado. */
export function ClienteFields({
  value,
  onChange,
}: {
  value: ClienteForm
  onChange: (next: ClienteForm) => void
}) {
  return (
    <div className="space-y-4">
      <PessoaFields
        idPrefix="cliente"
        value={{ nome: '', ...value }}
        comNome={false}
        comEstadoCivil
        onChange={(patch) => {
          const { nome: _n, ...resto } = patch
          void _n
          onChange({ ...value, ...resto })
        }}
      />
      {precisaConjuge(value.estadoCivil) && (
        <div className="space-y-3 rounded-xl border border-liberty/30 bg-liberty/5 p-3.5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-liberty-deep">
            Dados do cônjuge
          </p>
          <PessoaFields
            idPrefix="conjuge"
            value={value.conjuge}
            enderecoObrigatorio={false}
            onChange={(patch) => onChange({ ...value, conjuge: { ...value.conjuge, ...patch } })}
          />
        </div>
      )}
    </div>
  )
}
