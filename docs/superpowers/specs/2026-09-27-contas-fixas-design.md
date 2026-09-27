# Contas fixas — aba dentro do Financeiro

**Data:** 2026-09-27
**Status:** rascunho (aguardando revisão do spec)
**Branch:** `feat/contas-fixas` (criada a partir da `origin/master` em e028a4a)
**Relacionado:** [`app/dashboard/financeiro/page.tsx`](../../../app/dashboard/financeiro/page.tsx), [`app/dashboard/financeiro/FinanceiroClient.tsx`](../../../app/dashboard/financeiro/FinanceiroClient.tsx), [`app/dashboard/financeiro/actions.ts`](../../../app/dashboard/financeiro/actions.ts), [`app/dashboard/financeiro/types.ts`](../../../app/dashboard/financeiro/types.ts), [`app/dashboard/financeiro/periodo.ts`](../../../app/dashboard/financeiro/periodo.ts), [`constants/changelog.ts`](../../../constants/changelog.ts), coleções `transacoes` e `contas_fixas` (nova)

## Problema / objetivo

O Financeiro hoje só tem lançamentos avulsos. As despesas que se repetem
(aluguel, luz, internet, contador, IPTU...) são lançadas à mão todo mês e não
existe um lugar para ver **o que ainda falta pagar** no mês.

O pedido: uma aba **"Contas fixas"** dentro do Financeiro, onde se cadastram as
contas fixas da empresa e se marca, mês a mês, quais já foram pagas.

Decisões de produto já tomadas (brainstorm 2026-09-27):

- A conta fixa é um **cadastro + "marcar como paga" por mês** (não é só uma
  lista, e não há geração automática de lançamentos por cron).
- Marcar como paga **cria uma despesa nos lançamentos** do Financeiro.
- Periodicidade: **mensal ou anual** (anual aparece só no mês do vencimento).
- Fica em **sub-abas dentro de `/dashboard/financeiro`**
  (**Lançamentos | Contas fixas**), compartilhando o seletor de mês.
- No modal de "marcar como paga", o **valor vem preenchido mas é editável**,
  junto com a data do pagamento — atende contas de valor variável (luz, água).

## Não-objetivos (nesta entrega)

- Periodicidades além de mensal/anual (bimestral, trimestral, semestral).
- Lançamento automático/pendente na virada do mês; lembretes por e-mail.
- Anexar comprovante direto pela aba Contas fixas (continua possível pelo
  lançamento gerado, na aba Lançamentos).
- Item novo no menu lateral ou permissão própria.

## Modelo de dados

### Coleção nova `contas_fixas`

```ts
export type ContaFixaPeriodicidade = 'mensal' | 'anual'

export interface ContaFixa {
  id: string
  nome: string                 // "Aluguel da loja"
  categoria: string            // texto livre, ex.: "Aluguel", "Energia" (opcional → "Outros")
  valor: number                // valor previsto (> 0)
  periodicidade: ContaFixaPeriodicidade
  diaVencimento: number        // 1–31
  mesVencimento: number | null // 1–12, obrigatório só quando anual
  ativa: boolean
  observacao: string | null
  mesInicio: string            // 'YYYY-MM' — mês do cadastro (fuso do negócio)
  created_at: string
  updated_at: string
  created_by: string | null
}
```

`mesInicio` é gravado no cadastro (`mesAtual()`) e não é editável: a conta só
aparece a partir desse mês, para meses passados não virarem uma lista de
"vencidas" falsas.

### Pagamento = lançamento em `transacoes`

Não há coleção de pagamentos. Marcar como paga cria um documento em
`transacoes` com **ID determinístico** `contafixa_<contaId>_<YYYY-MM>`:

```ts
{
  descricao: '<nome da conta> (<rótulo curto do mês>)',   // "Aluguel da loja (set/2026)"
  categoria: 'Conta Fixa',
  tipo: 'despesa',
  valor,                 // do modal
  data,                  // data do pagamento, do modal
  status: 'concluido',
  origemContaFixaId: contaId,
  competencia: 'YYYY-MM', // mês de referência da conta (não o mês do pagamento)
  created_by, created_at, updated_at,
}
```

- Gravação com `docRef.create()` — se o documento já existir (clique duplo,
  duas abas), o Firestore rejeita e a action responde "Esta conta já foi
  marcada como paga neste mês". Sem duplicidade, sem transação.
- O **status "paga"** de uma conta num mês é derivado da existência desse
  documento. Leitura: `adminDb.getAll(...refs)` com os IDs das contas do mês
  (uma leitura por conta listada, sem índice novo).
- Consequência: **excluir o lançamento na aba Lançamentos desmarca a conta**
  sozinho; editar o lançamento (valor, data) reflete na aba Contas fixas.
  `updateTransacao` usa `update()` e preserva `origemContaFixaId`/`competencia`.
- `Transacao` ganha `origemContaFixaId?: string | null` e
  `competencia?: string | null`; `getTransacoes` passa a mapeá-los.
- `TRANSACAO_CATEGORIAS` ganha `'Conta Fixa'` (antes de `'Outros'`).

**Competência × data do pagamento:** a conta de março paga em 2 de abril
aparece **paga em março** na aba Contas fixas, e o lançamento cai em **abril**
no fluxo de caixa (é quando o dinheiro saiu).

## Regras de exibição (lista do mês)

Uma conta aparece no mês `M` se **tem pagamento em `M`** ou se, ao mesmo tempo:

