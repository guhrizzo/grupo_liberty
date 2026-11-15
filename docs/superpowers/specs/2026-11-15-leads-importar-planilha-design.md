# Importar planilha do Excel em Leads, com prévia e duplicidade — design

## Por quê
Hoje os leads entram colando o conteúdo da planilha ("Colar da planilha"). O
colar desalinha: há várias informações em colunas erradas. Além disso, a
duplicidade só é checada no servidor, depois de clicar em Importar, e os
repetidos somem em silêncio (só aparece a contagem).

## O que o usuário decidiu (2026-11-15)
- Botão para **carregar o arquivo** da planilha do Excel, além do colar.
- **Prévia** de como os dados ficarão consolidados, antes de gravar.
- **Correção de colunas na prévia**: cada coluna da planilha mostra para qual
  campo do lead foi reconhecida e pode ser trocada à mão.
- **Duplicado exato** não entra e aparece avisado na tela.
- **Divergente** (bate com um lead existente, mas algum dado importante para a
  prospecção difere — ex.: mesmo CPF e placa diferente; mesma placa e cidade
  diferente) aparece na tela e **só entra com confirmação**.
- Divergente confirmado **entra como lead novo, ligado ao lead parecido**
  (pode ser o mesmo cliente com outro veículo).
- A ligação aparece na lista como **selo "🔗 N relacionados"**; clicar filtra a
  lista para o grupo. Isso basta (sem tela de detalhe, sem desligar à mão).
- Leitura do arquivo no navegador com **SheetJS** (opção A).

## Metas / não-metas / anti-metas
- Metas: dados na coluna certa; nada descartado sem o usuário ver; nenhum
  duplicado exato gravado; divergentes nunca gravados sem confirmação.
- Não-metas: editar células na prévia; desfazer ligação; mesclar/atualizar o
  lead existente com dados da planilha.
- Anti-metas (falha mesmo "funcionando"): linha descartada em silêncio;
  divergente entrando sem confirmação; o script de limpeza apagar leads
  ligados de propósito.

