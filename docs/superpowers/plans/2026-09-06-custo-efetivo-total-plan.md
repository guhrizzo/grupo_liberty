# Plano de implementação — Custo efetivo total do veículo

**Spec:** `docs/superpowers/specs/2026-09-06-custo-efetivo-total-design.md`
**Branch:** `feat/custo-efetivo-total`
**Data:** 2026-09-06

Verificação: `npm run lint` + `npm run build`. Sem merge na master sem "ok".

## Passo 1 — Servidor (`app/dashboard/veiculos/actions.ts`)

1. `interface Veiculo`: adicionar após `precoAquisicao`:
   ```ts
   /** Soma interna: total de débitos + preço de aquisição. Derivado — não editável. */
   custoEfetivoTotal: number | null
   ```
2. `getVehicles`: no objeto mapeado, após `precoAquisicao`, adicionar
   `custoEfetivoTotal: data.custoEfetivoTotal ?? null`.
3. `createVehicle`: depois de `debitos` e `precoAquisicao` estarem resolvidos
   (após a const `debitos`), adicionar:
   ```ts
   const custoEfetivoTotal = (debitos ?? 0) + (precoAquisicao ?? 0) || null
   ```
   e incluir `custoEfetivoTotal` no payload gravado (junto de `precoAquisicao`).
4. `updateVehicle`: idem passo 3.

Sem `VeiculoFieldErrors` novo (campo derivado, sem validação).

## Passo 2 — UI (`app/dashboard/veiculos/VeiculosClient.tsx`)

1. Perto de `debitosTotalCalculado` (após a definição dele), adicionar:
   ```ts
   const debitosParaCusto =
     debitosItensSelecionados.length > 0
       ? debitosTotalCalculado
       : parseMoney(debitos) || 0
   const precoAquisicaoNum = parseMoney(precoAquisicao) || 0
   const custoEfetivoTotal = debitosParaCusto + precoAquisicaoNum
   ```
2. Logo após o bloco `{/* ─── Preço de Aquisição ─── */}` (fecha em ~L1682),
   inserir bloco novo `{/* ─── Custo efetivo total ─── */}`:
   - `<h3>` "Custo efetivo total" (mesma classe dos outros títulos de seção).
   - Card com 2 linhas de detalhe (label à esquerda, `formatCurrency` à direita):
     "Débitos do veículo" → `debitosParaCusto`; "Preço de aquisição" → `precoAquisicaoNum`.
   - Divisória + linha "Custo efetivo total" em destaque → `formatCurrency(custoEfetivoTotal)`.
   - `<p className="mt-2 text-[10px] text-neutral-500">` com a nota de uso interno.
3. Nenhum `useState` novo, nenhum `formData.append`, nada no reset nem no
   preenchimento de edição.

## Passo 2b — Débito "Translado" (`constants/debitos.ts`)

Adicionar item `{ chave: 'translado', label: 'Translado', labelPdf: 'Translado',
descricao: '...' }` no array `DEBITOS`, imediatamente antes de `outros`. Sem outra
mudança — o restante do fluxo de débitos já é genérico sobre `DEBITOS`.

## Passo 3 — Changelog (`constants/changelog.ts`)

Nova entrada no topo do array (id `2026-09-06-custo-efetivo-total-veiculo`,
tag `melhoria`), conforme spec.

## Passo 4 — Verificação

- `npm run lint`
- `npm run build`
- Teste manual: cenários 1–5 do spec.

## Passo 5 — Commit

Um commit só: `feat(veiculos): bloco Custo efetivo total` com spec + plano +
código + changelog. Parar antes do merge; aguardar "ok" do Gustavo.
