# Plano: selo público de veículo de terceiro

Spec: `docs/superpowers/specs/2026-09-09-selo-terceiro-publico-design.md`
Branch: `feat/selo-terceiro-publico`

## Passo 1 — expor `terceiro` no `PublicVeiculo`
- `app/dashboard/veiculos/public.ts`: adicionar `terceiro: boolean` à
  interface `PublicVeiculo` e ao retorno de `toPublicVeiculo`.
- Commit: `feat: expõe terceiro no PublicVeiculo`

## Passo 2 — badge no card do catálogo
- `app/PublicVehiclesList.tsx`: badge "Anúncio de terceiro" quando
  `v.terceiro`, estilo neutro (cinza/azul), posicionado junto aos demais
  selos da imagem do card (ex.: canto superior esquerdo, abaixo/ao lado do
  selo de localização, sem sobrepor o de desconto).
- Commit: `feat: selo "anúncio de terceiro" no card público`

## Verificação
- `npm run lint`
- `npm run build`
- Teste manual: card de um veículo com `terceiro: true` mostra o selo; os
  demais não mostram.

## Fora de escopo
Página de detalhes pública, filtro/busca por terceiro, alteração do selo
interno em `/dashboard/veiculos`.
