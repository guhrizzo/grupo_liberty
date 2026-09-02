# Categorias de contrato

**Data:** 2026-09-01
**Status:** aprovado (design)

## Problema

Os contratos (PDFs) anexados aos veículos hoje não têm classificação. Não dá para
saber de que tipo é cada contrato (venda financiada, locação, CRLV etc.) nem
filtrar a listagem por tipo.

## Objetivo

- Toda vez que um contrato é anexado, o usuário **obrigatoriamente** escolhe o
  tipo do contrato.
- Existe um conjunto de **6 tipos fixos**, sempre disponíveis, que não podem ser
  renomeados nem apagados:
  - Prestação de Serviço
  - Venda de veículo financiado
  - Locação de veículo
  - Locação com venda de veículo
  - Financiamento do cliente
  - CRLV
- Uma opção **"Outros"** permite ao **admin** criar uma categoria nova, com o nome
  que quiser, que passa a ficar disponível para os próximos uploads (reutilizável).
- A tela de Gestão de Contratos mostra a categoria de cada contrato e permite
  **filtrar por categoria**.
- Contratos já anexados (sem categoria) podem ter a categoria definida depois.

## Não-objetivos (fora de escopo)

- Migração em massa dos contratos existentes (ficam como "Sem categoria" até
  alguém editar).
- Novo índice composto no Firestore (o filtro é client-side; a listagem já vem
  inteira).
- Exibir/filtrar categoria na aba Jurídico.
- Agrupar a listagem por categoria (continua agrupada por veículo).
- Categoria como campo de contratos "gerados" (`criarContrato` segue desativado).
- Controle de permissão fino para editar a categoria de um contrato (qualquer um
  com acesso a contratos pode).

## Decisões de design

| Questão | Decisão |
|---|---|
| Persistência das categorias | Nova coleção `contrato_categorias` no Firestore |
| Categorias fixas | 6, semeadas automaticamente (lazy) na 1ª leitura; `fixa: true` |
| Categorias custom ("Outros") | Mesma coleção, `fixa: false` |
| Obrigatoriedade | Categoria obrigatória nos **dois** locais de upload |
| Quem cria categoria nova | Só **admin** (role `admin`) |
| Quem escolhe categoria no upload | Qualquer um com acesso a contratos (`assertPodeGerarContratos`) |
| Quem edita a categoria de um contrato | Qualquer um com acesso a contratos |
| Gestão de categorias (renomear/apagar) | Modal "Categorias" dentro da tela de Contratos, só admin |
| Renomear categoria | Só custom; faz cascade update do `categoriaNome` nos contratos que a usam |
| Apagar categoria | Só custom; **bloqueado** se houver contrato usando (mostra a contagem) |
| Nome desnormalizado no contrato | Sim (`categoriaNome`) para exibir sem join |
| Contratos antigos | `categoriaId`/`categoriaNome` = `null` → badge "Sem categoria" (âmbar) |

## Modelo de dados

### Coleção `contrato_categorias`

```ts
interface ContratoCategoria {
  id: string
  nome: string          // "Locação de veículo", "Consórcio", ...
  slug: string           // "locacao-de-veiculo" — normalizado, único
  fixa: boolean          // true para as 6 do sistema
  ordem: number          // ordena as fixas; custom usam ordem alta + nome
  criadoPorUid: string | null   // null para as fixas semeadas
  criadoEm: string       // ISO
}
```

**Semente lazy:** `listarCategoriasContrato()` verifica se cada um dos 6 slugs
fixos existe; cria os que faltarem numa `batch` antes de retornar. Slugs fixos:

| slug | nome | ordem |
|---|---|---|
| `prestacao-de-servico` | Prestação de Serviço | 1 |
| `venda-de-veiculo-financiado` | Venda de veículo financiado | 2 |
| `locacao-de-veiculo` | Locação de veículo | 3 |
| `locacao-com-venda-de-veiculo` | Locação com venda de veículo | 4 |
| `financiamento-do-cliente` | Financiamento do cliente | 5 |
| `crlv` | CRLV | 6 |

Ordenação de retorno: fixas primeiro por `ordem`, depois custom por `nome`
(locale pt-BR, case-insensitive).

`slug` = nome em minúsculas, sem acento, não-alfanumérico → `-`, colapsa `-`
repetidos, remove das pontas. Usado para dedupe de categorias custom.

### Coleção `veiculo_contratos` (campos adicionados)

