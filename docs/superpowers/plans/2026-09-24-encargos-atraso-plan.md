# Plano — Encargos por atraso (multa + juros diários)

Spec: `docs/superpowers/specs/2026-09-24-encargos-atraso-design.md`
Branch: `feat/encargos-atraso` (worktree `.claude/worktrees/encargos-atraso`)

Cada tarefa termina com um commit. Verificação final: `npm run lint` + `npm run build`.

## Tarefa 1 — Núcleo de cálculo

- `constants/encargos.ts`: `ENCARGOS_PADRAO = { multaPct: 5, jurosMensalPct: 10 }`
  e `DIAS_MES_JUROS = 30`.
- `utils/cobrancas/encargos.ts` (puro, sem `server-only`, importável pelo client):
  - `diasEntre(de, ate)` com `Date.UTC` em strings `YYYY-MM-DD`
  - `calcularEncargos({ valorParcela, dataVencimento, multaPct, jurosMensalPct,
    isento, pagamentos, referencia })`, que retorna `ResultadoEncargos`
    (principalRestante, encargosPendentes, totalDevido, multa, juros,
    diasAtraso, encargosPagos, principalPago, divisao por pagamento, excedente)
  - `hojeSaoPaulo()` (Intl `en-CA`, `America/Sao_Paulo`)
- Script de checagem no scratchpad (`npx tsx`) com os casos da spec. Não entra
  no repositório.

## Tarefa 2 — Server actions (`app/dashboard/cobrancas/actions.ts`)

- Tipos: `Cobranca.multaPct/jurosMensalPct`; `Parcela.principalRestante`,
  `encargos`, campos de isenção; `Pagamento.paraEncargos/paraPrincipal`.
- `serializeParcela` recebe as taxas da cobrança. `getCobrancas` passa a montar
  as parcelas depois de ler as cobranças, usando um mapa de taxas por
  cobrança.
- `computeStatus` usa o resultado do cálculo e `hojeSaoPaulo()`.
- `criarCobranca` grava `ENCARGOS_PADRAO`.
- `registrarPagamento`: calcula com o novo pagamento incluído e rejeita se
  `excedente > 0,01`, com mensagem mostrando o total devido na data. A
  descrição no financeiro inclui os encargos. O comprovante recebe
  `encargosPagosAgora`/`principalPagoAgora` e `valorRestante` = total devido
  depois do pagamento.
- `enviarComprovantePagamento`: mesma divisão, para o pagamento específico.
- `editarValorParcela`: compara com `principalPago`.
- `enviarEmailCobranca`: usa o cálculo e passa os encargos para o e-mail de
  atraso.
- Nova action `isentarEncargos(parcelaId, isentar: boolean, nome, motivo?)`.

## Tarefa 3 — E-mails, PDF e cron

- `send-cobranca-atraso-email.ts` e o template `cobranca-atraso.ts`: aceitam
  `encargos?` e `totalDevido?`, com linhas de multa, juros e total.
- `processar-lembretes.ts`: carrega pagamentos com data, usa o cálculo para
  "quitada" e para o payload de atraso.
- `comprovante-pagamento.ts` (template) e `ReciboPagamentoDocument.tsx`:
  linhas de encargos e principal quando `encargosPagosAgora > 0`.

## Tarefa 4 — UI (`CobrancasClient.tsx`)

- `ParcelaEncargosInfo`: linha de multa, juros e total (mobile + desktop).
- `PagamentosMini`: "(R$ X de encargos)".
- `PagamentoModal`: recebe as taxas, recalcula na data escolhida, mostra o
  resumo e a divisão, e valida o total.
- `EditarValorParcelaModal`: compara com o principal pago.
- `IsentarEncargosModal` + badge "Encargos isentos" + remover isenção
  (usa `ConfirmDialog`, se já existir no arquivo).
- Barra de progresso da cobrança limitada a 100%.
- `NovaCobrancaModal`: nota das taxas.

## Tarefa 5 — Changelog + verificação

- Entrada `2026-09-24-encargos-atraso` no topo de `constants/changelog.ts`.
- `npm run lint`, `npm run build`, push e PR (sem merge).
- Teste manual: criar cobrança com 1ª parcela no passado, conferir os valores
  no painel, fazer um pagamento parcial, isentar e remover a isenção.
