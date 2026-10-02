# Filtro estilo Excel na lista de Leads — plano

Spec: `docs/superpowers/specs/2026-10-01-leads-filtro-excel-design.md`
Branch: `feat/leads-filtro-excel`

1. `prospeccao-filtro.ts`: `valorFiltro`, `rotuloFiltro`, `valoresDistintos`,
   `aplicarFiltros` (com coluna ignorada), `ordenar`.
2. `FiltroColuna.tsx`: `FiltroLista` (conteúdo do menu) e `FiltroColunaBotao`
   (botão do cabeçalho + popover em portal, posição fixa, fecha em clique fora/Esc/scroll).
3. `ProspeccaoSection.tsx`: estado `filtros` + `ordem`; busca → filtros → ordenação;
   botões nos `TH`; "Limpar filtros"; modal "Filtros" no celular; textos de
   seleção/vazio.
4. Changelog em `constants/changelog.ts`.
5. `npm run lint` + `npm run build` + teste manual no navegador.