```ts
interface VeiculoContrato {
  // ...campos atuais...
  categoriaId: string | null      // null = contrato antigo sem categoria
  categoriaNome: string | null    // desnormalizado
}
```

`serializeVeiculoContrato` passa a devolver `categoriaId ?? null` e
`categoriaNome ?? null`.

## Server actions

Novo arquivo `app/dashboard/contratos/categorias.actions.ts` (`'use server'`).
Helper `assertAdminContratos()` local: reaproveita `getSessionUser()` +
checagem `role === 'admin'` (mesmo padrão do `assertAdmin` em
`app/dashboard/juridico/actions.ts`).

| Action | Gate | Comportamento |
|---|---|---|
| `listarCategoriasContrato(): Promise<ContratoCategoria[]>` | `assertPodeGerarContratos` (retorna `[]` se sem acesso) | semeia fixas faltantes; retorna ordenado |
| `criarCategoriaContrato(nome: string): Promise<{ categoria?; error? }>` | admin | valida nome (2–60 chars); calcula slug; erro se slug já existe (fixa ou custom); cria com `fixa: false`, `ordem: 1000`, `criadoPorUid` |
| `renomearCategoriaContrato(id, nome): Promise<{ categoria?; error? }>` | admin | erro se `fixa`; recalcula slug; erro se colide com outro; `update` na categoria + `batch` update de `categoriaNome` em todos os `veiculo_contratos` com aquele `categoriaId` |
| `removerCategoriaContrato(id): Promise<{ success?; error? }>` | admin | erro se `fixa`; conta `veiculo_contratos` com `categoriaId == id`; se > 0, erro `"N contrato(s) usam esta categoria. Altere-os antes de apagar."`; senão `delete` |
| `definirCategoriaContrato(contratoId, categoriaId): Promise<{ success?; error? }>` | `assertPodeGerarContratos` | valida contrato e categoria; `update` `{ categoriaId, categoriaNome }`; `revalidatePath('/dashboard/contratos')` e `/veiculos/[id]` |

### `anexarContratoVeiculoAction` (alteração)

- Lê `categoriaId` do `FormData` (`sanitizeString`).
- Se vazio → `{ error: 'Selecione o tipo de contrato.' }`.
- Busca a categoria; se não existir → `{ error: 'Categoria inválida.' }`.
- Grava `categoriaId` e `categoriaNome` no doc `veiculo_contratos`.
- `VeiculoContratoResponse.contrato` passa a incluir os dois campos.

## UI

### `app/dashboard/contratos/page.tsx`

- `const categorias = await listarCategoriasContrato()`.
- Passa `categorias` e `isAdmin` (`session.role === 'admin'`) ao `ContratosClient`.
- No map `veiculoContratos → contratos`, incluir `categoriaId` e `categoriaNome`.

### Type `Contrato` (`app/dashboard/contratos/types.ts`)

Adicionar `categoriaId: string | null` e `categoriaNome: string | null`.
Exportar também `ContratoCategoria` e as constantes das categorias fixas
(`CATEGORIAS_FIXAS: { slug; nome; ordem }[]`) — arquivo é só tipos/constantes,
pode ser importado por client e server.

### `ContratosClient.tsx`

**Props novas:** `categorias: ContratoCategoria[]`, `isAdmin: boolean`.
Estado `categorias` local (para refletir criações no modal de gestão).

**Modal "Anexar Contrato":**
- Novo `<Select label="Tipo de contrato *" required>` com as categorias.
- Última opção, só para admin: `"+ Outros (nova categoria)"`. Ao selecioná-la,
  mostra `<Input>` "Nome da nova categoria". No submit: se for "Outros", chama
  `criarCategoriaContrato(nome)`, usa o `id` retornado como `categoriaId`; em
  erro, aborta o upload com toast.
- `handleAnexarSubmit` valida `categoriaId` antes de chamar a action.
- Ao anexar com sucesso, o objeto `Contrato` otimista inclui
  `categoriaId`/`categoriaNome` de `res.contrato`.

**Modal "Ver Contratos":**
- Nova coluna "Tipo": badge com `c.categoriaNome`, ou badge âmbar
  "Sem categoria" quando `null`.
- Abaixo do badge, `<Select>` inline (todas as categorias, sem a opção "Outros")
  que chama `definirCategoriaContrato(c.id, novaCategoriaId)` e atualiza o estado
  local em caso de sucesso. Disponível para qualquer usuário da tela.

