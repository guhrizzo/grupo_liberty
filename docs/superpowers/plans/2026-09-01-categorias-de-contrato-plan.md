# Plano de implementação — Categorias de contrato

**Spec:** `docs/superpowers/specs/2026-09-01-categorias-de-contrato-design.md`
**Branch:** `feat/categorias-de-contrato`
**Data:** 2026-09-01

Verificação de cada passo: `npx tsc --noEmit` + `npm run build`; lint só nos
arquivos novos/alterados. Sem merge na master sem "ok".

## Decisões que o spec deixou em aberto

- **Tipagem dos campos novos em `VeiculoContrato`:** `categoriaId?: string | null` e
  `categoriaNome?: string | null` (opcionais). Evita mexer em todos os pontos que
  constroem o objeto (`getContratosEnviadosJuridico`, otimista do `ContratosClient`).
  `serializeVeiculoContrato` sempre devolve `?? null`.
- **Carregar categorias no `VeiculosClient`:** `useEffect` disparado quando
  `showForm && canManageContratos` fica `true`, guarda em estado, só busca 1x
  (guard por `categoriasContrato.length === 0` + flag de loading).
- **Semente lazy:** feita dentro de `listarCategoriasContrato`, com `batch`. Se
  todas as 6 fixas já existem, nenhuma escrita. Id do doc das fixas = o próprio
  `slug` (determinístico), tornando `set` concorrente idempotente.
- **Ordem das custom:** `ordem: 1000` fixo; desempate por `nome` no sort de
  retorno.
- **`revalidatePath`:** actions de categoria revalidam `/dashboard/contratos`;
  `definirCategoriaContrato` também revalida `/veiculos/${veiculoId}`.
- **Slug helper:** função local `slugifyCategoria` em `categorias.actions.ts`
  (não é reaproveitada em client).
- **Filtro por categoria + veículo:** combinados por AND (igual o filtro de
  veículo atual).
- **Select inline "Sem categoria":** a opção some da lista assim que uma
  categoria é escolhida (não dá pra "desclassificar" de volta pra null pela UI).

## Passo 1 — Tipos e constantes das categorias

**Alterado:** `app/dashboard/contratos/types.ts`
- Novo:
  ```ts
  export interface ContratoCategoria {
    id: string
    nome: string
    slug: string
    fixa: boolean
    ordem: number
    criadoPorUid: string | null
    criadoEm: string
  }

  export const CATEGORIAS_CONTRATO_FIXAS: { slug: string; nome: string; ordem: number }[] = [
    { slug: 'prestacao-de-servico', nome: 'Prestação de Serviço', ordem: 1 },
    { slug: 'venda-de-veiculo-financiado', nome: 'Venda de veículo financiado', ordem: 2 },
    { slug: 'locacao-de-veiculo', nome: 'Locação de veículo', ordem: 3 },
    { slug: 'locacao-com-venda-de-veiculo', nome: 'Locação com venda de veículo', ordem: 4 },
    { slug: 'financiamento-do-cliente', nome: 'Financiamento do cliente', ordem: 5 },
    { slug: 'crlv', nome: 'CRLV', ordem: 6 },
  ]
  ```
- No `interface Contrato`: adicionar `categoriaId: string | null` e
  `categoriaNome: string | null`.

**Verificação:** `npx tsc --noEmit`.

## Passo 2 — Campos em `VeiculoContrato` + serialização

**Alterado:** `app/veiculos/[id]/actions.ts`
- `interface VeiculoContrato`: adicionar
  ```ts
  categoriaId?: string | null
  categoriaNome?: string | null
  ```
- `serializeVeiculoContrato`: adicionar
  `categoriaId: data.categoriaId ?? null`, `categoriaNome: data.categoriaNome ?? null`.

**Verificação:** `npx tsc --noEmit`.

## Passo 3 — Server actions das categorias

**Novo:** `app/dashboard/contratos/categorias.actions.ts` (`'use server'`)

Imports: `revalidatePath`, `adminDb` de `@/utils/firebase/admin`,
`assertPodeGerarContratos` e `getSessionUser` de `@/utils/permissions`,
`ContratoCategoria` + `CATEGORIAS_CONTRATO_FIXAS` de `./types`.

