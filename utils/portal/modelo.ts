export const modulosPortal = [
  { id: 'quitacao', nome: 'Quitação', descricao: 'Acompanhe o andamento da quitação do seu veículo.' },
  { id: 'posVenda', nome: 'Pós-venda', descricao: 'Acompanhe os atendimentos relacionados ao seu veículo.' },
  { id: 'investimentos', nome: 'Investimentos', descricao: 'Acompanhe suas operações de investimento.' },
] as const

export interface PerfilPortal {
  nome: string
  telefone: string
  cidade: string
  uf: string
  cpfResponsavel: string
}

export type ModuloPortal = (typeof modulosPortal)[number]['id']

export function normalizarEmail(value: unknown) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

export const atalhosPortal = [
  { id: 'inicio-portal', nome: 'Visão geral' },
  { id: 'veiculos-portal', nome: 'Meus veículos' },
  { id: 'registros-portal', nome: 'Contratos e operações' },
  { id: 'anunciar-portal', nome: 'Anunciar meu veículo' },
  { id: 'perfil-portal', nome: 'Meu perfil' },
] as const

export function idsMenuPortal(modulos: ModuloPortal[]) {
  return [
    ...atalhosPortal.map(({ id }) => id),
    ...modulosPortal.filter(({ id }) => modulos.includes(id)).map(({ id }) => `modulo-${id}`),
  ]
}
