'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createUserAction, makeMeAdmin } from './actions'

interface UserManagementClientProps {
  currentUser: any
}

interface SessionUser {
  email: string
  role: string
  name?: string
}

export default function UserManagementClient({ currentUser }: UserManagementClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [adminLoading, setAdminLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [createdUsers, setCreatedUsers] = useState<SessionUser[]>([])

  // Dados do formulário
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('vendedor')

  const currentRole = currentUser?.user_metadata?.role

  const handleMakeAdmin = async () => {
    setAdminLoading(true)
    setMessage(null)
    try {
      const result = await makeMeAdmin()
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: result.success || 'Agora você é administrador!' })
        router.refresh()
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao atualizar para admin.' })
    } finally {
      setAdminLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem.' })
      setLoading(false)
      return
    }

    try {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('email', email)
      formData.append('password', password)
      formData.append('confirmPassword', confirmPassword)
      formData.append('role', role)

      const result = await createUserAction(formData)

      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else if (result.success && result.user) {
        setMessage({ type: 'success', text: result.success })
        // Adiciona à lista da sessão
        setCreatedUsers((prev) => [result.user!, ...prev])
        // Limpa formulário
        setName('')
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setRole('vendedor')
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao criar usuário.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Cabeçalho */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Link href="/dashboard" className="hover:text-black hover:underline transition-all">
                Dashboard
              </Link>
              <span>/</span>
              <span className="font-medium text-neutral-900">Gerenciar Usuários</span>
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950">
              Controle de Acessos
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-600">
              Logado como: <strong className="text-neutral-900">{currentUser.email}</strong> 
              {currentRole ? (
                <span className="ml-2 rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-semibold text-neutral-800 uppercase">
                  {currentRole}
                </span>
              ) : (
                <span className="ml-2 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800">
                  Sem Perfil
                </span>
              )}
            </span>
            {!currentRole && (
              <button
                onClick={handleMakeAdmin}
                disabled={adminLoading}
                className="rounded bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {adminLoading ? 'Atualizando...' : 'Tornar Admin (Dev)'}
              </button>
            )}
          </div>
        </div>

        {/* Alerta de Mensagem */}
        {message && (
          <div
            className={`mb-6 rounded-lg p-4 text-sm font-medium ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Conteúdo Principal */}
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Formulário de Criação (Coluna Principal/Esquerda) */}
          <div className="lg:col-span-7">
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
              <h2 className="text-lg font-semibold text-neutral-900 mb-6">
                Cadastrar Novo Colaborador
              </h2>

              {currentRole !== 'admin' ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-5 text-amber-800">
                  <p className="font-semibold mb-2">Acesso Restrito</p>
                  <p className="text-sm mb-4">
                    Sua conta atual não possui privilégios de administrador para criar novos usuários.
                  </p>
                  {!currentRole && (
                    <button
                      onClick={handleMakeAdmin}
                      disabled={adminLoading}
                      className="rounded bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {adminLoading ? 'Processando...' : 'Liberar Perfil de Administrador (Dev)'}
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                        Nome Completo
                      </label>
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nome do colaborador"
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden transition-colors"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                        E-mail *
                      </label>
                      <input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@libertycar.com"
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="role" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                      Perfil de Acesso *
                    </label>
                    <select
                      id="role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:border-neutral-900 focus:outline-hidden transition-colors"
                    >
                      <option value="vendedor">Vendedor</option>
                      <option value="advogado">Advogado</option>
                      <option value="suporte">Suporte</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="password" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                        Senha *
                      </label>
                      <input
                        id="password"
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden transition-colors"
                      />
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                        Confirmar Senha *
                      </label>
                      <input
                        id="confirmPassword"
                        type="password"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a senha"
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden transition-colors"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-lg bg-neutral-950 hover:bg-neutral-850 text-white font-medium py-2.5 text-sm transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? 'Cadastrando...' : 'Cadastrar Usuário'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Lista de Criados na Sessão (Coluna Lateral/Direita) */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs h-full flex flex-col">
              <h2 className="text-lg font-semibold text-neutral-900 mb-2">
                Criados nesta Sessão
              </h2>
              <p className="text-xs text-neutral-500 mb-6">
                Histórico temporário de contas criadas recentemente por você.
              </p>

              {createdUsers.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 py-12 text-center">
                  <p className="text-sm text-neutral-400 font-medium">Nenhum usuário criado nesta sessão</p>
                  <p className="text-xs text-neutral-400 mt-1">Preencha o formulário ao lado para começar.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {createdUsers.map((u, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 bg-neutral-50/50 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="text-sm font-semibold text-neutral-900 truncate">
                          {u.name || 'Sem nome'}
                        </p>
                        <p className="text-xs text-neutral-500 truncate">{u.email}</p>
                      </div>
                      <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold text-neutral-700 uppercase tracking-wider">
                        {u.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
