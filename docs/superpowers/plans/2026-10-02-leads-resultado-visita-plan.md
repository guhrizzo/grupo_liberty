# Resultado de visita nos Leads — plano

Spec: `docs/superpowers/specs/2026-10-02-leads-resultado-visita-design.md`
Branch: `feat/leads-resultado-visita`

1. `types.ts`: `ResultadoVisita`, `VisitaLead`, `Prospeccao.visitas`.
2. `prospeccao-visita.ts`: lista de resultados (rótulo + cor), validação de data,
   `hojeLocal`, `ordenarVisitas`, `normalizarVisitas`.
3. `prospeccao-actions.ts`: `serializar` lê `visitas`; `registrarVisita` e
   `excluirVisita` (transação; excluir = autor ou ADM supremo).
4. `prospeccao-filtro.ts`: colunas `ultimaVisita` e `retornoEm` no filtro Excel.
5. `VisitaLead.tsx`: `SeloVisita`, `DataRetorno`, `UltimaVisita`, `VisitasModal`.
6. `ProspeccaoSection.tsx`: colunas novas após o nome, botão "Visita" nas ações
   (tabela) e "Registrar visita" no cartão; props `usuarioUid`/`podeExcluirVisitas`
   vindas das páginas de Leads e Jurídico.
7. Changelog; tsc + eslint; teste manual (registrar, filtrar, recarregar, excluir; celular).
