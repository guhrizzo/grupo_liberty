# Plano de implementação — Baixa de manutenção

**Spec:** `docs/superpowers/specs/2026-09-07-manutencao-baixa-design.md`
**Branch:** `feat/custo-efetivo-total` (continua a mesma feature)
**Data:** 2026-09-07

Verificação: `npm run lint` + `npm run build`. Sem merge na master sem "ok".

## Passo 1 — Tipos (`app/dashboard/manutencao/types.ts`)

- `ManutencaoComprovante`, `BaixaManutencao` (ver spec).
- `Manutencao`: `custo: number` (mantido), `baixa: BaixaManutencao | null`.
- `ManutencaoResponse` já serve; add `BaixaManutencaoResponse = { success?; error?; manutencao? }`.
- Helpers puros:
  ```ts
  export function isManutencaoBaixada(m) {
    return m.baixa != null || ((m.custo ?? 0) > 0 && m.status !== 'cancelada')
  }
  export function valorManutencao(m) {
    return m.baixa ? m.baixa.valor : (m.custo ?? 0)
  }
  ```

## Passo 2 — Actions (`app/dashboard/manutencao/actions.ts`)

1. `getManutencoes` / `getManutencoesPorVeiculos` / serialização: incluir
   `baixa: data.baixa ?? null` no objeto retornado.
2. `createManutencao`: parar de ler `custo` do form; gravar `custo: 0`,
   `baixa: null`.
3. `updateManutencao`: remover `custo` do objeto `atualizacao` (preserva
   legado / baixa). Não tocar `baixa`.
4. `parseCusto` — reutilizado na baixa.
5. Constantes de upload (copiar do Financeiro): `MAX_COMPROVANTE_SIZE`,
   `COMPROVANTE_TIPOS_PERMITIDOS`, `sanitizeFileName`, `extensaoPorTipo`.
6. `darBaixaManutencao(formData)`:
   - `assertAdmin`; `manutencaoId`, `valor = parseCusto`, erro se `<= 0`.
   - `doc.get()`; erro se não existe; erro se `doc.data().baixa` já setado.
   - arquivo opcional (`formData.get('arquivo')`): valida, `bucket.file(...).save(buffer)`,
     path `manutencoes/<id>/comprovante_<Date.now()>.<ext>`.
   - monta `BaixaManutencao`; `update({ baixa, custo: valor, status: 'concluida',
     dataConclusao: dataAtual || hojeYYYYMMDD, updated_at })`.
   - `recalcularCustoEfetivoTotal(veiculoId)`; revalida `/dashboard/manutencao`
     e `/dashboard/veiculos`.
7. `estornarBaixaManutencao(id)`:
   - `assertAdmin`; erro se sem `baixa`.
   - apaga `baixa.comprovante.storagePath` do Storage (try/catch).
   - `update({ baixa: null, custo: 0, updated_at })`.
   - recalc + revalida.
8. `deleteManutencao`: antes do `delete`, se `data.baixa?.comprovante?.storagePath`,
   apaga do Storage (try/catch). (Mantém o recalc já existente.)
9. `listarManutencoesVeiculo`: filtrar `isManutencaoBaixada`; devolver
   `{ id, tipo, custo: valorManutencao(m) }`.

## Passo 3 — `recalcularCustoEfetivoTotal` (`app/dashboard/veiculos/actions.ts`)

Trocar o loop: pula `cancelada`; `const baixa = md.baixa`;
`const valor = baixa ? Number(baixa.valor)||0 : Number(md.custo)||0`;
`const baixada = !!baixa || (Number(md.custo)||0) > 0`;
`if (baixada && valor > 0) manutencoes += valor`.

## Passo 4 — Rota de comprovante

`app/api/manutencao/[id]/comprovante/route.ts` — copiar
`app/api/financeiro/[id]/comprovante/route.ts`, trocar coleção para
`manutencoes`, ler `data.baixa?.comprovante`, gate
`hasPageAccess(user, 'manutencao', ['admin','vendedor','suporte'])`.

## Passo 5 — UI

### `ManutencaoClient.tsx`
- Remover Input `custo` + estado `custo`; `openEdit`/`openCreate`/`closeForm`
  sem `setCusto`. `ConsertoPecasModal.onConfirm` só `setPecasState(pecas)`.
- Import helpers `isManutencaoBaixada`, `valorManutencao`.
- Estado `baixaDe: Manutencao | null`, `confirmEstorno: Manutencao | null`.
- Tabela: coluna "Valor da baixa"; ações condicionais (Dar baixa / Comprovante +
  Estornar).
- Cards: "Custo (filtrado)" = soma `valorManutencao` das baixadas filtradas;
  novo card "Aguardando baixa".
- `handleEstorno` → `estornarBaixaManutencao` + `router.refresh()`.
- Render `<BaixaManutencaoModal manutencao={baixaDe} .../>`.

### `BaixaManutencaoModal.tsx` (novo)
- `'use client'`; `Modal` + `Input` (maskMoney) + `<input type=file hidden>` +
  `useTransition`. Submit monta `FormData` (`manutencaoId`, `valor`, `arquivo?`)
  → `darBaixaManutencao`. `onDone()` → `router.refresh()` no pai.

## Passo 6 — Changelog

`constants/changelog.ts`: entrada nova no topo, `id '2026-09-07-baixa-manutencao'`.

## Passo 7 — Verificação

`npm run lint` (contagem de problemas não pode subir vs. baseline) + `npm run build`.
Testes manuais 1–8 do spec.

## Passo 8 — Commit

Um commit: `feat(manutencao): baixa com valor e comprovante`. Spec + plano +
código + changelog. Parar antes do merge.
