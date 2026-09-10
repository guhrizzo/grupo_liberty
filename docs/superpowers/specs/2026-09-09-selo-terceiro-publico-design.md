# Selo público de veículo de terceiro

## Contexto

Veículos anunciados por terceiros (fluxo `/anuncie-seu-veiculo` →
`/dashboard/anuncios`) já ganham `terceiro: true` no documento `veiculos` e um
selo "Terceiro" — hoje visível só internamente, no card do
`/dashboard/veiculos` (ver [[feature-anuncios-terceiros]]). Na parte pública
do site não há nenhuma indicação de que o veículo não pertence à Liberty Car.

## Objetivo

Mostrar, na aba pública, uma marcação discreta indicando que o veículo é um
anúncio de terceiro e não pertence diretamente à Liberty Car.

## Decisão (aprovada com o Gustavo)

- **Onde:** apenas no card do catálogo público (home, `PublicVehiclesList`).
  Não inclui a página de detalhes do veículo (`/veiculos/[id]`) nesta rodada.
- **Texto:** "Anúncio de terceiro" — neutro, sem alarmismo.
- **Estilo:** badge discreto (cinza/azul), no mesmo padrão visual dos outros
  selos do card (localização, +N fotos, desconto), sem reaproveitar a cor
  âmbar usada no aviso interno (que é mais "atenção", não cabe pro público).
- **Dados expostos:** só o booleano `terceiro`. `terceiroInfo` (nome/telefone/
  e-mail do dono) continua estritamente interno — nunca sai pro
  `PublicVeiculo`.

## Escopo técnico

1. `app/dashboard/veiculos/public.ts`: adicionar `terceiro: boolean` em
   `PublicVeiculo` e no mapeamento `toPublicVeiculo`.
2. `app/PublicVehiclesList.tsx`: renderizar o badge "Anúncio de terceiro" no
   card quando `v.terceiro === true`.

Fora de escopo: página de detalhes pública, filtro por terceiro, mudança no
selo interno existente.
