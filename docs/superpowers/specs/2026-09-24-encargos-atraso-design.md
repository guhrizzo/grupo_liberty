# Encargos por atraso nas cobranças (multa + juros diários)

**Data:** 2026-09-24
**Branch:** `feat/encargos-atraso`
**Status:** aprovado (design) — aguardando ok da spec/plano

## Objetivo

Parcelas de cobrança pagas depois do vencimento passam a cobrar:

- **Multa de 5%** sobre o valor em aberto, uma única vez, a partir do 1º dia de atraso.
- **Juros simples de 10% a cada 30 dias**, cobrados por dia (10% / 30 = 0,3333…% ao dia),
  sobre o valor da parcela que continua em aberto.

Sem carência: venceu ontem e não pagou → multa + 1 dia de juros.

Exemplo: parcela de R$ 1.000,00, 30 dias de atraso → multa R$ 50,00 + juros
R$ 100,00 = **R$ 1.150,00**. Com 45 dias: multa R$ 50,00 + juros R$ 150,00.

## Decisões

| Tema | Decisão |
|---|---|
| Taxa | 10% a cada 30 dias → 0,3333% ao dia, juros **simples** |
| Carência | nenhuma |
| Base de cálculo | valor da parcela ainda em aberto (principal) |
| Ordem de quitação | cada pagamento quita **primeiro os encargos**, depois o principal (CC art. 354) |
| Cobranças existentes | **não** cobram encargos — só as criadas depois do deploy |
| Isenção | botão "Isentar encargos" por parcela, com nome de quem isentou (+ motivo opcional); reversível |
| Persistência | nada de encargo é gravado; tudo é recalculado a partir dos pagamentos |

## Modelo

### Onde a taxa fica guardada

A cobrança ganha dois campos, gravados em `criarCobranca`:

```
multaPct: number        // 5
jurosMensalPct: number  // 10  (juros ao dia = jurosMensalPct / 30)
```

Os valores padrão ficam em `constants/encargos.ts`. Cobranças antigas não têm
os campos → lidos como `0` → nenhum encargo → comportamento idêntico ao de hoje.
Isso também congela a regra por contrato: se a taxa padrão mudar no futuro, as
cobranças que já existem mantêm a taxa com que foram criadas.

### Isenção (na parcela)

```
encargosIsentos: boolean
encargosIsentosPor: string | null
encargosIsentosMotivo: string | null
encargosIsentosEm: string | null   // ISO
```

Com a isenção ativa, a parcela é calculada como se as taxas fossem 0. Os
pagamentos que antes tinham ido para encargos passam a abater o principal.
Remover a isenção volta ao cálculo normal.

### Cálculo (função pura `calcularEncargos`)

Vive em `utils/cobrancas/encargos.ts` e é usada pelo servidor e pelo client.
Entrada: valor da parcela, data de vencimento, taxas, se está isenta, a lista
de pagamentos `{ id, valor, data }` e a data de referência (hoje, ou a data de
um novo pagamento).

O cálculo percorre os pagamentos em ordem de data:

```
P = valorParcela            // principal em aberto
E = 0                       // encargos pendentes
multaAplicada = false
jurosDesde = vencimento

acumular(ate):
  se ate > vencimento e P > 0:
    se não multaAplicada: E += round2(P × multaPct/100); multaAplicada = true
    dias = diasEntre(max(jurosDesde, vencimento), ate)
    se dias > 0: E += round2(P × (jurosMensalPct/100/30) × dias)
  jurosDesde = max(jurosDesde, ate)

para cada pagamento (ordem de data, depois criadoEm):
  acumular(pagamento.data)
  paraEncargos = min(valor, E);   E -= paraEncargos
  paraPrincipal = min(valor - paraEncargos, P);   P -= paraPrincipal
  excedente += valor - paraEncargos - paraPrincipal

acumular(referencia)
```

Saída:

- `principalRestante` (P), `encargosPendentes` (E) e `totalDevido` (P + E)
- `multaAcumulada`, `jurosAcumulados` e `diasAtraso` na data de referência
- `encargosPagos`: soma do que os pagamentos já quitaram de encargos
- a divisão de cada pagamento: `{ pagamentoId, paraEncargos, paraPrincipal }`
- `excedente`: quanto foi pago além do devido (usado para validar)

Quando a parcela é quitada, os juros param de correr, porque `P = 0`.

Datas: tudo em strings `YYYY-MM-DD`, com diferença de dias por `Date.UTC`, sem
depender do fuso. O "hoje" do servidor usa o fuso `America/Sao_Paulo`, mesma
lógica do `hojeNoFuso()` que o client já usa.

### O que muda na `Parcela` serializada

