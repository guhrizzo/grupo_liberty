'use client'

import { useActionState } from 'react'
import { modulosPortal } from '@/utils/portal/modelo'
import { formatarDocumento } from '@/utils/portal/documento'
import { buscarClientePortal, salvarClientePortal, type DadosCliente } from './actions'

const campo = 'w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2.5 text-sm'
const botao = 'rounded-lg bg-liberty px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50'

export default function FormCadastroPortal() {
  const [estado, buscar, buscando] = useActionState(buscarClientePortal, {})
  return (
    <div className="mt-6 max-w-2xl space-y-6">
      <form action={buscar} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
        <label htmlFor="documento-portal" className="block text-sm font-semibold">CPF ou CNPJ</label>
        <div className="flex flex-wrap gap-3 sm:flex-nowrap">
          <input id="documento-portal" name="documento" type="text" autoCapitalize="characters" maxLength={20} required className={campo} />
          <button disabled={buscando} className={botao}>{buscando ? 'Buscando…' : 'Buscar'}</button>
        </div>
        {estado.erro && <p role="alert" className="text-sm text-red-600">{estado.erro}</p>}
      </form>
      {estado.cliente && <EditarCliente key={JSON.stringify(estado.cliente)} cliente={estado.cliente} />}
    </div>
  )
}

function EditarCliente({ cliente: inicial }: { cliente: DadosCliente }) {
  const [estado, salvar, salvando] = useActionState(salvarClientePortal, {})
  const cliente = estado.cliente ?? inicial
  return (
    <form key={JSON.stringify(cliente)} action={salvar} className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Cadastro de {formatarDocumento(cliente.documento)}</h2>
      <input type="hidden" name="documento" value={cliente.documento} />
      <label className="block space-y-1 text-sm font-medium">
        <span>Nome ou razão social</span>
        <input name="nome" defaultValue={cliente.nome} required maxLength={120} className={campo} />
      </label>
      <label className="block space-y-1 text-sm font-medium">
        <span>E-mail de acesso ao portal</span>
        <input name="email" type="email" defaultValue={cliente.email} required maxLength={254} className={campo} />
      </label>
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-semibold">Módulos exibidos no portal</legend>
        {modulosPortal.map(({ id, nome }) => (
          <label key={id} className="flex items-center gap-2 text-sm">
            <input name={id} type="checkbox" defaultChecked={cliente.modulos.includes(id)} /> {nome}
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input name="ativo" type="checkbox" defaultChecked={cliente.ativo} /> Liberar acesso ao portal
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input name="confirmado" type="checkbox" required className="mt-0.5" /> Confirmei que este e-mail pertence ao titular ou a seu representante autorizado.
      </label>
      {estado.erro && <p role="alert" className="text-sm text-red-600">{estado.erro}</p>}
      {estado.sucesso && <p role="status" className="text-sm text-green-700">{estado.sucesso}</p>}
      <button disabled={salvando} className={botao}>{salvando ? 'Salvando…' : 'Salvar cadastro'}</button>
    </form>
  )
}