Helpers locais:
- `slugifyCategoria(nome: string): string` — `normalize('NFD')`, remove
  diacríticos, `toLowerCase()`, troca `[^a-z0-9]+` por `-`, `trim('-')`.
- `async function assertAdmin()` — `getSessionUser()`; se `!user` → throw
  `'Não autenticado.'`; checa `user.role === 'admin'` OU
  `profiles/{uid}.role === 'admin'` (mesmo padrão de
  `app/dashboard/juridico/actions.ts`); senão throw
  `'Acesso negado. Apenas administradores podem gerenciar categorias.'`.
- `serializeCategoria(id, data): ContratoCategoria`.
- `ordenarCategorias(lista)` — fixas (`fixa === true`) por `ordem` asc, depois
  as demais por `nome.localeCompare(pt-BR, { sensitivity: 'base' })`.

| Action | Gate | Corpo |
|---|---|---|
| `listarCategoriasContrato(): Promise<ContratoCategoria[]>` | `assertPodeGerarContratos` (try/catch → `[]`) | `snapshot = collection('contrato_categorias').get()`. Monta `Set` dos slugs presentes. `faltantes = CATEGORIAS_CONTRATO_FIXAS.filter(f => !slugs.has(f.slug))`. Se `faltantes.length`, `batch`: para cada, `doc(f.slug)` (id = slug) com `{ nome, slug, fixa: true, ordem, criadoPorUid: null, criadoEm: now }`; `commit()`; relê ou concatena em memória. Retorna `ordenarCategorias(...)`. try/catch externo → `console.error` + retorna o que leu. |
| `criarCategoriaContrato(nome: string): Promise<{ categoria?: ContratoCategoria; error?: string }>` | `assertAdmin` (catch → `{ error }`) | `nome = nome.trim()`; valida `2..60` chars senão `{ error: 'O nome deve ter entre 2 e 60 caracteres.' }`. `slug = slugifyCategoria(nome)`; se vazio → `{ error: 'Nome inválido.' }`. Checa colisão: `collection.where('slug','==',slug).limit(1).get()` não-vazio OU slug ∈ fixas → `{ error: 'Já existe uma categoria com esse nome.' }`. `ref = doc()`; `set({ nome, slug, fixa: false, ordem: 1000, criadoPorUid: user.uid, criadoEm: now })`. `revalidatePath('/dashboard/contratos')`. `{ categoria: serialize(...) }`. |
| `renomearCategoriaContrato(id: string, nome: string): Promise<{ categoria?; error? }>` | `assertAdmin` | `doc(id).get()` inexistente → `{ error: 'Categoria não encontrada.' }`. `data.fixa` → `{ error: 'As categorias padrão não podem ser alteradas.' }`. Valida nome igual ao criar. `slug` novo; colisão com **outro** doc ou com fixa → erro. `update({ nome, slug })`. **Cascade:** `contratos = collection('veiculo_contratos').where('categoriaId','==',id).get()`; `batch` com `update({ categoriaNome: nome })` em cada (chunk de 400 se necessário — na prática poucos). `revalidatePath('/dashboard/contratos')`. `{ categoria }`. |
| `removerCategoriaContrato(id: string): Promise<{ success?; error? }>` | `assertAdmin` | `get()` inexistente → erro. `data.fixa` → `{ error: 'As categorias padrão não podem ser removidas.' }`. `emUso = collection('veiculo_contratos').where('categoriaId','==',id).get()`; se `emUso.size > 0` → `{ error: `${emUso.size} contrato(s) usam esta categoria. Altere-os antes de apagar.` }`. `doc(id).delete()`. `revalidatePath('/dashboard/contratos')`. `{ success: 'Categoria removida.' }`. |
| `definirCategoriaContrato(contratoId: string, categoriaId: string): Promise<{ success?; error? }>` | `assertPodeGerarContratos` (catch → `{ error }`) | Valida ids não vazios. `contratoDoc = collection('veiculo_contratos').doc(contratoId).get()` inexistente → erro. `catDoc = collection('contrato_categorias').doc(categoriaId).get()` inexistente → `{ error: 'Categoria inválida.' }`. `update({ categoriaId, categoriaNome: catDoc.data().nome })`. `revalidatePath('/dashboard/contratos')`; `revalidatePath(`/veiculos/${contratoDoc.data().veiculoId}`)`. `{ success: 'Categoria atualizada.' }`. |

