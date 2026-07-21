'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createUserAction, getAllUsersAction, updateUserRoleAction, deleteUserAction, updateUserPermissionsAction } from './actions'

interface UserManagementClientProps {
  currentUser: any
  currentUserRole: string | null
}

export default function UserManagementClient({ currentUser, currentUserRole }: UserManagementClientProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [allUsers, setAllUsers] = useState<any[]>([])

  const currentRole = currentUserRole

  useEffect(() => {
    if (currentRole === 'admin') {
      getAllUsersAction().then(setAllUsers).catch(console.error)
    }
  }, [currentRole])

  // Dados do formulário
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('vendedor')

  // Filtros e busca
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')

  // Estados de confirmação
  const [userToDelete, setUserToDelete] = useState<any | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const [userToUpdateRole, setUserToUpdateRole] = useState<any | null>(null)
  const [pendingRole, setPendingRole] = useState<string>('')

  const [pendingPermissions, setPendingPermissions] = useState<{ contratos: boolean }>({ contratos: false })
  const [userToUpdatePerms, setUserToUpdatePerms] = useState<any | null>(null)

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
        getAllUsersAction().then(setAllUsers).catch(console.error)
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

  const handleUpdateRoleClick = (userObj: any, newRole: string) => {
    setUserToUpdateRole(userObj)
    setPendingRole(newRole)
  }

  const confirmUpdateRole = async () => {
    if (!userToUpdateRole || !pendingRole) return
    setLoading(true)
    setMessage(null)
    try {
      const result = await updateUserRoleAction(userToUpdateRole.id, pendingRole)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: result.success || 'Perfil atualizado com sucesso!' })
        const updated = await getAllUsersAction()
        setAllUsers(updated)
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao atualizar perfil.' })
    } finally {
      setLoading(false)
      setUserToUpdateRole(null)
      setPendingRole('')
    }
  }

  const handleDeleteClick = (userObj: any) => {
    setUserToDelete(userObj)
    setConfirmingDelete(true)
  }

  const confirmDelete = async () => {
    if (!userToDelete) return
    setLoading(true)
    setMessage(null)
    try {
      const result = await deleteUserAction(userToDelete.id)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: result.success || 'Usuário removido com sucesso!' })
        const updated = await getAllUsersAction()
        setAllUsers(updated)
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao deletar usuário.' })
    } finally {
      setLoading(false)
      setUserToDelete(null)
      setConfirmingDelete(false)
    }
  }

  // Filtragem dos usuários em memória
  const filteredUsers = allUsers.filter((u) => {
    const matchesSearch =
      (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = filterRole === 'all' || u.role === filterRole
    return matchesSearch && matchesRole
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
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
      </div>

      {message && (
        <div
          className={`rounded-lg p-4 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-12">
          {/* Formulário de Criação */}
          <div className="lg:col-span-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
              <h2 className="text-lg font-semibold text-neutral-900 mb-6">
                Cadastrar Novo Colaborador
              </h2>

              {currentRole !== 'admin' ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-5 text-amber-800">
                  <p className="font-semibold mb-2">Acesso Restrito</p>
                  <p className="text-sm">
                    Sua conta atual não possui privilégios de administrador para criar novos usuários.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
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

          {/* Tabela de Usuários */}
          <div className="lg:col-span-8">
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs flex flex-col h-full">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">
                    Colaboradores Cadastrados
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Gerencie os acessos e permissões da equipe.
                  </p>
                </div>

                {/* Filtros de Busca */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    placeholder="Buscar por nome ou e-mail..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs focus:border-neutral-900 focus:outline-hidden transition-colors bg-white w-full sm:w-48"
                  />

                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs focus:border-neutral-900 focus:outline-hidden transition-colors bg-white w-full sm:w-36"
                  >
                    <option value="all">Todos os perfis</option>
                    <option value="admin">Administrador</option>
                    <option value="vendedor">Vendedor</option>
                    <option value="advogado">Advogado</option>
                    <option value="suporte">Suporte</option>
                  </select>
                </div>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 py-12 text-center">
                  <p className="text-sm text-neutral-400 font-medium">Nenhum usuário encontrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-neutral-500">
                    <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-700 border-b border-neutral-200">
                      <tr>
                        <th scope="col" className="px-4 py-3">Nome / E-mail</th>
                        <th scope="col" className="px-4 py-3">Perfil (Cargo)</th>
                        <th scope="col" className="px-4 py-3">Data de Cadastro</th>
                        <th scope="col" className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {filteredUsers.map((u) => {
                        const isSelf = u.id === currentUser.id
                        return (
                          <tr key={u.id} className="hover:bg-neutral-50/55 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-neutral-900">{u.name || 'Sem Nome'}</div>
                              <div className="text-xs text-neutral-500">{u.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={u.role || ''}
                                onChange={(e) => handleUpdateRoleClick(u, e.target.value)}
                                disabled={isSelf || currentRole !== 'admin' || loading}
                                className="rounded-lg border border-neutral-200 px-2 py-1 text-xs bg-white focus:border-neutral-900 focus:outline-hidden disabled:opacity-75 transition-colors uppercase font-medium text-neutral-800"
                              >
                                <option value="admin">Administrador</option>
                                <option value="vendedor">Vendedor</option>
                                <option value="advogado">Advogado</option>
                                <option value="suporte">Suporte</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 text-xs text-neutral-600">
                              {new Date(u.created_at).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleDeleteClick(u)}
                                disabled={isSelf || currentRole !== 'admin' || loading}
                                className="rounded-lg border border-neutral-200 hover:border-rose-200 hover:bg-rose-50 text-neutral-600 hover:text-rose-600 px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-neutral-600 disabled:hover:border-neutral-200 cursor-pointer"
                              >
                                Excluir
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Modal de Confirmação para Atualização de Role */}
      {userToUpdateRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-neutral-950 mb-2">Alterar Perfil de Acesso?</h3>
            <p className="text-sm text-neutral-600 mb-6">
              Tem certeza que deseja alterar o perfil de <strong>{userToUpdateRole.name || userToUpdateRole.email}</strong> para <strong className="uppercase">{pendingRole}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setUserToUpdateRole(null)
                  setPendingRole('')
                }}
                disabled={loading}
                className="rounded-lg border border-neutral-200 hover:bg-neutral-100 px-4 py-2 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmUpdateRole}
                disabled={loading}
                className="rounded-lg bg-neutral-950 hover:bg-neutral-850 text-white px-4 py-2 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Processando...' : 'Confirmar Alteração'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Exclusão */}
      {confirmingDelete && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-neutral-950 mb-2">Remover Colaborador?</h3>
            <p className="text-sm text-neutral-600 mb-6">
              Esta ação é permanente. Tem certeza que deseja excluir a conta de <strong>{userToDelete.name || userToDelete.email}</strong> ({userToDelete.email})?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setUserToDelete(null)
                  setConfirmingDelete(false)
                }}
                disabled={loading}
                className="rounded-lg border border-neutral-200 hover:bg-neutral-100 px-4 py-2 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={loading}
                className="rounded-lg bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Removendo...' : 'Remover Conta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}