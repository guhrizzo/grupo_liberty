# Métricas no Financeiro — design

Data: 2026-10-03 · Branch: `feat/financeiro-metricas` · Origem: sugestão do
Otavio em Bugs & Melhorias.

## Objetivo

Comparar mês a mês faturamento, custos e lucro, veículos adquiridos e
manutenções feitas, com gráficos.

## Decisões (confirmadas com o Gustavo)

- **Só ADM supremo** vê (mesma regra dos cards de resumo do Financeiro).
- **Onde:** aba `Métricas` no Financeiro (`?aba=metricas`).
- **Período:** 3, 6 ou 12 meses (padrão 6, `?meses=`), terminando no mês corrente;
  cards comparam o mês corrente com o anterior.
- **Faturamento/custos/lucro:** lançamentos `concluido` (receita, despesa,
  receita − despesa) pelo mês de `data`.
- **Veículos adquiridos:** só da Liberty (sem `terceiro`), pelo mês de
  `dataAquisicao` (campo novo no cadastro do veículo); sem ele, `created_at`.
  Valor = soma de `precoAquisicao`.
- **Manutenções:** as que contam (`isManutencaoBaixada`), valor
  `valorManutencao`, pelo mês de `baixa.baixadoEm` (legado: `dataConclusao`,
  senão `dataAgendada`).

## Implementação

- `app/dashboard/financeiro/metricas.ts` (`getMetricas`, gate ADM supremo) +
  `metricas-types.ts`.
- `MetricasSection.tsx`: cards (valor, variação %, mês anterior), 4 gráficos de
  barras em HTML (sem dependência), dica por mês (hover/foco), tabela alternativa.
- Cores validadas com o validador do skill dataviz (light e dark): faturamento
  `#2a78d6`/`#3987e5`, custos `#eb6834`/`#d95926`, lucro negativo
  `#e34948`/`#e66767`.

## Fora do escopo

Filtro por categoria, exportação, metas no gráfico.