**Verificação:** `npx tsc --noEmit` + lint.

## Passo 4 — `anexarContratoVeiculoAction` exige categoria

**Alterado:** `app/veiculos/[id]/actions.ts` (`anexarContratoVeiculoAction`)
- Ler `const categoriaId = sanitizeString(formData.get('categoriaId'), 200)`.
- Após validar arquivo: se `!categoriaId` → `{ error: 'Selecione o tipo de contrato.' }`.
- Antes de gravar: `const catDoc = await adminDb.collection('contrato_categorias').doc(categoriaId).get()`;
  se `!catDoc.exists` → `{ error: 'Categoria inválida.' }`.
- No objeto `contrato` e no `contratoRef.set(...)`: incluir
  `categoriaId` e `categoriaNome: catDoc.data()!.nome`.
- `VeiculoContratoResponse.contrato` já reflete os campos novos via tipo.

**Verificação:** `npx tsc --noEmit`.

## Passo 5 — `page.tsx` carrega categorias

**Alterado:** `app/dashboard/contratos/page.tsx`
- `import { listarCategoriasContrato } from './categorias.actions'`.
- `const categorias = await listarCategoriasContrato()` (junto dos outros awaits;
  pode entrar num `Promise.all`).
- No `.map` `veiculoContratos → contratos`: adicionar
  `categoriaId: c.categoriaId ?? null`, `categoriaNome: c.categoriaNome ?? null`.
- `<ContratosClient ... categorias={categorias} isAdmin={session.role === 'admin'} />`.

**Verificação:** `npm run build`.

## Passo 6 — `ContratosClient`: upload, filtro, edição inline

**Alterado:** `app/dashboard/contratos/ContratosClient.tsx`

Props novas na interface: `categorias: ContratoCategoria[]`, `isAdmin: boolean`.
Import das actions de categoria e do tipo `ContratoCategoria`.

Estado novo:
- `const [categorias, setCategorias] = useState(props.categorias)`
- `const [categoriaUpload, setCategoriaUpload] = useState('')` (id ou `'__nova__'`)
- `const [novaCategoriaNome, setNovaCategoriaNome] = useState('')`
- `const [categoriaFiltro, setCategoriaFiltro] = useState('')` (id, `'__sem__'` ou `''`)
- `const [gerenciarOpen, setGerenciarOpen] = useState(false)`
- estado de edição inline: `savingCategoriaId: string | null`

### 6a. Select no modal "Anexar Contrato"
- `<Select label="Tipo de contrato *" required value={categoriaUpload} onChange=...>`:
  `<option value="" disabled>Selecione o tipo</option>`, uma `<option>` por
  categoria (`c.id` → `c.nome`), e **se `isAdmin`**: `<option value="__nova__">+ Outros (nova categoria)</option>`.
- Se `categoriaUpload === '__nova__'`: renderiza `<Input label="Nome da nova categoria" value={novaCategoriaNome} ...>`.
- `handleAnexarSubmit`:
  - Se `!categoriaUpload` → `toast.error('Selecione o tipo de contrato.')`.
  - Se `'__nova__'`: `if (!novaCategoriaNome.trim()) toast.error(...)`;
    `const r = await criarCategoriaContrato(novaCategoriaNome.trim())`;
    se `r.error` → `toast.error(r.error)` e aborta; senão
    `setCategorias(prev => ordenar([...prev, r.categoria!]))` e usa `r.categoria!.id`.
  - `formData.set('categoriaId', idEfetivo)`.
  - Sucesso: objeto `Contrato` otimista recebe
    `categoriaId: res.contrato.categoriaId ?? idEfetivo`,
    `categoriaNome: res.contrato.categoriaNome ?? nomeEfetivo`.
  - Reset: `setCategoriaUpload('')`, `setNovaCategoriaNome('')`.
