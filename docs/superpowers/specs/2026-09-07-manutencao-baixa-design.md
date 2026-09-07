# Baixa de manutenção (valor + comprovante na conclusão)

**Data:** 2026-09-07
**Status:** aprovado (design)
**Relacionado:** [[2026-09-06-custo-efetivo-total-design]]

## Problema

Hoje a manutenção é cadastrada já com o `custo`. Na prática o valor só é conhecido
quando o serviço termina e chega a nota/recibo. E o "Custo efetivo total" do
veículo (spec anterior) está somando manutenções que ainda nem foram pagas.

## Objetivo

- **Cadastro de manutenção sem valor.** Só os dados do serviço (veículo, tipo,
  oficina, responsável, datas, descrição, peças planejadas). Nenhum campo de R$.
- **"Dar baixa" na manutenção** quando o serviço é concluído: o usuário informa
  **o valor** (obrigatório) e, opcionalmente, anexa **um comprovante** (PDF ou
  imagem — nota fiscal / recibo).
- A baixa marca a manutenção como **Concluída** e preenche a data de conclusão
  (se estiver vazia).
- **Só manutenção com baixa entra no "Custo efetivo total"** do veículo, como
  hoje: uma linha `Manutenção — <tipo>` com o valor da baixa.
- **Estornar baixa** (admin): remove o valor e o comprovante, tira a manutenção
  do custo efetivo total.

## Não-objetivos

- Fluxo de aprovação/orçamento antes da baixa.
- Múltiplos comprovantes por manutenção (é um só; reanexar substitui).
- Baixa parcial / pagamento em parcelas.
- Mudar o vínculo da manutenção com o módulo Financeiro (não há hoje).
- Histórico de estornos.

## Compatibilidade com manutenções já existentes

Manutenções antigas têm `custo` preenchido e nenhum objeto `baixa`. Regra:

> Uma manutenção conta como **baixada** quando `baixa != null` **ou**
> (`custo > 0` **e** `status !== 'cancelada'`).
> O valor usado é `baixa.valor` quando há baixa, senão `custo`.

Assim nada some do "Custo efetivo total" hoje; as antigas seguem contando pelo
`custo` atual, sem comprovante.

## Modelo de dados (`app/dashboard/manutencao/types.ts`)

```ts
export interface ManutencaoComprovante {
  fileName: string
  contentType: string
  size: number
  storagePath: string
  uploadedByUid: string
  uploadedByEmail: string | null
  uploadedAt: string
}

export interface BaixaManutencao {
  valor: number
  comprovante: ManutencaoComprovante | null
  baixadoEm: string          // ISO
  baixadoPorUid: string
  baixadoPorEmail: string | null
}

export interface Manutencao {
  // ...campos atuais...
  custo: number              // espelha baixa.valor; mantido p/ retrocompat (lista, propostas)
  baixa: BaixaManutencao | null
}
```

Helpers (novos, em `types.ts`):

```ts
export function isManutencaoBaixada(m: Pick<Manutencao,'baixa'|'custo'|'status'>): boolean
export function valorManutencao(m: Pick<Manutencao,'baixa'|'custo'>): number
```

## Server actions (`app/dashboard/manutencao/actions.ts`)

### `createManutencao` / `updateManutencao` (alteração)

- **Param `custo` deixa de ser lido.** Create grava `custo: 0`, `baixa: null`.
  Update **não** inclui `custo` nem `baixa` no objeto de `update` (preserva o
  que já estiver lá — legado ou baixa feita).
- `pecasConserto` continua (peças planejadas). O bloco de peças na descrição
  continua opcional.

### `darBaixaManutencao(formData)` — novo

FormData: `manutencaoId`, `valor` (obrigatório), `arquivo` (File opcional —
`application/pdf | image/jpeg | image/png | image/webp`, máx. 10MB).

- Gate `assertAdmin`.
- `valor = parseCusto(...)`; erro se `<= 0`.
- Erro se a manutenção já tem `baixa` (estorne antes de refazer).
- Se veio arquivo: valida tipo/tamanho, sobe pra
  `manutencoes/<id>/comprovante_<ts>.<ext>` (mesmo padrão do Financeiro),
  monta `ManutencaoComprovante`.
