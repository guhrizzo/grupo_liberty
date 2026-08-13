'use client'

import { useState, useEffect } from 'react'
import { IconUserPlus, IconTrash, IconUsers, IconKey, IconX, IconShield } from '@tabler/icons-react'
import { createUserAction, getAllUsersAction, updateUserRoleAction, deleteUserAction, updateUserPermissionsAction } from './actions'
import {
  Button,
  Input,
  Select,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  EmptyState,
  ConfirmDialog,
  Breadcrumb,
  useToast,
} from '@/app/components/ui'
import { useDebounce } from '@/utils/useDebounce'
import { formatDate } from '@/utils/format'

interface UserManagementClientProps {
  currentUser: any
  currentUserRole: string | null
}

// Definição de todas as abas configuráveis
const PERMISSION_TABS = [
  { key: 'veiculos',      label: 'Veículos',       defaultRoles: ['admin', 'vendedor', 'suporte'] },
  { key: 'consulta_fipe', label: 'Consulta FIPE',  defaultRoles: ['admin', 'vendedor'] },
  { key: 'propostas',     label: 'Propostas',      defaultRoles: ['admin', 'vendedor'] },
  { key: 'contratos',     label: 'Contratos',      defaultRoles: ['admin', 'advogado'] },
  { key: 'financeiro',    label: 'Financeiro',     defaultRoles: ['admin', 'vendedor', 'advogado'] },
  { key: 'cobrancas',     label: 'Cobranças',      defaultRoles: ['admin', 'vendedor'] },
  { key: 'juridico',      label: 'Jurídico',       defaultRoles: ['admin', 'advogado'] },
  { key: 'manutencao',    label: 'Manutenção',     defaultRoles: ['admin', 'vendedor', 'suporte'] },
  { key: 'usuarios',      label: 'Usuários',       defaultRoles: ['admin'] },
] as const

type PermKey = typeof PERMISSION_TABS[number]['key']