- Helper local `ordenarCategorias` (mesma regra do server: fixas por `ordem`,
  custom por `nome`).

### 6b. Filtro por categoria
- Novo `<Select value={categoriaFiltro} onChange=...>` na barra de filtros:
  `<option value="">Todas as categorias</option>`,
  `<option value="__sem__">Sem categoria</option>`, uma por categoria.
- `filteredAgrupados`: adicionar cláusula — se `categoriaFiltro`:
  grupo passa se `group.contratos.some(c => categoriaFiltro === '__sem__' ? !c.categoriaId : c.categoriaId === categoriaFiltro)`.
  Combinar por AND com o filtro de veículo e a busca. Resetar `page` ao mudar.

### 6c. Coluna "Tipo" + edição inline no modal "Ver Contratos"
- Nova `<TH>Tipo</TH>` (antes de "Data").
- `<TD>`: se `c.categoriaNome` → badge neutro com o nome; senão badge âmbar
  "Sem categoria".
- Abaixo do badge, `<select>` compacto (nativo, estilo dos selects inline já
  usados no `VeiculosClient`) com as categorias; `value={c.categoriaId ?? ''}`,
  `<option value="" disabled>Definir tipo</option>`. `onChange`:
  `setSavingCategoriaId(c.id)`; `await definirCategoriaContrato(c.id, novoId)`;
  em sucesso atualiza `contratos` no estado (`categoriaId`, `categoriaNome`);
  `toast`. `disabled={savingCategoriaId === c.id}`.
- Atualizar `activeGroup`/`veiculosAgrupados` deriva de `contratos`, então o
  `setContratos` já propaga.

### 6d. Botão "Categorias" + modal de gestão (só admin)
- No header, ao lado de "Anexar Contrato", **se `isAdmin`**:
  `<Button variant="secondary" onClick={() => setGerenciarOpen(true)}>Categorias</Button>`.
- `<Modal open={gerenciarOpen} ...>`:
  - Lista `categorias`. Cada linha: nome + (fixa ? chip "Padrão" : ações).
    - Renomear: botão lápis → troca nome por `<Input>` inline + salvar/cancelar
      → `renomearCategoriaContrato(id, nome)`; sucesso: substitui no estado.
    - Apagar: botão lixeira → `ConfirmDialog`; `removerCategoriaContrato(id)`;
      erro (em uso) → `toast.error(r.error)`; sucesso: remove do estado.
  - Rodapé: `<Input>` "Nova categoria" + `<Button>` adicionar →
    `criarCategoriaContrato`; sucesso: adiciona no estado (reordenado).
  - Todas as mudanças de estado usam o mesmo `ordenarCategorias`.

**Verificação:** `npm run build` + lint.

## Passo 7 — `VeiculosClient`: categoria por PDF novo

**Alterado:** `app/dashboard/veiculos/VeiculosClient.tsx`
- Import `listarCategoriasContrato` de
  `@/app/dashboard/contratos/categorias.actions` e o tipo `ContratoCategoria`.
- `novosContratos` type →
  `{ file: File; descricao: string; enviarJuridico: boolean; categoriaId: string }[]`;
  `addContratos` inicializa `categoriaId: ''`.
- Novo helper `setNovoContratoCategoria(index, categoriaId)` (espelha
  `setNovoContratoDescricao`).
- Estado `const [categoriasContrato, setCategoriasContrato] = useState<ContratoCategoria[]>([])`
  e `categoriasContratoLoading`.
- `useEffect(() => { if (showForm && canManageContratos && categoriasContrato.length === 0 && !categoriasContratoLoading) { setCategoriasContratoLoading(true); listarCategoriasContrato().then(setCategoriasContrato).catch(() => {}).finally(() => setCategoriasContratoLoading(false)) } }, [showForm, canManageContratos])`.
- No bloco de cada `novosContratos` (após o input de descrição): novo
  `<select>` compacto "Tipo de contrato *" com `c.categoriaId` →
  `setNovoContratoCategoria(index, e.target.value)`;
  `<option value="" disabled>Tipo de contrato *</option>` + uma por categoria.
  Borda âmbar quando `!c.categoriaId` para sinalizar pendência.
