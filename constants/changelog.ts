// "O que há de novo" — changelog interno do dashboard.
//
// Para registrar uma novidade: adicione uma entrada NO TOPO do array `CHANGELOG`,
// no mesmo commit da mudança que ela descreve. A ordem decrescente (mais recente
// primeiro) é assumida por `entriesSince` e pela página /dashboard/novidades.
//
// NUNCA renomeie nem remova o `id` de uma entrada já publicada — é a chave usada
// no `localStorage` de cada usuário para saber o que ele já viu.

export type ChangelogTag = 'novo' | 'melhoria' | 'correcao'

export interface ChangelogEntry {
  /** Estável e ordenável. Convenção: "YYYY-MM-DD-slug". Nunca reutilizar/renomear. */
  id: string
  /** "YYYY-MM-DD" — exibido ao usuário. */
  date: string
  /** Título curto da novidade. */
  title: string
  tag: ChangelogTag
  /** O que mudou, em bullets curtos. */
  items: string[]
}

/** Mais recente primeiro. Adicione novas entradas SEMPRE no topo do array. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-09-02-categorias-de-contrato',
    date: '2026-09-02',
    title: 'Tipo de contrato',
    tag: 'novo',
    items: [
      'Ao anexar um contrato a um veículo agora é obrigatório escolher o tipo: Prestação de Serviço, Venda de veículo financiado, Locação de veículo, Locação com venda de veículo, Financiamento do cliente ou CRLV.',
      'O administrador pode criar outros tipos em "Outros" e gerenciá-los pelo botão "Categorias" na tela de Contratos.',
      'A tela de Contratos ganhou filtro por tipo, e dá para classificar contratos que já estavam anexados sem categoria.',
    ],
  },
  {
    id: '2026-08-31-feedback-bugs-melhorias',
    date: '2026-08-31',
    title: 'Bugs & Melhorias',
    tag: 'novo',
    items: [
      'Nova página no menu para reportar bugs do sistema e sugerir melhorias.',
      'Todo mundo vê a lista de reports e o status de cada um.',
      'Cada report pode ser bug ou melhoria, com título, descrição e a tela onde aconteceu.',
    ],
  },
  {
    id: '2026-08-31-comprovante-email',
    date: '2026-08-31',
    title: 'Comprovante de pagamento por e-mail',
    tag: 'novo',
    items: [
      'Ao registrar um pagamento de parcela, o cliente recebe automaticamente um e-mail com o comprovante e um recibo em PDF anexo.',
      'Pagamento parcial e quitação têm comprovantes diferentes (o parcial mostra o saldo restante).',
      'Se o cliente não tiver e-mail cadastrado, o sistema pede um na hora e salva no cadastro.',
    ],
  },
  {
    id: '2026-08-31-central-novidades',
    date: '2026-08-31',
    title: 'Central de novidades',
    tag: 'novo',
    items: [
      'Esta janela mostra o que mudou no sistema a cada atualização.',
      'O histórico completo fica em "Novidades", no menu lateral.',
    ],
  },
]

/**
 * Entradas mais novas que `lastSeenId` (todas, se `lastSeenId` for null ou não
 * existir mais no array). Como `CHANGELOG` está em ordem decrescente, retorna o
 * prefixo do array até encontrar `lastSeenId`.
 */
export function entriesSince(lastSeenId: string | null): ChangelogEntry[] {
  if (!lastSeenId) return CHANGELOG
  const idx = CHANGELOG.findIndex((e) => e.id === lastSeenId)
  return idx === -1 ? CHANGELOG : CHANGELOG.slice(0, idx)
}