export default function UserManagementClient({ currentUser, currentUserRole }: UserManagementClientProps) {
  const [loading, setLoading] = useState(false)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const toast = useToast()

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
  const debouncedSearch = useDebounce(searchTerm, 250)
  const [filterRole, setFilterRole] = useState('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15

  // Estados de confirmação
  const [userToDelete, setUserToDelete] = useState<any | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const [userToUpdateRole, setUserToUpdateRole] = useState<any | null>(null)
  const [pendingRole, setPendingRole] = useState<string>('')

  // Estado do modal de permissões
  const [permModalUser, setPermModalUser] = useState<any | null>(null)
  const [permState, setPermState] = useState<Partial<Record<PermKey, boolean>>>({})
  const [savingPerms, setSavingPerms] = useState(false)

  const handleOpenPermModal = (u: any) => {
    setPermModalUser(u)
    setPermState(u.permissions ?? {})
  }

  const handleClosePermModal = () => {
    setPermModalUser(null)
    setPermState({})
  }

  const handleTogglePerm = (key: PermKey) => {
    setPermState((prev) => {
      const currentValue = prev[key]
      if (currentValue === undefined) {
        // undefined = padrão pelo cargo → ao clicar, define explicitamente como true
        return { ...prev, [key]: true }
      }
      if (currentValue === true) {
        return { ...prev, [key]: false }
      }
      // false → remove a definição explícita (volta ao padrão do cargo)
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const handleSavePerms = async () => {
    if (!permModalUser) return
    setSavingPerms(true)
    try {
      // Manda apenas as chaves definidas explicitamente
      const toSave: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(permState)) {
        if (v !== undefined) toSave[k] = v as boolean
      }
      const result = await updateUserPermissionsAction(permModalUser.id, toSave)
      if (result.error) {
        toast.error(result.error, 'Erro ao salvar')
      } else {
        toast.success(result.success || 'Permissões salvas!', 'Permissões atualizadas')
        const updated = await getAllUsersAction()
        setAllUsers(updated)
        handleClosePermModal()
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro inesperado.', 'Erro')
    } finally {
      setSavingPerms(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.', 'Verifique os campos')
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
        toast.error(result.error, 'Não foi possível cadastrar')
      } else if (result.success && result.user) {
        toast.success(result.success, 'Colaborador cadastrado')
        getAllUsersAction().then(setAllUsers).catch(console.error)
        setName('')
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setRole('vendedor')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar usuário.', 'Erro inesperado')
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
    try {
      const result = await updateUserRoleAction(userToUpdateRole.id, pendingRole)
      if (result.error) {
        toast.error(result.error, 'Não foi possível atualizar')
      } else {
        toast.success(result.success || 'Perfil atualizado com sucesso!', 'Perfil alterado')
        const updated = await getAllUsersAction()
        setAllUsers(updated)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar perfil.', 'Erro inesperado')
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
    try {
      const result = await deleteUserAction(userToDelete.id)
      if (result.error) {
        toast.error(result.error, 'Não foi possível remover')
      } else {
        toast.success(result.success || 'Usuário removido com sucesso!', 'Conta removida')
        const updated = await getAllUsersAction()
        setAllUsers(updated)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao deletar usuário.', 'Erro inesperado')
    } finally {
      setLoading(false)
      setUserToDelete(null)
      setConfirmingDelete(false)
    }
  }

  // Filtragem dos usuários em memória
  const filteredUsers = allUsers.filter((u) => {
    const term = debouncedSearch.toLowerCase()
    const matchesSearch =
      !term ||
      (u.name || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term)

    const matchesRole = filterRole === 'all' || u.role === filterRole
    return matchesSearch && matchesRole
  })

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const visibleUsers = filteredUsers.slice(start, start + PAGE_SIZE)
  const fromItem = filteredUsers.length === 0 ? 0 : start + 1
  const toItem = Math.min(start + PAGE_SIZE, filteredUsers.length)

  // Helper para calcular estado visual de cada permissão no modal
  const getPermStatus = (key: PermKey): 'on' | 'off' | 'default' => {
    const val = permState[key]
    if (val === true) return 'on'
    if (val === false) return 'off'
    return 'default'
  }

  const getRoleDefaultLabel = (key: PermKey): string => {
    const tab = PERMISSION_TABS.find(t => t.key === key)
    if (!tab || !permModalUser?.role) return 'padrão'
    return tab.defaultRoles.includes(permModalUser.role as any) ? 'padrão: ✓' : 'padrão: ✗'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Gerenciar Usuários' },
            ]}
          />
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950">
            Controle de Acessos
          </h1>
        </div>
      </div>

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
                  <Input
                    id="name"
                    label="Nome Completo"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do colaborador"
                    autoComplete="name"
                  />

                  <Input
                    id="email"
                    label="E-mail *"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@libertycar.com"
                    autoComplete="email"
                    inputMode="email"
                  />

                  <Select
                    id="role"
                    label="Perfil de Acesso *"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="advogado">Advogado</option>
                    <option value="suporte">Suporte</option>
                    <option value="admin">Administrador</option>
                  </Select>

                  <Input
                    id="password"
                    label="Senha *"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                  />

                  <Input
                    id="confirmPassword"
                    label="Confirmar Senha *"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                  />

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="liberty"
                      loading={loading}
                      loadingLabel="Cadastrando..."
                      leftIcon={<IconUserPlus size={16} />}
                      fullWidth
                    >
                      Cadastrar Usuário
                    </Button>
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
                  <Input
                    placeholder="Buscar por nome ou e-mail..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setPage(1)
                    }}
                    containerClassName="w-full sm:w-56"
                  />

                  <Select
                    value={filterRole}
                    onChange={(e) => {
                      setFilterRole(e.target.value)
                      setPage(1)
                    }}
                    containerClassName="w-full sm:w-44"
                    aria-label="Filtrar por perfil"
                  >
                    <option value="all">Todos os perfis</option>
                    <option value="admin">Administrador</option>
                    <option value="vendedor">Vendedor</option>
                    <option value="advogado">Advogado</option>
                    <option value="suporte">Suporte</option>
                  </Select>
                </div>
              </div>

              {visibleUsers.length === 0 ? (
                <EmptyState
                  icon={<IconUsers size={24} />}
                  title="Nenhum usuário encontrado"
                  description="Ajuste os filtros ou cadastre um novo colaborador."
                />
              ) : (
                <div className="rounded-xl border border-neutral-200 overflow-hidden">
                  {/* Mobile: cards (evita tabela com scroll horizontal e dropdown cortado) */}
                  <div className="divide-y divide-neutral-200 md:hidden">
                    {visibleUsers.map((u) => {
                      const isSelf = u.id === currentUser.id
                      return (
                        <div key={u.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-neutral-900">
                                {u.name || 'Sem Nome'}
                              </p>
                              <p className="truncate text-xs text-neutral-500">{u.email}</p>
                            </div>
                            {isSelf && (
                              <span className="shrink-0 rounded-full bg-liberty/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-liberty-deep">
                                Você
                              </span>
                            )}
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                Perfil
                              </p>
                              <Select
                                value={u.role || ''}
                                onChange={(e) => handleUpdateRoleClick(u, e.target.value)}
                                disabled={isSelf || currentRole !== 'admin' || loading}
                                aria-label="Alterar perfil de acesso"
                                className="!py-1.5 !text-xs uppercase font-medium"
                              >
                                <option value="admin">Administrador</option>
                                <option value="vendedor">Vendedor</option>
                                <option value="advogado">Advogado</option>
                                <option value="suporte">Suporte</option>
                              </Select>
                            </div>
                            <div>
                              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                Cadastro
                              </p>
                              <p className="pt-1.5 text-xs font-semibold text-neutral-700">
                                {formatDate(u.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-2 border-t border-neutral-100 pt-3">
                            {currentRole === 'admin' && !isSelf && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleOpenPermModal(u)}
                                disabled={loading}
                                leftIcon={<IconKey size={12} />}
                                className="!border-indigo-200 !text-indigo-600 hover:!bg-indigo-50 disabled:!opacity-50 flex-1"
                              >
                                Permissões
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDeleteClick(u)}
                              disabled={isSelf || currentRole !== 'admin' || loading}
                              leftIcon={<IconTrash size={12} />}
                              className="!border-rose-200 !text-rose-600 hover:!bg-rose-50 disabled:!opacity-50 flex-1"
                            >
                              Excluir
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Desktop: tabela */}
                  <div className="hidden md:block">
                    <Table>
                      <THead>
                        <tr>
                          <TH>Nome / E-mail</TH>
                          <TH>Perfil (Cargo)</TH>
                          <TH>Data de Cadastro</TH>
                          <TH align="right">Ações</TH>
                        </tr>
                      </THead>
                      <TBody>
                        {visibleUsers.map((u) => {
                          const isSelf = u.id === currentUser.id
                          return (
                            <TR key={u.id}>
                              <TD>
                                <div className="font-semibold text-neutral-900">{u.name || 'Sem Nome'}</div>
                                <div className="text-xs text-neutral-500">{u.email}</div>
                              </TD>
                              <TD>
                                <Select
                                  value={u.role || ''}
                                  onChange={(e) => handleUpdateRoleClick(u, e.target.value)}
                                  disabled={isSelf || currentRole !== 'admin' || loading}
                                  aria-label="Alterar perfil de acesso"
                                  className="!py-1 !text-xs uppercase font-medium"
                                >
                                  <option value="admin">Administrador</option>
                                  <option value="vendedor">Vendedor</option>
                                  <option value="advogado">Advogado</option>
                                  <option value="suporte">Suporte</option>
                                </Select>
                              </TD>
                              <TD className="text-xs text-neutral-600">
                                {formatDate(u.created_at)}
                              </TD>
                              <TD align="right">
                                <div className="flex items-center justify-end gap-2">
                                  {/* Botão de Permissões */}
                                  {currentRole === 'admin' && !isSelf && (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => handleOpenPermModal(u)}
                                      disabled={loading}
                                      leftIcon={<IconKey size={12} />}
                                      className="!border-indigo-200 !text-indigo-600 hover:!bg-indigo-50 disabled:!opacity-50"
                                    >
                                      Permissões
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleDeleteClick(u)}
                                    disabled={isSelf || currentRole !== 'admin' || loading}
                                    leftIcon={<IconTrash size={12} />}
                                    className="!border-rose-200 !text-rose-600 hover:!bg-rose-50 disabled:!opacity-50"
                                  >
                                    Excluir
                                  </Button>
                                </div>
                              </TD>
                            </TR>
                          )
                        })}
                      </TBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-neutral-200 bg-neutral-50/60">
                      <span className="text-xs text-neutral-500">
                        {filteredUsers.length === 0
                          ? '0 usuários'
                          : `Mostrando ${fromItem}–${toItem} de ${filteredUsers.length}`}
                      </span>
                      <div className="inline-flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={safePage === 1}
                        >
                          Anterior
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safePage === totalPages}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Modal de Permissões */}
      {permModalUser && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClosePermModal() }}
        >
          <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
                  <IconShield size={18} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Permissões de acesso</p>
                  <p className="font-semibold text-neutral-900 leading-tight">
                    {permModalUser.name || permModalUser.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClosePermModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
                aria-label="Fechar"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="overflow-y-auto px-6 py-5">
              <p className="mb-1 text-xs text-neutral-500">
                Cargo atual: <span className="font-medium text-neutral-700 uppercase">{permModalUser.role || '—'}</span>
              </p>
              <p className="mb-4 text-xs text-neutral-400">
                Permissões explícitas substituem o acesso padrão do cargo. Remova a definição explícita para usar o padrão do cargo.
              </p>

              <div className="space-y-2">
                {PERMISSION_TABS.map((tab) => {
                  const status = getPermStatus(tab.key)
                  const defaultLabel = getRoleDefaultLabel(tab.key)
                  return (
                    <div
                      key={tab.key}
                      className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-800">{tab.label}</p>
                        {status === 'default' && (
                          <p className="text-xs text-neutral-400">{defaultLabel}</p>
                        )}
                        {status === 'on' && (
                          <p className="text-xs text-indigo-500">Liberado explicitamente</p>
                        )}
                        {status === 'off' && (
                          <p className="text-xs text-rose-500">Bloqueado explicitamente</p>
                        )}
                      </div>

                      {/* Toggle triplo: padrão → on → off → padrão */}
                      <button
                        onClick={() => handleTogglePerm(tab.key)}
                        className={[
                          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 focus:outline-none',
                          status === 'on'
                            ? 'border-indigo-600 bg-indigo-600'
                            : status === 'off'
                              ? 'border-rose-400 bg-rose-400'
                              : 'border-neutral-300 bg-neutral-200',
                        ].join(' ')}
                        role="switch"
                        aria-checked={status === 'on'}
                      >
                        <span
                          className={[
                            'pointer-events-none inline-block h-4 w-4 translate-y-[1px] rounded-full bg-white shadow-sm ring-0 transition-transform duration-200',
                            status === 'on' ? 'translate-x-[22px]' : status === 'off' ? 'translate-x-[1px]' : 'translate-x-[1px]',
                          ].join(' ')}
                        />
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                <p className="text-xs text-amber-700">
                  <strong>Legenda:</strong> Cinza = padrão do cargo · Azul = liberado · Vermelho = bloqueado
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-neutral-100 px-6 py-4">
              <Button variant="secondary" onClick={handleClosePermModal} disabled={savingPerms}>
                Cancelar
              </Button>
              <Button
                variant="liberty"
                onClick={handleSavePerms}
                loading={savingPerms}
                loadingLabel="Salvando..."
                leftIcon={<IconShield size={14} />}
              >
                Salvar Permissões
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!userToUpdateRole}
        onClose={() => {
          setUserToUpdateRole(null)
          setPendingRole('')
        }}
        onConfirm={confirmUpdateRole}
        title="Alterar Perfil de Acesso?"
        description={
          userToUpdateRole ? (
            <>
              Tem certeza que deseja alterar o perfil de{' '}
              <strong>{userToUpdateRole.name || userToUpdateRole.email}</strong> para{' '}
              <strong className="uppercase">{pendingRole}</strong>?
            </>
          ) : null
        }
        confirmLabel={loading ? 'Processando...' : 'Confirmar Alteração'}
        loading={loading}
      />

      <ConfirmDialog
        open={confirmingDelete && !!userToDelete}
        onClose={() => {
          setUserToDelete(null)
          setConfirmingDelete(false)
        }}
        onConfirm={confirmDelete}
        title="Remover Colaborador?"
        description={
          userToDelete ? (
            <>
              Esta ação é permanente. Tem certeza que deseja excluir a conta de{' '}
              <strong>{userToDelete.name || userToDelete.email}</strong> ({userToDelete.email})?
            </>
          ) : null
        }
        confirmLabel={loading ? 'Removendo...' : 'Remover Conta'}
        tone="danger"
        loading={loading}
      />
    </div>
  )
}