## Abordagens consideradas
- **A — SheetJS no navegador (escolhida).** Lê .xlsx, .xls e .xml do Excel
  (Planilha XML 2003). A planilha vira matriz de células e segue o mesmo
  pipeline do colar. Trade-off: o pacote `xlsx` do npm está abandonado e com
  vulnerabilidades; instalar o tarball oficial
  (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`), fora do registry.
- B — ExcelJS: só .xlsx, não atende ao .xml/.xls pedido.
- Ler no servidor: descartada; prévia mais lenta e a tela já tem todos os
  leads carregados para comparar.

## Como fica

### Entrada
- Onde: o modal de importação de `ProspeccaoSection.tsx` (usado em Leads e
  em Jurídico › Prospecção; ambas ganham o recurso — *decisão minha*, o
  componente é o mesmo). O botão passa a se chamar "Importar planilha"; o
  modal tem as duas entradas: **Carregar arquivo** (.xlsx, .xls, .xml) e o
  **colar** de hoje.
- Arquivo com várias abas: seletor de aba, primeira aba por padrão
  (*decisão minha*).
- SheetJS carregado por `import()` dinâmico só quando o usuário escolhe um
  arquivo (não pesa no carregamento da página).

### Pipeline (reaproveitando `prospeccao-parse.ts`)
Separar o que hoje está junto em `parseLinhasPlanilha`:
1. **Matriz** de células: do colar (`lerTsv`, já existe) ou do arquivo
   (SheetJS `sheet_to_json(ws, { header: 1, raw: false })` → `string[][]`,
   datas e números como o Excel exibe).
2. **Mapa de colunas** detectado (`mapaCabecalho`, já existe; sem cabeçalho,
   `ORDEM_POSICIONAL`).
3. **Mapa editado pelo usuário** sobrepõe o detectado.
4. **Registros** = aplicar mapa + `normalizarProspeccao` (já existe). Linhas
   sem nome do executado continuam ignoradas e contadas.
O mesmo vale para o colar: a correção de colunas também serve a ele.

### Escopo dos dados
Leads e Jurídico › Prospecção leem a mesma coleção (`juridico_prospeccao`), e
`getProspeccoes` devolve todos os registros, sem paginação no servidor (a
paginação é só na tela). Logo o cliente tem o conjunto completo para comparar,
e a classificação vale igual nas duas telas.

### Correção de colunas (na prévia)
- A prévia mostra as colunas **da planilha** (na ordem do arquivo). No topo de
  cada uma: o título original e um seletor com os campos do lead
  (`PROSPECCAO_COLUNAS`) + "Ignorar coluna".
- Um campo só pode estar em uma coluna: escolher um campo já usado tira ele da
  outra coluna (que vira "Ignorar").
- Colunas não reconhecidas começam em "Ignorar" e ficam visualmente marcadas
  (para chamar atenção).
- Sem coluna mapeada para "Nome do Executado", o botão Importar fica bloqueado
  com aviso de que o nome é obrigatório (*decisão minha*).
- Abaixo da prévia por coluna, o resultado consolidado já nos campos do lead
  (como a tabela de hoje), para o usuário ver como vai ficar.

### Classificação de cada linha
Para cada registro, procurar leads existentes **e linhas anteriores do mesmo
arquivo** que compartilhem alguma chave de `chavesDuplicidade` (CPF/CNPJ,
placa, processo + nome; sem nenhum, nome + telefone):
- **Novo**: nenhuma correspondência.
- **Duplicado**: tem correspondência e nenhum campo importante diverge.
  Não entra.
- **Divergente**: tem correspondência e ao menos um campo importante diverge.
  Só entra se confirmado; entra ligado a todos os leads correspondentes.

**Campos importantes** comparados (usuário confirmou, 2026-11-15, inclusive
valores e telefones mesmo gerando mais avisos): nome, CPF/CNPJ, placa,
processo, comarca, endereço, veículo, ano/modelo, banco, valores (entrada,
financiado, parcela), telefones.
- Comparação ignora formatação: acento, maiúsculas, espaços, pontuação;
  telefones e CPF só dígitos; valores numéricos iguais.
- **Planilha traz dado que o lead cadastrado não tem** (ex.: lead sem placa,
  planilha com placa) **= divergente**, pede confirmação (usuário,
  2026-11-15). Já **planilha vazia onde o lead tem valor não diverge**
  (*decisão minha*): senão toda planilha com colunas a menos viraria
  divergente.
- Telefones: diverge só se nenhum telefone da linha aparece entre os do lead.
- "Cidade": não há campo próprio; a cidade está na Comarca e no Endereço, que
  são comparados.
- Linha que bate com uma **linha anterior do próprio arquivo**: mesma regra;
  se divergente e confirmada, entra ligada à outra linha do arquivo.

### Prévia (modal)
- Resumo no topo: "N novos · N divergentes · N duplicados (não serão
  importados) · N sem nome (ignorados)".
- Seções/abas por categoria, **todas as linhas** (sem o corte de 20 de hoje;
  rolagem).
- Divergentes: cada linha mostra, lado a lado, o lead já cadastrado e o da
  planilha, com os campos diferentes destacados; checkbox para incluir, e
  "marcar todos".
- Duplicados: lista com o lead existente correspondente, só para conferência.
- Botão "Importar N" = novos + divergentes marcados.

### Servidor (`prospeccao-actions.ts` → `importarProspeccoes`)
- Novo formato de entrada: cada linha traz os dados e, se for divergente
  confirmada, `vincularA: string[]` (ids de leads existentes) e/ou o índice das
  linhas do próprio lote a que se liga.
- O servidor **refaz a classificação** (não confia no cliente): linha sem
  `vincularA` que bate com existente e não diverge → ignorada como hoje; linha
  divergente **sem** confirmação → ignorada e contada como "pendente de
  confirmação" na resposta. Linha confirmada → gravada.
- Ligação gravada nos dois sentidos: o lead novo recebe `vinculados: [...]` e
  cada lead ligado recebe o id novo (`FieldValue.arrayUnion`).
- Lotes do Firestore têm limite de 500 operações: dividir o batch.
- Hoje o limite é 400 linhas por chamada (`IMPORT_MAX`). Planilha maior: o
  cliente envia em partes de até 400, em sequência, mostrando progresso
  (*decisão minha*). Ligações dentro da mesma parte: o servidor resolve pelo
  índice da linha no lote. Entre partes diferentes: o cliente garante que a
  linha "original" vá numa parte anterior e passa o id já criado.
- Falha numa parte (*decisão minha*): interrompe as seguintes, mostra quantas
  entraram e recarrega a lista. Reabrir a importação reclassifica contra a
  lista atual, então o que já entrou aparece como duplicado — nada é gravado
  duas vezes.
- Resposta: contagens de importados, duplicados ignorados e divergentes não
  confirmados.

### Modelo de dados
- `Prospeccao` ganha `vinculados: string[]` (ids). Leads antigos: `[]`.
  `serializar` normaliza.
- Ao excluir um lead (`deleteProspeccao`, `deleteProspeccoes`), remover o id
  dos `vinculados` dos outros. Ids órfãos são ignorados na tela de qualquer
  forma.

### Selo e filtro na lista
- Lead com ligações mostra "🔗 N relacionados" (desktop e cartões do celular).
- Clicar filtra a lista para o grupo: o lead e todos os ligados a ele,
  transitivamente (*decisão minha*: assim o grupo inteiro aparece de qualquer
  ponto). Aparece um aviso "Mostrando leads relacionados a <nome> ✕" para
  sair. Combina com a busca/filtros existentes (`prospeccao-filtro.ts`) como
  um filtro a mais; volta à página 1.

### Script de limpeza (`scripts/apagar-leads-duplicados.ts`)
- Leads ligados entre si (direta ou transitivamente) não são tratados como
  duplicados um do outro: o union-find não une dois leads que estão na mesma
  ligação. Duplicados de verdade continuam sendo limpos.
- Ao apagar, também remove o id apagado dos `vinculados` dos que ficam, e
  transfere para o lead que fica as ligações do apagado (*decisão minha*).

## Deixado para quem construir
- Visual e componentes (seguir os componentes de `app/components/ui` e o
  estilo do modal atual).
- Nomes de funções/arquivos novos (sugestão: lógica pura de classificação em
  `prospeccao-importacao.ts`, testável sem UI).
- Mensagens de texto exatas.
- O projeto não tem framework de testes; verificar a lógica pura por script
  `tsx` ou adicionar vitest se for barato.
