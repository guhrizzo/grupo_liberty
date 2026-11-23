'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { IconDeviceFloppy, IconLock } from '@tabler/icons-react'
import { ESTADO_OPCOES } from '@/utils/estadosBrasil'
import { maskCPFCNPJ, maskPhone } from '@/utils/masks'
import { formatarDocumento } from '@/utils/portal/documento'
import type { PerfilPortal } from '@/utils/portal/modelo'
import SelectCliente from '@/app/area-do-cliente/SelectCliente'
import { salvarPerfilPortal } from './actions'

const estados = [{ value: '', label: 'Selecione o estado' }, ...ESTADO_OPCOES]
const campo = 'mt-1.5 min-h-11 w-full rounded-lg border border-[var(--portal-borda)] bg-[var(--portal-campo)] px-3 py-2 text-base text-[var(--portal-texto)] focus-visible:outline-2 focus-visible:outline-[var(--portal-foco)] sm:text-sm'
const rotulo = 'block min-w-0 text-sm font-medium text-[var(--portal-rotulo)]'

export default function FormPerfil({ perfil, documento, email }: { perfil: PerfilPortal; documento: string; email: string }) {
  const [telefone, setTelefone] = useState(() => maskPhone(perfil.telefone))
  const [cpf, setCpf] = useState(() => maskCPFCNPJ(perfil.cpfResponsavel))
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null)
  const [salvando, iniciar] = useTransition()
  const empresa = documento.length === 14

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    setMensagem(null)
    iniciar(async () => {
      try {
        const resultado = await salvarPerfilPortal(dados)
        setMensagem(resultado.erro
          ? { texto: resultado.erro, erro: true }
          : { texto: 'Dados salvos com sucesso.', erro: false })
      } catch {
        setMensagem({ texto: 'Não foi possível salvar seus dados. Tente novamente.', erro: true })
      }
    })
  }

  return (
    <form method="post" onSubmit={salvar} className="space-y-5 rounded-2xl border border-[var(--portal-divisor)] bg-[var(--portal-campo)] p-5 sm:p-7">
      <label className={rotulo}>
        Nome completo
        <input name="nome" className={campo} defaultValue={perfil.nome} required minLength={2} maxLength={120} autoComplete="name" placeholder="Ex.: Maria Silva" />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className={rotulo}>
          {empresa ? 'CNPJ vinculado' : 'CPF vinculado'}
          <input className={campo} value={formatarDocumento(documento)} placeholder={empresa ? "00.000.000/0000-00" : "000.000.000-00"} readOnly />
        </label>
        <label className={rotulo}>
          E-mail de acesso
          <input className={campo} type="email" value={email} placeholder="voce@exemplo.com" readOnly />
        </label>
      </div>
      <p className="flex items-start gap-2 text-xs text-[var(--portal-secundario)]">
        <IconLock aria-hidden size={15} className="shrink-0" />
        Para corrigir o documento vinculado ou alterar o e-mail de acesso, fale com a equipe Liberty.
      </p>
      {empresa && (
        <label className={rotulo}>
          CPF do responsável (opcional)
          <input name="cpfResponsavel" className={campo} inputMode="numeric" maxLength={14} value={cpf} placeholder="000.000.000-00"
            onChange={(evento) => setCpf(maskCPFCNPJ(evento.target.value.replace(/\D/g, '').slice(0, 11)))} />
        </label>
      )}
      <label className={rotulo}>
        Telefone / WhatsApp (opcional)
        <input name="telefone" className={campo} type="tel" autoComplete="tel-national" value={telefone}
          maxLength={15} onChange={(evento) => setTelefone(maskPhone(evento.target.value))} placeholder="(00) 00000-0000" />
      </label>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]">
        <label className={rotulo}>
          Cidade (opcional)
          <input name="cidade" className={campo} defaultValue={perfil.cidade} maxLength={120} autoComplete="address-level2" placeholder="Ex.: Bauru" />
        </label>
        <SelectCliente label="Estado (opcional)" name="uf" defaultValue={perfil.uf} autoComplete="address-level1" options={estados} />
      </div>
      {mensagem && (
        <p role={mensagem.erro ? 'alert' : 'status'} className={`text-sm ${mensagem.erro ? 'text-[var(--portal-erro)]' : 'text-[var(--portal-link)]'}`}>{mensagem.texto}</p>
      )}
      <button type="submit" disabled={salvando} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-[var(--portal-acao)] px-4 py-2 text-sm font-semibold text-[var(--portal-acao-texto)] hover:bg-[var(--portal-acao-hover)] disabled:opacity-60">
        <IconDeviceFloppy aria-hidden size={17} /> {salvando ? 'Salvando…' : 'Salvar dados'}
      </button>
    </form>
  )
}