- `update`: `{ baixa, custo: valor, status: 'concluida',
  dataConclusao: atual || hoje('YYYY-MM-DD'), updated_at }`.
- `recalcularCustoEfetivoTotal(veiculoId)`; `revalidatePath` de
  `/dashboard/manutencao` e `/dashboard/veiculos`.
- Retorna `{ success, manutencao }`.

### `estornarBaixaManutencao(id)` — novo

- Gate `assertAdmin`. Erro se não há `baixa`.
- Apaga o comprovante do Storage (best-effort).
- `update`: `{ baixa: null, custo: 0, updated_at }` (status fica como está).
- `recalcularCustoEfetivoTotal`; revalida os dois paths.

### `deleteManutencao` (alteração)

- Antes de apagar o doc, se `baixa?.comprovante?.storagePath`, apaga o arquivo
  do Storage (best-effort).

### `listarManutencoesVeiculo(veiculoId)` (alteração)

- Retorna **só as baixadas** (`isManutencaoBaixada`), com
  `{ id, tipo, custo: valorManutencao(m) }`.

### `recalcularCustoEfetivoTotal` (`veiculos/actions.ts`, alteração)

- Soma só manutenções baixadas: pula `cancelada`; usa `baixa.valor ?? custo`;
  conta quando `baixa != null || custo > 0`.

## Rota de comprovante

`app/api/manutencao/[id]/comprovante/route.ts` — GET, espelha
`app/api/financeiro/[id]/comprovante/route.ts`. Gate:
`hasPageAccess(user, 'manutencao', ['admin','vendedor','suporte'])`.
Lê `manutencoes/<id>.baixa.comprovante.storagePath`, faz `download()`,
responde `inline` com o `contentType` salvo.

## UI (`app/dashboard/manutencao/`)

### Formulário (`ManutencaoClient.tsx`)

- **Remove o Input "Custo (R$)"** e o estado `custo`.
- O modal de peças (`ConsertoPecasModal`) continua, mas o `onConfirm` **não**
  seta mais custo — só guarda `pecasState` (vai pra `pecasConserto` +
  bloco na descrição).

### Tabela

- Coluna "Custo" vira **"Valor da baixa"**: `formatCurrency(valorManutencao(m))`
  quando baixada; senão `—` cinza + selo "Aguardando baixa".
- Coluna/az de ações:
  - Não baixada → botão **"Dar baixa"** (abre `BaixaManutencaoModal`).
  - Baixada → link **"Comprovante"** (quando houver) + botão **"Estornar"**
    (com `ConfirmDialog`).
- Card "Custo (filtrado)" passa a somar `valorManutencao` só das baixadas
  filtradas. Novo card "Aguardando baixa" = contagem de não baixadas
  (exceto canceladas).

### `BaixaManutencaoModal.tsx` — novo

`Modal` com:
- Resumo da manutenção (veículo, tipo, oficina).
- `Input` "Valor pago (R$) *" com `maskMoney`.
- `<label>` de upload opcional (aceita `application/pdf,image/jpeg,image/png,image/webp`,
  máx. 10MB) — mesmo visual do `ComprovanteTransacao`.
- Botões Cancelar / "Dar baixa". Ao concluir: `toast` + `router.refresh()` +
  fecha.

## Changelog

Entrada nova no topo de `constants/changelog.ts`
(`id: '2026-09-07-baixa-manutencao'`, tag `melhoria`).

## Testes (manual)

1. Nova manutenção → não há campo de valor; salva com status Agendada.
2. "Dar baixa" sem valor → bloqueado. Com valor 320 e sem arquivo → manutenção
   vira Concluída, data de conclusão = hoje, aparece "R$ 320,00" na coluna.
3. Editar veículo dessa manutenção → linha "Manutenção — <tipo>  R$ 320,00" no
   Custo efetivo total; total confere.
4. "Dar baixa" com PDF anexado → link "Comprovante" abre o arquivo inline.
5. "Estornar" → some do custo efetivo total, arquivo some do Storage, valor zera.
6. Manutenção antiga (com `custo`, sem baixa) → continua contando no custo
   efetivo total pelo `custo` atual; mostra "R$ X" sem link de comprovante.
7. Remover manutenção baixada com comprovante → arquivo removido do Storage.
8. `npm run lint` + `npm run build` limpos (sem novos erros).