1. está `ativa`;
2. `mesInicio <= M`;
3. é `mensal`, ou é `anual` com `mesVencimento === mês de M`.

Vencimento no mês `M` = `min(diaVencimento, último dia de M)` (dia 31 em
fevereiro vira 28/29).

Status (comparando com `hojeNoFuso()`):

| Situação | Selo |
| --- | --- |
| Existe o lançamento `contafixa_<id>_<M>` | **Paga** (data + valor pagos) |
| Vencimento > hoje | **A vencer** |
| Vencimento = hoje | **Vence hoje** |
| Vencimento < hoje | **Vencida** |

Ordenação: não pagas primeiro, por data de vencimento; pagas por último.

Cards do mês: **Total previsto** (soma do valor pago se paga, senão do valor
previsto), **Pago** (soma dos valores pagos), **Em aberto** (soma dos previstos
não pagos).

## Tela

- `?aba=contas-fixas` na URL seleciona a aba (ausente = Lançamentos). A troca de
  aba e a navegação de mês preservam o outro parâmetro (`?mes=` / `?aba=`).
- Seletor de mês e a virada automática de mês continuam valendo para as duas
  abas. O cabeçalho/seletor é o mesmo; abaixo dele renderiza o conteúdo da aba.
- **Aba Contas fixas** (`ContasFixasClient.tsx`):
  - 3 cards do mês.
  - Lista do mês: nome, categoria, vencimento, valor, selo de status e ação:
    - não paga → **"Marcar como paga"** → modal com valor (pré-preenchido com o
      valor previsto, máscara `maskMoneyIntuitivo`) e data (hoje) → confirma.
    - paga → **"Desfazer"** → `ConfirmDialog` → apaga o lançamento.
  - Seção **"Contas cadastradas"**: todas as contas (inativas esmaecidas), com
    **Nova conta**, editar, ativar/desativar e excluir (com confirmação).
  - Form de conta: nome*, categoria, valor previsto*, periodicidade*, dia de
    vencimento* (1–31), mês de vencimento* (só se anual), observação.
  - Mobile: lista em cards empilhados, no mesmo padrão visual do Financeiro.
- Excluir uma conta **não apaga** os lançamentos já gerados (histórico fica).
  O texto de confirmação avisa isso.

## Código

- `app/dashboard/financeiro/contasFixas/types.ts` — tipos, `ContaFixaResponse`,
  field errors.
- `app/dashboard/financeiro/contasFixas/regras.ts` — funções puras:
  `contaApareceNoMes`, `vencimentoNoMes`, `statusDaConta`, `idLancamentoContaFixa`.
  Usadas no servidor e no cliente.
- `app/dashboard/financeiro/contasFixas/actions.ts` (`'use server'`) — todas
  começam com `assertPageAccess('financeiro')` (regra do PR #32):
  - `getContasFixas()` — todas as contas.
  - `getPagamentosContasFixas(mes, contaIds)` — `getAll` dos lançamentos.
  - `createContaFixa(formData)`, `updateContaFixa(id, formData)`,
    `setContaFixaAtiva(id, ativa)`, `deleteContaFixa(id)`.
  - `marcarContaFixaPaga(contaId, mes, formData)` — valida valor > 0 e data
    válida; `create()` do lançamento.
  - Desfazer não tem action própria: o cliente chama o `deleteTransacao`
    existente com o ID `contafixa_<id>_<mes>` — que já apaga o comprovante no
    Storage, se houver.
  - Todas fazem `revalidatePath('/dashboard/financeiro')`.
- `page.tsx` — lê `?aba`; as transações e o intervalo de meses continuam
  sendo carregados sempre (o seletor de mês depende deles); quando a aba é
  `contas-fixas`, carrega também as contas + pagamentos do mês.
- `FinanceiroClient.tsx` — ganha as abas no topo e passa a renderizar
  `ContasFixasClient` quando a aba é Contas fixas; o `router.push` do seletor de
  mês preserva `?aba=`. Mudança mínima nesse arquivo (já tem ~800 linhas).
- `types.ts` / `actions.ts` do Financeiro — campos novos em `Transacao` e
  categoria `'Conta Fixa'`.
- `constants/changelog.ts` — entrada nova no topo (`tag: 'novo'`).

## Erros

- Sem acesso → mensagem do `assertPageAccess` (igual ao resto do Financeiro).
- Campos inválidos → `fieldErrors` no form, igual aos lançamentos.
- Pagamento duplicado → erro amigável (código `ALREADY_EXISTS` do `create()`).
- Desfazer quando o lançamento já não existe → erro "Lançamento não encontrado" do `deleteTransacao` + refresh (a tela volta ao estado real).

## Verificação

Sem test runner no projeto: `npm run lint` + `npm run build` + teste manual:

1. Cadastrar conta mensal (dia 10) e anual (mês atual, dia 31) → aparecem no mês.
2. Marcar a mensal como paga com valor diferente → selo Paga, lançamento
   "Conta Fixa" na aba Lançamentos com o valor digitado.
3. Excluir esse lançamento na aba Lançamentos → conta volta a não paga.
4. Navegar para o mês anterior ao cadastro → contas não aparecem.
5. Navegar para outro mês → anual some; mensal aparece.
6. Desativar conta → some do mês (se não paga); excluir conta → lançamentos
   antigos permanecem.
7. Mobile (375px): abas, lista e modal legíveis.