- `valorRestante` passa a ser o **total devido hoje** (principal + encargos).
  Isso faz os KPIs, os totais "a receber/atrasado" e o extrato incluírem os
  encargos sem mexer em cada soma.
- `status`: fica `pago` quando `principalRestante ≤ 0,01` **e**
  `encargosPendentes ≤ 0,01`.
- Campos novos: `principalRestante`, `encargos` (`{ multa, juros, diasAtraso,
  pendentes, pagos }` ou `null` quando não há nada), os campos de isenção, e
  cada `Pagamento` ganha `paraEncargos`/`paraPrincipal` (calculados, não
  gravados).
- `Cobranca` ganha `multaPct` e `jurosMensalPct`.

## Comportamento por tela ou fluxo

### Painel `/dashboard/cobrancas`

- Parcela atrasada com encargos mostra uma linha extra: `+ multa R$ X + juros
  R$ Y (N dias) = total R$ Z`, no card mobile e na tabela desktop.
- Os pagamentos no `PagamentosMini` mostram "(R$ X de encargos)" quando parte do
  pagamento foi para encargos.
- Botão **Isentar encargos**, visível para quem tem `canEdit` e só em parcelas
  com encargos acumulados. Abre um modal com o nome de quem está isentando
  (usuário da sessão, igual à edição de valor) e um motivo opcional.
- Parcela isenta ganha o badge "Encargos isentos", com tooltip mostrando quem,
  quando e o motivo, e a opção de remover a isenção.
- O modal de nova cobrança ganha uma nota informativa: "Em caso de atraso: multa
  de 5% + juros de 10% ao mês, cobrados por dia."

### Registrar pagamento

- O valor sugerido é o **total devido na data escolhida**, e se ajusta quando a
  data muda.
- Resumo: valor da parcela, já pago, multa, juros (N dias), total devido.
- Mostra como o valor digitado será dividido: "R$ X para encargos, R$ Y para a
  parcela".
- Validação no client e no servidor: o valor não pode passar do total devido na
  data do pagamento. O servidor recalcula com todos os pagamentos e rejeita se
  `excedente > 0,01`.
- O lançamento no financeiro continua sendo uma receita com o valor total pago.
  A descrição ganha " — inclui R$ X de encargos" quando houver.

### Editar valor da parcela

A trava "novo valor ≥ já pago" passa a comparar com o **principal já pago**,
não com o total pago, que agora pode incluir encargos.

### E-mail de atraso (cron do dia seguinte e envio manual)

- O payload ganha `encargos` opcional (`multa`, `juros`, `diasAtraso`) e
  `totalDevido`.
- O template mostra: valor em aberto, multa, juros e o total atualizado até hoje,
  com a frase "o valor aumenta a cada dia de atraso".
- A escolha da parcela mais urgente no envio manual passa a usar
  `principalRestante`/`totalDevido` do cálculo.

### Comprovante (e-mail HTML + PDF)

- `ComprovantePagamentoData` ganha `encargosPagosAgora` e `principalPagoAgora`,
  ambos opcionais.
- Quando `encargosPagosAgora > 0`, o e-mail e o PDF mostram as linhas "Encargos
  (multa + juros)" e "Abatido da parcela" abaixo de "Valor pago agora".
- `valorRestante` no comprovante = total devido na data do pagamento, depois do
  pagamento.

### Changelog

Adicionar uma entrada em `constants/changelog.ts` ("Multa e juros por atraso").

## Fora do escopo

- Alterar as taxas pela interface. Elas ficam fixas no padrão, gravadas por
  cobrança.
- Cobrar encargos de cobranças antigas.
- Correção monetária, protesto ou negativação.
- Gravar os encargos no Firestore ou criar um histórico de encargos.

## Riscos e atenções

- **Barras de progresso** que comparam `valorPago` com `valorParcela` podem
  passar de 100% quando houver encargos pagos. Vão usar o principal pago ou ser
  limitadas a 100%.
- **Remover um pagamento** refaz a divisão dos demais. Isso é o esperado, porque
  a regra é derivada, mas o comprovante já enviado continua com os números da
  época.
- **Fuso horário:** o status "atrasado" hoje usa o relógio do servidor, que é
  UTC na Vercel. O cálculo de encargos vai usar a data em São Paulo, e o
  `computeStatus` será alinhado a ela para as duas coisas não divergirem.

## Verificação

Não há test runner. Verificação: `npm run lint` + `npm run build`, mais um
script de checagem da função pura (casos: em dia, 1 dia, 30 dias, 45 dias,
pagamento parcial com atraso, pagamento antes do vencimento, isenção,
excedente) rodado com `npx tsx` no scratchpad, mais teste manual no painel.
