# Filtro estilo Excel na lista de Leads / Prospecção — design

## Objetivo
Filtrar a lista de leads como no autofiltro do Excel: cada coluna tem um menu
com classificação e lista de valores com checkbox.

## Decisões (usuário, 2026-10-01)
- Vale nas duas telas que usam `ProspeccaoSection` (Leads e Jurídico › Prospecção).
- Filtros não são salvos: recarregar a página zera.
- Só lista de valores (sem filtro por faixa numérica).

## Comportamento
- Botão ▾ em cada cabeçalho da tabela (desktop). Abre um menu com:
  Classificar A→Z / Z→A (crescente/decrescente nas colunas numéricas),
  campo "Pesquisar", "(Selecionar tudo)", valores distintos com checkbox
  (vazio aparece como "(Vazias)"), OK / Cancelar e "Limpar filtro desta coluna".
- Filtros de colunas diferentes se somam (E). A lista de valores de uma coluna
  considera a busca geral e os filtros das *outras* colunas.
- Pesquisar dentro do menu + OK = só os valores marcados que batem com a pesquisa.
- Marcar tudo = sem filtro na coluna. Nada marcado = OK desabilitado.
- Coluna filtrada mostra funil preenchido; coluna ordenada mostra seta.
- Barra de ferramentas: "Limpar filtros (N)" quando houver filtro/ordenação.
- Paginação volta à página 1 a cada mudança; "Selecionar todos os N" respeita o filtro.
- Celular (cartões): botão "Filtros" abre modal com seletor de coluna + o mesmo menu.
- Listas com mais de 500 valores mostram só os 500 primeiros e pedem a pesquisa.

## Arquivos
- `app/dashboard/juridico/prospeccao-filtro.ts` — lógica pura (valores, filtro, ordenação).
- `app/dashboard/juridico/FiltroColuna.tsx` — UI (lista + popover em portal).
- `app/dashboard/juridico/ProspeccaoSection.tsx` — integração.
