# Metas de vendas por vendedor — design

Data: 2026-10-02 · Branch: `feat/metas-vendedores`

## Objetivo

O ADM supremo define, por vendedor e por mês, uma meta de carros fechados
(ex.: 5) e um bônus. Cada proposta marcada como **Aceito** (= "fechada") conta
para o vendedor que fechou; a barra da meta vai enchendo. Se a meta for batida
dentro do mês, o vendedor ganha o bônus, e o ADM supremo marca quando pagou.

## Decisões (confirmadas com o Gustavo)

- **Qual proposta conta:** as **propostas registradas** (`propostas_registradas`,
  cadastradas pelo vendedor em "Nova proposta"). As propostas do site
  (`propostas`, ofertas de clientes) não contam.
- **Atribuição:** registradas já gravam quem cadastrou (`vendedor_uid`). Novo
  botão "Marcar como fechada" abre "Quem fechou?" já preenchido com ele (dá pra
  trocar). "Reabrir" desfaz e a proposta deixa de contar.
- **Meta individual** por vendedor, **período mensal** (fuso de São Paulo).
- **Bônus:** valor em R$ na meta; ao bater, o ADM supremo marca "Bônus pago".
  Não gera lançamento no Financeiro.
- Só **ADM supremo** (`isAdmSupremo`) cria/edita/exclui metas e marca bônus.

## Dados

### `propostas_registradas` (campos novos)

| campo | quando |
|---|---|
| `status: 'aceito'` | proposta fechada (`definirPropostaFechada`) |
| `fechada_por_uid`, `fechada_por_nome`, `fechada_em` | ao fechar; `null` ao reabrir |

Correção junto: `updatePropostaRegistrada` não sobrescreve mais o `status`
(editar uma proposta fechada a reabria).

### `metas` (coleção nova)

Doc id `${vendedorUid}_${mes}`: uma meta por vendedor por mês (`create` falha
se já existe). Na edição, vendedor e mês ficam fixos.

```
vendedorUid, vendedorNome, mes: 'YYYY-MM', quantidade (>= 1),
bonus: number | null, observacao, bonusPagoEm: ISO | null,
criadoPorUid, criadoPorNome, criadoEm, atualizadoEm
```

## Progresso

Calculado na leitura: registradas com `status == 'aceito'`, agrupadas por
`fechada_por_uid` + mês de `fechada_em` (fuso SP). Queries só de igualdade.

- **Batida**: fechadas ≥ quantidade (bônus liberado).
- **Em andamento**: mês corrente/futuro, ainda não batida.
- **Não batida**: mês passou sem bater.

## Telas

- **`/dashboard/metas`** (menu "Metas", visível para quem acessa Propostas):
  navegação ‹ mês ›. ADM supremo vê todas as metas do mês + resumo (batidas,
  carros, bônus a pagar), cria/edita/exclui, marca/desfaz bônus pago. Vendedor
  vê só a própria meta. Card com barra de progresso e lista das propostas que
  contaram.
- **Propostas registradas:** badge "Fechada por X · data", botões
  "Marcar como fechada" / "Reabrir".

## Fora do escopo

Metas de equipe, períodos livres, lançamento automático do bônus no
Financeiro, notificação por e-mail.

## Verificação

`npm run lint` + `npm run build` + teste manual: criar meta, aceitar propostas
atribuindo ao vendedor, barra enche, bater meta, marcar bônus pago.
