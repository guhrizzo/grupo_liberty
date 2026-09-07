# Custo efetivo total do veículo

**Data:** 2026-09-06
**Status:** aprovado (design)

## Problema

No cadastro/edição de veículo já existem os **Débitos do Veículo** (itens marcados
com valor, ou texto livre) e o **Preço de Aquisição**. Hoje esses valores ficam
soltos — não há em lugar nenhum a soma "quanto esse veículo custou de verdade".

## Objetivo

- Adicionar um bloco **"Custo efetivo total"** no formulário de veículo (cadastro e
  edição), logo abaixo de Preço de Aquisição.
- O valor é a soma de **total de débitos + preço de aquisição**.
- Mostra o detalhamento (débitos, preço de aquisição, total) e recalcula em tempo
  real conforme o usuário mexe nos débitos / preço.
- Persistir o total no registro do veículo (`custoEfetivoTotal`), calculado no
  servidor a partir dos mesmos campos — uso interno.

## Não-objetivos (fora de escopo)

- Aparecer em propostas, PDF, no site público ou na listagem de veículos.
- Entrar em qualquer cálculo de financiamento / projeção de quitação.
- Incluir "Custo acumulado" do financiamento ou qualquer outro campo na soma.
- Índice/consulta nova no Firestore.
- Campo editável manualmente — é sempre derivado.

## Decisões de design

| Questão | Decisão |
|---|---|
| Composição | `totalDébitos + preçoAquisição` |
| Total de débitos | itens marcados → soma dos itens; senão → `debitos` (manual) |
| Persistência | Campo `custoEfetivoTotal: number \| null` no doc do veículo |
| Fonte da verdade | Recalculado no servidor no create/update; cliente só exibe |
| Zero | `custoEfetivoTotal` = `null` quando a soma dá 0 (nada preenchido) |
| Editável | Não — read-only, derivado |
| Visibilidade | Só no formulário interno; não sai em proposta/PDF/site/listagem |

## Modelo de dados

### Doc de veículo (campo adicionado)

```ts
interface Veiculo {
  // ...
  precoAquisicao: number | null
  /** Soma interna: total de débitos + preço de aquisição. Derivado — não editável. */
  custoEfetivoTotal: number | null
}
```

`getVehicles` devolve `data.custoEfetivoTotal ?? null`.

## Server actions (`app/dashboard/veiculos/actions.ts`)

`createVehicle` e `updateVehicle`, após já terem `debitos` e `precoAquisicao`
resolvidos:

```ts
const custoEfetivoTotal = (debitos ?? 0) + (precoAquisicao ?? 0) || null
```

Gravado no payload do Firestore junto com `precoAquisicao`. Sem validação própria
(os componentes já validam débitos e preço).

## UI (`app/dashboard/veiculos/VeiculosClient.tsx`)

Derivados novos (perto de `debitosTotalCalculado`):

```ts
const debitosParaCusto =
  debitosItensSelecionados.length > 0 ? debitosTotalCalculado : parseMoney(debitos) || 0
const precoAquisicaoNum = parseMoney(precoAquisicao) || 0
const custoEfetivoTotal = debitosParaCusto + precoAquisicaoNum
```

Bloco novo depois de "Preço de Aquisição":

- Título `Custo efetivo total`.
- Linhas de detalhamento: `Débitos do veículo` → `formatCurrency(debitosParaCusto)`,
  `Preço de aquisição` → `formatCurrency(precoAquisicaoNum)`.
- Linha de total destacada: `formatCurrency(custoEfetivoTotal)`.
- Nota `[10px]`: "Soma automática de débitos + preço de aquisição. Uso interno —
  não aparece em propostas, PDF nem no site."

Nenhum estado novo, nenhum campo no `FormData` (o servidor recalcula). O reset e o
preenchimento na edição não precisam mexer nada (é tudo derivado).

## Débito novo: "Translado"

Adicionar em `constants/DEBITOS` (antes de `outros`):

```ts
{ chave: 'translado', label: 'Translado', labelPdf: 'Translado',
  descricao: 'Custo para transportar o veículo — ex.: gasolina para buscar o veículo.' }
```

Entra no total de débitos como qualquer outro item — portanto também no
"Custo efetivo total". Como os demais débitos, pode ser incluído numa proposta/PDF
se selecionado lá.

## Manutenções no custo efetivo total (adendo 2026-09-07)

Cada manutenção do veículo também entra no "Custo efetivo total".

| Questão | Decisão |
|---|---|
| Rótulo da linha | `Manutenção — <tipo>` (campo `tipo` da manutenção) |
| Quais entram | Todas com `status !== 'cancelada'` (agendada, em execução, concluída) |
| Valor | Campo `custo` da manutenção (já embute o total de peças quando usado) |
| Fonte no form | `listarManutencoesVeiculo(veiculoId)` — carregada sob demanda no `handleEdit`, só na edição |
| Persistência | `custoEfetivoTotal` no doc do veículo passa a incluir a soma das manutenções |
| Quando recalcula o valor gravado | Ao salvar o veículo **e** ao criar / editar / remover uma manutenção |

### `listarManutencoesVeiculo(veiculoId)` (`app/dashboard/manutencao/actions.ts`)

Leitura sem gate de admin (mesma postura de `getManutencoes`). Retorna
`Array<{ id; tipo; custo }>` das manutenções não canceladas do veículo.

### `recalcularCustoEfetivoTotal(veiculoId)` (`app/dashboard/veiculos/actions.ts`)

Helper exportado. Lê `debitos` + `precoAquisicao` do doc do veículo, soma o `custo`
das manutenções não canceladas daquele `veiculoId` e grava
`custoEfetivoTotal = base + manutenções || null`. Falha em silêncio (loga).

Chamado por:
- `updateVehicle` — depois do `update`, para dobrar as manutenções sobre o valor
  base já gravado.
- `createManutencao` / `updateManutencao` / `deleteManutencao` — para o valor
  gravado no veículo não ficar defasado. `updateManutencao` recalcula também o
  `veiculoId` anterior quando a manutenção troca de veículo.

Essas actions de manutenção passam a chamar também
`revalidatePath('/dashboard/veiculos')`.

## Changelog

Entrada nova no topo de `constants/changelog.ts`:

```ts
{
  id: '2026-09-06-custo-efetivo-total-veiculo',
  date: '2026-09-06',
  title: 'Custo efetivo total do veículo',
  tag: 'melhoria',
  items: [
    'O formulário de veículo agora mostra o "Custo efetivo total" — soma dos débitos do veículo com o preço de aquisição.',
    'É um valor interno de controle de custo, calculado automaticamente; não aparece em propostas, PDF nem no site.',
  ],
}
```

## Testes (manual — sem framework no projeto)

1. Novo veículo, marcar 2 itens de débito (100 + 50) e preço de aquisição 1.000 →
   bloco mostra Débitos 150, Preço 1.000, Total 1.150; recalcula ao editar.
2. Sem itens marcados, débito manual "300" + preço 700 → Total 1.000.
3. Nada preenchido → Total R$ 0,00; `custoEfetivoTotal` salvo como `null`.
4. Salvar e reabrir na edição → bloco reflete os valores; conferir doc no Firestore.
5. Conferir que veículo/proposta/PDF/site não exibem o campo.
6. `npm run lint` + `npm run build` limpos.