**Barra de filtros:**
- Novo `<Select>` "Todas as categorias" + uma opção por categoria + opção
  "Sem categoria". Filtra os grupos: um grupo aparece se **algum** contrato dele
  casa com a categoria escolhida (mesma lógica do filtro de veículo, combinada
  por AND).

**Botão "Categorias" (só admin):** abre um `Modal` com:
- Lista das categorias. Fixas: rótulo "Padrão", sem ações.
  Custom: botão renomear (troca para `<Input>` inline) e botão apagar
  (`ConfirmDialog`; mostra o erro da action se estiver em uso).
- Campo "Nova categoria" + botão adicionar → `criarCategoriaContrato`.
- Sucesso/erro via toast; estado local de `categorias` atualizado.

### `VeiculosClient.tsx`

- `novosContratos` passa a ser
  `{ file; descricao; enviarJuridico; categoriaId: string }[]`
  (`categoriaId` inicial `''`).
- Carregar categorias: `useEffect` que chama `listarCategoriasContrato()` quando
  o modal de veículo abre (uma vez), guardado em estado `categoriasContrato`.
  Sem opção "Outros" aqui (criação de categoria fica na tela de Contratos).
- Cada item da lista de novos contratos ganha um `<Select>` "Tipo de contrato *".
- Antes de fazer os uploads (`handleSubmit`), se algum `novosContratos[i].categoriaId`
  estiver vazio → `toast.error('Escolha o tipo de cada contrato anexado.')` e
  aborta o salvamento dos contratos (o veículo em si segue o fluxo normal).
- No `FormData` de cada upload: `fd.set('categoriaId', categoriaId)`.

## Fluxo de dados

```
listarCategoriasContrato ──(page.tsx)──> ContratosClient ─┬─> Select do modal Anexar
                                                          ├─> Select inline (Ver Contratos)
                                                          ├─> Select de filtro
                                                          └─> Modal "Categorias" (CRUD, admin)

listarCategoriasContrato ──(useEffect)──> VeiculosClient ──> Select por PDF novo

Upload:  Select ─categoriaId─> anexarContratoVeiculoAction ─> veiculo_contratos
                                { categoriaId, categoriaNome }

Editar:  Select inline ─> definirCategoriaContrato ─> veiculo_contratos.update

Renomear categoria custom ─> renomearCategoriaContrato ─> batch update categoriaNome
Apagar categoria custom   ─> removerCategoriaContrato   ─> bloqueia se em uso
```

## Tratamento de erros

| Situação | Comportamento |
|---|---|
| Upload sem categoria | Action retorna erro; UI já bloqueia antes |
| `categoriaId` inexistente no upload | `{ error: 'Categoria inválida.' }` |
| Criar categoria com nome duplicado (slug igual) | `{ error: 'Já existe uma categoria com esse nome.' }` |
| Criar/renomear sem ser admin | `{ error: 'Acesso negado...' }` |
| Renomear/apagar categoria fixa | `{ error: 'As categorias padrão não podem ser alteradas.' }` |
| Apagar categoria em uso | `{ error: 'N contrato(s) usam esta categoria...' }` |
| Semente lazy falha (Firestore) | `listarCategoriasContrato` loga e retorna o que conseguiu ler |
| Contrato antigo sem categoria | Exibido como "Sem categoria"; editável pelo Select inline |

## Testes

Sem framework de teste automatizado no projeto — validação manual:

1. Subir contrato pela tela de Contratos sem escolher tipo → bloqueado.
2. Subir escolhendo cada um dos 6 tipos fixos → badge correto na listagem.
3. Como admin, "Outros" → criar "Consórcio" → categoria aparece no Select e no
   modal de gestão.
4. Como não-admin, o Select de upload **não** mostra "Outros".
5. Subir 2 PDFs no modal de veículo, um sem tipo → salvamento dos contratos
   bloqueado com toast.
6. Editar a categoria de um contrato antigo pelo Select inline → persiste.
7. Filtrar a listagem por "CRLV" e por "Sem categoria".
8. Renomear "Consórcio" → "Consórcio de veículo": contratos que a usavam mostram
   o novo nome.
9. Apagar "Consórcio de veículo" com contrato usando → bloqueado com contagem;
   remover a categoria dos contratos e apagar de novo → ok.
10. Semente: apagar manualmente um doc fixo no Firestore e recarregar a tela →
    recriado.