- `handleSubmit` (bloco `if (novosContratos.length > 0 && vehicleId)`):
  **antes** do loop, `if (novosContratos.some(c => !c.categoriaId)) { toast.error('Escolha o tipo de cada contrato anexado.'); setContratosUploadProgress(false); return }`
  — o veículo já foi salvo; abortamos só o envio dos PDFs e mantemos
  `novosContratos` na tela para o usuário corrigir. (Ajustar mensagem final de
  sucesso para mencionar que os contratos não foram enviados.)
- No loop: `fd.set('categoriaId', categoriaId)`.

**Verificação:** `npm run build` + lint.

## Passo 8 — Regras do Firestore (se aplicável)

**Verificar:** `firestore.rules` — se houver regras explícitas por coleção,
adicionar `contrato_categorias` (leitura autenticada; escrita só admin via
Admin SDK já ignora rules, mas manter coerência). Se o projeto usa só Admin SDK
nas server actions e as rules são `allow read, write: if false` no client,
**nenhuma mudança**. Conferir e anotar.

`firestore.indexes.json`: **nenhum índice novo** — todas as queries de
`contrato_categorias` são sem `orderBy`, e os `where('categoriaId','==',...)`
em `veiculo_contratos` são igualdade simples (índice automático).

**Verificação:** revisão manual do arquivo.

## Passo 9 — Verificação manual (precisa de login → usuário)

1. `/dashboard/contratos` → "Anexar Contrato" sem escolher tipo → bloqueado.
2. Anexar com cada tipo fixo → badge certo no modal "Ver Contratos".
3. Como admin: tipo "+ Outros" → "Consórcio" → contrato criado com a categoria;
   "Consórcio" aparece no Select e no modal "Categorias".
4. Como vendedor (não-admin): opção "+ Outros" **não** aparece.
5. Modal de veículo: 2 PDFs, 1 sem tipo → salvar → veículo salvo, toast de erro,
   PDFs continuam pendentes; escolher o tipo → salvar de novo → enviados.
6. Contrato antigo (sem categoria): editar pelo select inline → persiste após
   refresh.
7. Filtro "CRLV" e filtro "Sem categoria" na tela de Contratos.
8. Renomear "Consórcio" → "Consórcio de veículo": contratos que a usam mostram o
   novo nome após refresh.
9. Apagar "Consórcio de veículo" com contrato usando → bloqueado com contagem;
   reclassificar o contrato → apagar de novo → ok.
10. Apagar/renomear categoria fixa → não há botão; a action recusa se chamada.
11. Semente: apagar manualmente um doc fixo no Firestore console e recarregar
    `/dashboard/contratos` → recriado.

Eu verifico: `tsc`, `build`, lint dos arquivos tocados, e rota no output do build.

## Passo 10 — Fechamento

`npm run lint` (sem erros novos) + `npm run build` limpo → commit
`feat(contratos): categorias de contrato` + `Co-Authored-By`. Sem merge na
master sem "ok".

## Riscos

- **`ContratosClient` já é grande.** Manter o modal de gestão de categorias e o
  select inline como blocos no mesmo arquivo (padrão do projeto), sem extrair
  componentes novos, a menos que passe de ~150 linhas adicionadas — aí extrair
  `GerenciarCategoriasModal` no mesmo diretório.
- **Cascade de renomear** — em teoria pode passar de 500 docs (limite de batch).
  Improvável nesse volume; se necessário, quebrar em chunks de 400. Anotado no
  Passo 3.
- **Race na semente lazy** — resolvido no Passo 3 usando `doc(slug)` como id
  determinístico das fixas: `set` concorrente é idempotente.
- **`session.role`** pode não refletir admin por profile — `assertAdmin` na
  action cobre com o fallback de `profiles/{uid}`. O `isAdmin` passado à UI é só
  cosmético (esconde botões); a action é a fonte de verdade.
- **Contratos antigos no filtro "Sem categoria"** dependem de `categoriaId`
  ausente/`null` — `serializeVeiculoContrato` normaliza para `null`, ok.
