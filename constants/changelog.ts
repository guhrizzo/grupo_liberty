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
    id: '2026-09-10-visitantes-do-site',
    date: '2026-09-10',
    title: 'Visitantes do site',
    tag: 'novo',
    items: [
      'Nova aba "Visitantes" no menu (só admin): mostra quantas pessoas acessam o site.',
      'Visitantes de hoje e do mês, separando quem está logado de quem é anônimo, mais os pageviews.',
      'Gráfico dos últimos 30 dias e ranking dos veículos mais vistos.',
      'A conta usa um identificador anônimo por navegador (sem dados pessoais); a navegação interna do painel não é contabilizada.',
    ],
  },
  {
    id: '2026-09-10-remover-foto-veiculo-mobile',
    date: '2026-09-10',
    title: 'Remover fotos de veículo no celular',
    tag: 'melhoria',
    items: [
      'No cadastro/edição de veículo pelo celular, o "X" de cada foto agora fica sempre visível (antes só aparecia com o mouse em cima, o que não dava no toque).',
      'Ao tocar no "X" o sistema pede confirmação antes de tirar a foto da galeria, evitando remoção acidental.',
      'A foto só sai de vez quando você salva as alterações do veículo.',
    ],
  },
  {
    id: '2026-09-07-baixa-manutencao',
    date: '2026-09-07',
    title: 'Baixa de manutenção (valor + comprovante)',
    tag: 'melhoria',
    items: [
      'A manutenção agora é cadastrada sem valor — só os dados do serviço.',
      'Quando o serviço termina, use "Dar baixa": informe o valor pago e, se quiser, anexe um comprovante (PDF ou imagem). A baixa marca a manutenção como Concluída.',
      'Só manutenção com baixa entra no "Custo efetivo total" do veículo. Dá para "Estornar" uma baixa (admin).',
      'Manutenções antigas que já tinham custo continuam contando normalmente.',
    ],
  },
  {
    id: '2026-09-06-custo-efetivo-total-veiculo',
    date: '2026-09-06',
    title: 'Custo efetivo total do veículo',
    tag: 'melhoria',
    items: [
      'O formulário de veículo agora mostra o "Custo efetivo total" — soma dos débitos do veículo, do preço de aquisição e das manutenções do veículo.',
      'Cada manutenção com baixa entra como uma linha "Manutenção — <tipo>" e é somada automaticamente; ao dar baixa, estornar ou remover uma manutenção o total é atualizado.',
      'É um valor interno de controle de custo; não aparece em propostas, PDF nem no site.',
      'Novo débito "Translado": custo para transportar o veículo (ex.: gasolina para buscá-lo).',
    ],
  },
  {
    id: '2026-09-06-preco-aquisicao-veiculo',
    date: '2026-09-06',
    title: 'Preço de aquisição do veículo',
    tag: 'melhoria',
    items: [
      'No cadastro/edição de veículo agora dá para registrar o "Preço de Aquisição" — quanto foi pago para obter o veículo.',
      'É um valor interno de controle de custo: não entra no total de débitos e não aparece em propostas, PDF nem no site.',
    ],
  },
  {
    id: '2026-09-06-debitos-veiculo-ajustes',
    date: '2026-09-06',
    title: 'Débitos do veículo revisados',
    tag: 'melhoria',
    items: [
      '"Arrastamento / Guincho" agora se chama "Cegonha / Guincho".',
      'Removidos os itens "DPVAT" e "IPVA parcelado".',
      '"Débitos no RENAVAM" foi substituído por "Procurações".',
    ],
  },
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
