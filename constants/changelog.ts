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
    id: '2026-10-03-rede-de-apoio',
    date: '2026-10-03',
    title: 'Nova aba "Rede de apoio"',
    tag: 'novo',
    items: [
      'Cadastre amigos, parceiros, conhecidos e mentorados com a cidade e o estado onde moram, telefone e se podem receber ou ir ver um veículo.',
      'A lista fica agrupada por estado, com busca por nome ou cidade e botão direto para o WhatsApp. Serve para achar alguém de confiança quando fechamos negócio longe da sede.',
    ],
  },
  {
    id: '2026-10-03-cobrancas-dias-vencimento-desktop',
    date: '2026-10-03',
    title: 'Dias até o vencimento no computador',
    tag: 'melhoria',
    items: [
      'Em Cobranças, no computador, a coluna Vencimento das parcelas agora mostra quantos dias faltam ("em 4 dias") ou há quantos dias está atrasada, como já aparecia no celular.',
    ],
  },
  {
    id: '2026-10-03-propostas-card-recolhido',
    date: '2026-10-03',
    title: 'Propostas registradas mais compactas no celular',
    tag: 'melhoria',
    items: [
      'No celular, cada proposta registrada aparece resumida (cliente, veículo e comissão). Toque na setinha para ver contato, valores e os botões de fechar, baixar, editar e excluir.',
    ],
  },
  {
    id: '2026-10-03-leads-card-recolhido',
    date: '2026-10-03',
    title: 'Leads mais compactos no celular',
    tag: 'melhoria',
    items: [
      'No celular, cada lead aparece resumido (nome, CPF, cidade e veículo). Toque na setinha para ver os detalhes, registrar visita e as ações.',
    ],
  },
  {
    id: '2026-10-03-cargo-financeiro',
    date: '2026-10-03',
    title: 'Novo cargo "Financeiro"',
    tag: 'novo',
    items: [
      'Novo cargo "Financeiro" em Usuários: acessa Financeiro e Cobranças, além de Demandas, Agenda, Novidades e Bugs & Melhorias. Como nos outros cargos, dá para liberar ou bloquear abas nas permissões de cada pessoa.',
    ],
  },
  {
    id: '2026-10-03-modal-rolagem-mobile',
    date: '2026-10-03',
    title: 'Janelas longas rolam no celular',
    tag: 'correcao',
    items: [
      'No celular, janelas com muitos campos (como "Novo compromisso" na Agenda) agora rolam por dentro, e o botão de salvar sempre fica acessível.',
    ],
  },
  {
    id: '2026-10-03-juros-ate-pagamento-parcial',
    date: '2026-10-03',
    title: 'Pagamento atrasado quita primeiro a multa e os juros',
    tag: 'correcao',
    items: [
      'Quando o cliente paga uma parcela atrasada, o pagamento quita primeiro a multa e os juros acumulados até aquele dia, e o restante abate a parcela.',
      'Depois disso, os juros correm só sobre o que sobrou da parcela.',
    ],
  },
  {
    id: '2026-10-03-encargos-sobre-saldo',
    date: '2026-10-03',
    title: 'Multa e juros sobre o saldo em aberto',
    tag: 'melhoria',
    items: [
      'A multa de 5% é cobrada logo após o vencimento, sobre o que estava em aberto naquele dia: se o cliente pagou parte da parcela até o vencimento, a multa fica só sobre o restante.',
      'Pagamento parcial agora abate primeiro a parcela. Os juros (0,33% ao dia, compostos, nunca sobre a multa) passam a correr só sobre o que ficou em aberto, a partir da data do pagamento.',
      'Quem paga atrasado só o valor da parcela continua devendo a multa e os juros daquele dia.',
    ],
  },
  {
    id: '2026-10-03-encargos-cobrancas-antigas',
    date: '2026-10-03',
    title: 'Multa e juros também nas cobranças antigas',
    tag: 'melhoria',
    items: [
      'As cobranças criadas antes da regra de multa e juros passam a cobrar encargos por atraso, mas só nas parcelas que vencem a partir de 03/10/2026. Parcelas que venceram antes continuam sem multa e juros.',
    ],
  },
  {
    id: '2026-10-03-visao-geral-metricas',
    date: '2026-10-03',
    title: 'Métricas mudaram para a Visão Geral',
    tag: 'melhoria',
    items: [
      'Os gráficos de faturamento, custos, lucro, veículos e manutenções saíram do Financeiro e agora são a própria Visão Geral (só para a diretoria).',
    ],
  },
  {
    id: '2026-10-03-financeiro-metricas',
    date: '2026-10-03',
    title: 'Métricas da empresa na Visão Geral',
    tag: 'novo',
    items: [
      'A Visão Geral (só para a diretoria) agora mostra as métricas da empresa: gráficos de faturamento, custos e lucro mês a mês, para comparar com os meses anteriores.',
      'Também mostra quantos veículos foram adquiridos e quantas manutenções foram pagas em cada mês, com os valores.',
      'Escolha ver 3, 6 ou 12 meses; os cards comparam o mês atual com o anterior. Dá para ver tudo em tabela.',
      'Novo campo "Data de aquisição" no cadastro do veículo: é ela que define o mês da compra nas métricas (sem ela, vale a data de cadastro).',
    ],
  },
  {
    id: '2026-10-03-juridico-ultima-movimentacao',
    date: '2026-10-03',
    title: 'Última movimentação nos processos',
    tag: 'melhoria',
    items: [
      'A lista de processos do Jurídico agora mostra a "Última movimentação": a anotação mais recente do processo, com quem escreveu e a data.',
      'As colunas Tipo, Responsável e Prazo saíram da lista (continuam no cadastro do processo). Clique na movimentação para abrir as anotações.',
    ],
  },
  {
    id: '2026-10-03-agenda',
    date: '2026-10-03',
    title: 'Agenda de compromissos com Google Agenda',
    tag: 'novo',
    items: [
      'Nova aba "Agenda": a administração marca compromissos com data, horário, local e participantes.',
      'Clique em "Conectar Google Agenda" uma vez e os compromissos em que você participa aparecem sozinhos na sua agenda do Google, no celular e no computador. Mudou ou cancelou no painel, muda lá também.',
      'No app Liberty Car para computador, a conexão abre no navegador; depois é só voltar para o app.',
    ],
  },
  {
    id: '2026-10-02-juridico-aba-contratos',
    date: '2026-10-02',
    title: 'Aba "Contratos recebidos" no Jurídico',
    tag: 'melhoria',
    items: [
      'Os contratos enviados pelo setor de Contratos agora têm uma aba própria no Jurídico, em vez de ficarem no fim da lista de processos.',
      'Dá para buscar por documento, veículo ou quem enviou e filtrar entre pendentes e já registrados como processo.',
    ],
  },
  {
    id: '2026-10-02-acesso-adm-supremo',
    date: '2026-10-02',
    title: 'Visão Geral e Usuários só para a diretoria',
    tag: 'melhoria',
    items: [
      'A Visão Geral e a aba Usuários agora são exclusivas da diretoria. Para os demais, o painel abre direto em Demandas.',
    ],
  },
  {
    id: '2026-10-02-organizar-menu',
    date: '2026-10-02',
    title: 'Organize o seu menu',
    tag: 'novo',
    items: [
      'Novo botão "Organizar menu", no rodapé do menu lateral: use as setas para colocar os itens na ordem que preferir. A ordem é só sua e vale em qualquer aparelho.',
      '"Restaurar padrão" volta para a ordem original, que também foi reorganizada (Demandas logo abaixo da Visão Geral).',
      'O menu agora mostra quantas tarefas você tem pendentes em Demandas.',
    ],
  },
  {
    id: '2026-10-02-metas-valor-fipe',
    date: '2026-10-02',
    title: 'Meta em R$ pelo valor FIPE',
    tag: 'melhoria',
    items: [
      'Nas Metas, a meta em R$ agora soma o valor FIPE dos veículos das propostas fechadas (antes era o valor da proposta).',
      'A lista de propostas fechadas de cada meta mostra o valor FIPE de cada uma.',
    ],
  },
  {
    id: '2026-10-02-tarefas-prioridade',
    date: '2026-10-02',
    title: 'Prioridade nas tarefas',
    tag: 'melhoria',
    items: [
      'Cada tarefa agora tem prioridade: Urgente, Importante ou Normal. A administração escolhe ao criar ou editar.',
      'Tarefas urgentes e importantes ganham uma tag colorida e aparecem primeiro na lista.',
      'Dá para filtrar a lista pela prioridade.',
    ],
  },
  {
    id: '2026-10-02-metas-vendedores',
    date: '2026-10-02',
    title: 'Metas de vendas com bônus',
    tag: 'novo',
    items: [
      'Nova aba "Metas": a administração define a meta do mês de cada vendedor (em veículos fechados, em R$ pela soma do valor FIPE dos veículos, ou as duas — a administração escolhe se basta bater uma ou se precisa bater as duas) e o bônus ao bater a meta.',
      'Em Propostas registradas, use "Marcar como fechada" e escolha quem fechou; a barra da meta do vendedor vai enchendo a cada proposta fechada no mês.',
      'Ao bater a meta dentro do mês, o bônus fica liberado e aparece como pago quando a administração confirmar o pagamento.',
    ],
  },
  {
    id: '2026-10-02-leads-resultado-visita',
    date: '2026-10-02',
    title: 'Resultado da visita nos Leads',
    tag: 'novo',
    items: [
      'Botão "Visita" em cada lead: marque o resultado (positiva, negativa, endereço não encontrado, não mora mais no endereço, ninguém em casa / não atendeu ou retornar), a data e uma observação.',
      'Em "Retornar", informe a data de retorno; retornos de hoje e atrasados ficam em destaque.',
      'Cada lead guarda o histórico de visitas; a lista mostra a última, e dá para filtrar pelas colunas "Última visita" e "Retornar em".',
    ],
  },
  {
    id: '2026-10-01-leads-filtro-excel',
    date: '2026-10-01',
    title: 'Filtro estilo Excel na lista de Leads',
    tag: 'melhoria',
    items: [
      'Cada coluna da lista de Leads (e da Prospecção no Jurídico) ganhou a setinha de filtro, como no Excel: marque os valores que quer ver, pesquise dentro da coluna e classifique de A a Z ou do menor para o maior.',
      'Dá para combinar filtros em várias colunas; a coluna filtrada fica com o funil destacado e "Limpar filtros" tira tudo de uma vez.',
      'No celular, use o botão de funil ao lado da busca.',
    ],
  },
  {
    id: '2026-10-01-tarefas',
    date: '2026-10-01',
    title: 'Aba Tarefas',
    tag: 'novo',
    items: [
      'Nova aba "Tarefas" no menu: a administração atribui tarefas com prazo a cada usuário.',
      'Na tarefa, marque "Concluí" (com um comentário, se quiser) ou "Não concluí" explicando o motivo. Dá para mudar a resposta até a tarefa ser fechada.',
      'O número ao lado de "Tarefas" no menu mostra quantas tarefas pendentes você tem; as atrasadas ficam em vermelho.',
      'Tarefa concluída que não precisa mais aparecer? Use "Pedir ao ADM para excluir".',
      '"Meus afazeres" na aba Tarefas: sua lista pessoal de to-do, só você vê. Marque, edite e limpe os concluídos.',
    ],
  },
  {
    id: '2026-09-29-leads',
    date: '2026-09-29',
    title: 'Aba Leads e cargo Vendedor externo',
    tag: 'novo',
    items: [
      'Nova aba "Leads" no menu, com a mesma lista da Prospecção de clientes do Jurídico (WhatsApp, e-mail de oferta, Maps/Waze, importação da planilha).',
      'Novo cargo "Vendedor externo" em Usuários: por padrão acessa Leads, Propostas e Consulta FIPE. O admin pode liberar ou bloquear abas nas permissões.',
      'Prospecção no celular agora aparece em cartões, mostra 30 registros por página, ganhou o campo Placa e um botão de tela cheia.',
    ],
  },
  {
    id: '2026-09-28-juridico-prospeccao',
    date: '2026-09-28',
    title: 'Prospecção de clientes no Jurídico',
    tag: 'novo',
    items: [
      'Nova tabela "Prospecção de clientes" na aba Jurídico, com processo, executado, banco, veículo, dados do financiamento e contatos.',
      'Cadastre um registro de cada vez ou use "Colar da planilha" para importar várias linhas copiadas do Excel de uma vez.',
      'Botão "Proposta" em cada linha abre o cadastro de proposta já preenchido (cliente, veículo, banco e parcelas). Se faltar CPF, telefone, e-mail ou veículo, o sistema pede antes.',
      'Quem tem celular válido ganha botão de WhatsApp; quem tem e-mail ganha botão para enviar uma oferta pelo veículo, com texto pronto e editável.',
    ],
  },
  {
    id: '2026-09-27-contas-fixas-nao-pagas',
    date: '2026-09-27',
    title: 'Contas fixas não pagas em destaque',
    tag: 'melhoria',
    items: [
      'Contas fixas vencidas e não pagas aparecem em vermelho no topo do Financeiro — nas abas "Lançamentos" e "Contas fixas" —, em qualquer mês que você estiver vendo.',
      'Dá para marcar como paga direto dali — a conta some do aviso assim que é paga.',
    ],
  },
  {
    id: '2026-09-27-contas-fixas',
    date: '2026-09-27',
    title: 'Contas fixas no Financeiro',
    tag: 'novo',
    items: [
      'Nova aba "Contas fixas" dentro do Financeiro para cadastrar aluguel, luz, internet e outras contas que se repetem (mensais ou anuais).',
      'Veja no mês o que já foi pago, o que vence hoje e o que está vencido.',
      'Ao marcar uma conta como paga, a despesa entra automaticamente nos lançamentos do mês.',
    ],
  },
  {
    id: '2026-09-25-galeria-fotos-mobile',
    date: '2026-09-25',
    title: 'Galeria de fotos em tela cheia no celular',
    tag: 'melhoria',
    items: [
      'Ao ampliar as fotos de um veículo pelo celular, a foto agora ocupa a tela inteira — antes, fotos em pé ficavam pequenas no meio da tela.',
      'Deslize para o lado para trocar de foto e para baixo para fechar.',
      'Miniaturas de todas as fotos na parte de baixo: toque em uma para ir direto até ela.',
      'Com a foto ampliada (toque nela), arraste o dedo para ver os detalhes.',
      'Vale para a página do veículo no site e para as fotos do estoque e dos anúncios no painel.',
    ],
  },
  {
    id: '2026-09-25-contrato-upload-direto',
    date: '2026-09-25',
    title: 'Contratos grandes voltam a ser anexados',
    tag: 'correcao',
    items: [
      'PDFs de contrato acima de ~4,5MB falhavam ao anexar, mesmo dentro do limite de 10MB. Agora o arquivo vai direto para o armazenamento e qualquer PDF de até 10MB funciona.',
    ],
  },
  {
    id: '2026-09-24-encargos-atraso',
    date: '2026-09-24',
    title: 'Multa e juros por atraso nas cobranças',
    tag: 'novo',
    items: [
      'Cobranças novas cobram multa de 5% + juros de 10% ao mês, calculados por dia de atraso (30 dias = 10%).',
      'A parcela atrasada mostra a multa, os juros e o total atualizado do dia.',
      'Ao registrar um pagamento, o valor sugerido já inclui os encargos até a data escolhida; o pagamento quita primeiro multa/juros e depois a parcela.',
      'Botão "Isentar" retira multa e juros de uma parcela, registrando quem isentou e o motivo.',
      'E-mail de atraso e comprovante de pagamento (e-mail + PDF) mostram os encargos.',
      'Cobranças cadastradas antes desta atualização continuam sem encargos.',
    ],
  },
  {
    id: '2026-09-10-veiculos-vendidos',
    date: '2026-09-10',
    title: 'Veículos vendidos no site',
    tag: 'novo',
    items: [
      'No estoque, a visibilidade do veículo agora tem três opções: Disponível, Vendido e Privado.',
      'Ao marcar como "Vendido", o carro sai da vitrine principal e aparece numa seção "Vendidos recentemente" na home, com selo de vendido e sem exibir o valor.',
      'Veículos vendidos ficam expostos por 30 dias e depois são removidos automaticamente, junto com as fotos.',
      'Dá pra voltar atrás: mudar de "Vendido" para "Disponível" recoloca o carro no estoque e zera a contagem dos 30 dias.',
    ],
  },
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
