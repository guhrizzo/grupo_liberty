# Metas de vendas — plano

Spec: `docs/superpowers/specs/2026-10-02-metas-vendedores-design.md`

1. `propostas/actions.ts`: gravar `criado_por_*` no `createProposta`;
   `updatePropostaStatus` aceita `vendedorUid` ao ir para `aceito` (grava
   `vendedor_*` + `aceito_em`; limpa ao sair); `getVendedoresPropostas()`.
2. `PropostasClient.tsx`: modal "Quem fechou?" no Aceitar; "Fechada por X" no card.
3. `app/dashboard/metas/` — `types.ts`, `actions.ts` (getMetas com progresso,
   salvarMeta, excluirMeta, definirBonusPago), `page.tsx`, `MetasClient.tsx`.
4. Menu lateral: item "Metas" (ADM supremo ou acesso a propostas).
5. Changelog.
6. `npm run lint` + `npm run build` + teste manual.
