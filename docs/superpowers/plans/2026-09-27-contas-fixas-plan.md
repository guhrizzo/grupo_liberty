# Plano de implementação — Contas fixas

**Spec:** `docs/superpowers/specs/2026-09-27-contas-fixas-design.md`
**Branch:** `feat/contas-fixas` (worktree `.claude/worktrees/contas-fixas`, de `origin/master` e028a4a; spec commitado)
**Data:** 2026-09-27

Verificação global: `npm run lint` limpo · `npm run build` limpo · testes manuais
1–7 do spec. **Sem merge na master sem "ok".** Push + PR assim que o build passar.

Antes de escrever código: conferir em `node_modules/next/dist/docs/` o guia de
`searchParams` em page (Promise) e de `revalidatePath` — Next 16 (AGENTS.md).
O `page.tsx` do Financeiro já usa `searchParams: Promise<...>`; seguir o mesmo.

Convenções que este plano segue:
- Firestore via `@/utils/firebase/admin` (`adminDb`).
- Gate: `assertPageAccess('financeiro')` de `@/utils/permissions` no começo de
  toda server action, leitura inclusive (PR #32 / fix de leituras sem gate).
- Tipos/constantes fora de arquivos `'use server'` (só exportam funções async).
- Datas de negócio via `periodo.ts` (`hojeNoFuso`, `mesAtual`, `intervaloDoMes`,
  `rotuloMesCurto`) — nunca `toISOString()` para dia/mês.
- Valores: `maskMoneyIntuitivo` / `parseMoneyIntuitivo` / `moneyFromNumber` de
  `money.ts`; exibição com `formatCurrency` de `@/utils/format`.
- UI: `Modal`, `ConfirmDialog`, `Input`, `Select`, `EmptyState`, `useToast` de
  `@/app/components/ui`; classes/tema (`adobe-dark:`) copiados do
  `FinanceiroClient.tsx` (cards, tabela, botões).

---

## Passo 1 — Tipos e regras puras

**`app/dashboard/financeiro/contasFixas/types.ts`** (novo)
- `ContaFixaPeriodicidade`, `ContaFixa` (campos do spec).
- `ContaFixaFieldErrors = { nome?, valor?, diaVencimento?, mesVencimento? }`.
- `ContaFixaResponse = { success?, error?, fieldErrors?, conta? }`.
- `PagamentoContaFixa = { contaId: string; transacaoId: string; valor: number; data: string }`.
- `ContaFixaStatus = 'paga' | 'a_vencer' | 'vence_hoje' | 'vencida'`.

**`app/dashboard/financeiro/contasFixas/regras.ts`** (novo, síncrono, sem `'use server'`)
```ts
export function idLancamentoContaFixa(contaId: string, mes: Mes): string {
  return `contafixa_${contaId}_${mes}`
}

/** `YYYY-MM-DD` do vencimento em `mes`, com dia limitado ao último dia do mês. */
export function vencimentoNoMes(conta: Pick<ContaFixa, 'diaVencimento'>, mes: Mes): string {
  const { fim } = intervaloDoMes(mes)
  const ultimo = Number(fim.slice(8))
  const dia = Math.min(Math.max(conta.diaVencimento, 1), ultimo)
  return `${mes}-${String(dia).padStart(2, '0')}`
}

/** Regra 1–3 do spec (sem considerar pagamento). */
export function contaVenceNoMes(conta: ContaFixa, mes: Mes): boolean {
  if (!conta.ativa || conta.mesInicio > mes) return false
  if (conta.periodicidade === 'mensal') return true
  return conta.mesVencimento === Number(mes.slice(5))
}

export function statusDaConta(vencimento: string, paga: boolean, hoje: string): ContaFixaStatus
```
- `contasDoMes(contas, pagamentos, mes, hoje)` → lista `{ conta, vencimento, status, pagamento? }`
  já filtrada (`paga || contaVenceNoMes`) e ordenada (não pagas por vencimento,
  pagas por último).

_Commit 1: `feat(contas-fixas): tipos e regras de vencimento/status`_

## Passo 2 — Campos novos em Transacao

- `financeiro/types.ts`: `'Conta Fixa'` no union `TransacaoCategoria` e em
  `TRANSACAO_CATEGORIAS` (antes de `'Outros'`); `Transacao` ganha
  `origemContaFixaId?: string | null` e `competencia?: string | null`.
- `financeiro/actions.ts` → `getTransacoes`: mapear
  `origemContaFixaId: data.origemContaFixaId ?? null`, `competencia: data.competencia ?? null`.
- Conferir no `FinanceiroClient` que a opção nova no `<Select>` de categoria não
  quebra nada (é só mais uma opção).

_Commit 2: `feat(contas-fixas): categoria "Conta Fixa" e vínculo no lançamento`_

## Passo 3 — Server actions

**`app/dashboard/financeiro/contasFixas/actions.ts`** (novo, `'use server'`)
- helper local `parseValor` (copiar o de `financeiro/actions.ts`) e
  `validarConta(formData)` → `{ dados, fieldErrors }`:
  nome obrigatório; valor > 0; dia inteiro 1–31; se anual, mês 1–12 (senão `null`);
  categoria vazia → `'Outros'`; observação vazia → `null`.
- `getContasFixas(): Promise<ContaFixa[]>` — coleção inteira ordenada por `nome`
  (índice de campo único); `try/catch` → `[]` como o `getTransacoes`.
- `getPagamentosContasFixas(mes, contaIds): Promise<PagamentoContaFixa[]>` —
  `contaIds.length === 0` → `[]`; senão `adminDb.getAll(...refs)` com
  `idLancamentoContaFixa(id, mes)`; devolve só os `exists`.
- `createContaFixa(formData)` — grava com `ativa: true`, `mesInicio: mesAtual()`,
  `created_by: user.uid`, datas ISO.
- `updateContaFixa(id, formData)` — `update()` só dos campos editáveis (não
  mexe em `mesInicio`/`ativa`).
- `setContaFixaAtiva(id, ativa)`; `deleteContaFixa(id)` (só o doc da conta).
- `marcarContaFixaPaga(contaId, mes, formData)` — valida `ehMesValido(mes)`,
  valor > 0, `data` casando `/^\d{4}-\d{2}-\d{2}$/`; lê a conta (não existe →
  erro); `docRef.create({...})` conforme o spec; captura código 6
  (`ALREADY_EXISTS`) → `'Esta conta já foi marcada como paga neste mês.'`.
- Todas: gate no início, `revalidatePath('/dashboard/financeiro')` no sucesso.
- Desfazer: **sem action nova** — cliente usa `deleteTransacao(idLancamentoContaFixa(...))`.

_Commit 3: `feat(contas-fixas): server actions de cadastro e pagamento`_

## Passo 4 — page.tsx e abas no FinanceiroClient

**`page.tsx`**
- `searchParams: Promise<{ mes?: string | string[]; aba?: string | string[] }>`.
- `aba = abaBruta === 'contas-fixas' ? 'contas-fixas' : 'lancamentos'`.
- Mantém `getTransacoes(mes)` + `getIntervaloDeMeses()` sempre; se aba for
  contas fixas, `contas = await getContasFixas()` e
  `pagamentos = await getPagamentosContasFixas(mes, contas.map(c => c.id))`.
- Passa `aba`, `contasFixas`, `pagamentosContasFixas` ao `FinanceiroClient`.

**`FinanceiroClient.tsx`** (mudança mínima)
- Props novas; helper `urlDoFinanceiro({ mes, aba })` que monta a query
  omitindo `mes` quando é o mês corrente e `aba` quando é `lancamentos`.
  `irParaMes` passa a usá-lo (preserva `?aba=`).
- Abaixo do header, barra de abas **Lançamentos | Contas fixas** (dois botões
  estilo pill, como os filtros `todos/receita/despesa`), que fazem
  `router.push(urlDoFinanceiro({ mes, aba }))` dentro de `iniciarNavegacao`.
- Botão "Novo Lançamento" só na aba Lançamentos; o texto à direita do seletor
  de mês mostra "N contas em mmm/aaaa" na aba Contas fixas.
- Cards + tabela + modais atuais só renderizam na aba Lançamentos; na outra,
  `<ContasFixasClient contas=… pagamentos=… mes=… navegando=… />`.
- A virada automática (`router.refresh()`) não muda.

_Commit 4: `feat(contas-fixas): aba Contas fixas no Financeiro`_ (junto com o Passo 5,
para o build não quebrar por import inexistente)

## Passo 5 — ContasFixasClient

**`app/dashboard/financeiro/contasFixas/ContasFixasClient.tsx`** (novo, `'use client'`)
- `const itens = useMemo(() => contasDoMes(contas, pagamentos, mes, hojeNoFuso()), …)`.
- 3 cards (Total previsto / Pago / Em aberto) no padrão visual dos cards atuais.
- **Lista do mês** (tabela em `sm:`+, cards empilhados no mobile): nome,
  categoria, vencimento (`dd/mm`), valor (pago ou previsto), selo:
  Paga (emerald) · A vencer (neutral) · Vence hoje (amber) · Vencida (rose).
  Ação: "Marcar como paga" / "Desfazer". `EmptyState` quando vazia.
- **Modal pagar** (`Modal`): valor (`moneyFromNumber(conta.valor)`, máscara
  intuitiva) + data (`<Input type="date">`, default `hojeNoFuso()`), →
  `marcarContaFixaPaga`; toast + `router.refresh()`.
- **Desfazer**: `ConfirmDialog` tone danger ("O lançamento de R$ X em dd/mm será
  removido do Financeiro") → `deleteTransacao(transacaoId)`; toast + refresh.
- **Contas cadastradas**: lista de todas (inativas com `opacity-60` + selo
  "Inativa"), mostrando periodicidade ("Todo dia 10" / "Anual — 31/03") e valor.
  Botões: Nova conta, editar, ativar/desativar, excluir (`ConfirmDialog` avisando
  que lançamentos já gerados permanecem).
- **Modal conta**: nome*, categoria, valor previsto*, periodicidade (Select),
  dia de vencimento* (number 1–31), mês de vencimento* (Select jan–dez, só se
  anual), observação. `fieldErrors` exibidos nos `Input` (prop `error`, conferir
  a API do `Input`).
- Estado de envio: `submitting` desabilita botões, como no FinanceiroClient.

_Commit 4 (continuação)_

## Passo 6 — Changelog

`constants/changelog.ts`, no topo:
```ts
{
  id: '2026-09-27-contas-fixas',
  date: '2026-09-27',
  title: 'Contas fixas no Financeiro',
  tag: 'novo',
  items: [
    'Nova aba "Contas fixas" dentro do Financeiro para cadastrar aluguel, luz, internet e outras contas que se repetem (mensais ou anuais).',
    'Veja no mês o que já foi pago, o que vence hoje e o que está vencido.',
    'Ao marcar uma conta como paga, a despesa entra automaticamente nos lançamentos do mês.',
  ],
},
```

_Commit 5: `docs(changelog): contas fixas no financeiro`_

## Passo 7 — Verificação

1. `npm install` na worktree (se `node_modules` não existir) · `npm run lint` · `npm run build`.
2. Dev server manual na worktree (`preview_start` fica preso à pasta principal —
   ver memória `worktree-env-local`) + `navigate` no browser pane.
3. Rodar os testes manuais 1–7 do spec (exige login: pedir ao Gustavo para
   logar no browser pane, ou ele testa). Mobile a 375px.
4. `git push -u origin feat/contas-fixas` + `gh pr create` (sem merge).
