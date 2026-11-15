# Importar planilha em Leads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carregar planilha do Excel (.xlsx/.xls/.xml) ou colar, corrigir colunas numa prévia, classificar cada linha em novo/duplicado/divergente e gravar divergentes confirmados como leads novos ligados aos parecidos, com selo "🔗 N relacionados" que filtra o grupo.

**Architecture:** Lógica pura nova em `prospeccao-importacao.ts` (mapa de colunas, comparação, classificação, grupo), usada pelo cliente (prévia) e pelo servidor (reclassifica antes de gravar — fonte da verdade). Leitura de arquivo no navegador via SheetJS com `import()` dinâmico. O modal de importação sai de `ProspeccaoSection.tsx` (1512 linhas) para um componente próprio.

**Tech Stack:** Next.js 16 (App Router, server actions), React, Firestore (firebase-admin), SheetJS 0.20.3 (tarball oficial), vitest (novo, só para lógica pura).

**Spec:** `docs/superpowers/specs/2026-11-15-leads-importar-planilha-design.md`

## Global Constraints

- Ler o guia relevante em `node_modules/next/dist/docs/` antes de mexer em server actions (AGENTS.md: "This is NOT the Next.js you know").
- SheetJS instalado do tarball oficial: `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` — nunca o `xlsx` do registry npm.
- SheetJS só por `await import('xlsx')` no cliente, no momento em que o usuário escolhe um arquivo.
- Arquivos `'use server'` só exportam funções async: tipos novos vão em `types.ts`.
- CPF/CNPJ continua gravado criptografado (`paraGravar`).
- Textos da UI em português; seguir componentes de `app/components/ui`.
- Formatos aceitos: `.xlsx`, `.xls`, `.xml`.
- Limite por chamada ao servidor continua `IMPORT_MAX = 400`; batches do Firestore até 400 operações.

## Review Focus

1. **CPF/telefone gravado como número no Excel** perde zeros à esquerda e pode virar notação científica — esperado: CPF com 9–10 dígitos volta a 11, CNPJ com 12–13 volta a 14; número vira texto sem "E+". → teste em Task 2.
2. **Valor monetário como número** (`35587.5`) não pode virar 355875 no `parseValor` pt-BR. → teste em Task 2.
3. **Mesmo lead duas vezes no próprio arquivo, idêntico** — esperado: a segunda linha é duplicado. → teste em Task 3.
4. **Linhas de título acima do cabeçalho / linhas e colunas vazias no fim** — esperado: cabeçalho achado em qualquer linha; vazios descartados. → teste em Task 2.
5. **Divergente não confirmado enviado ao servidor por um cliente adulterado** — esperado: servidor não grava. → teste em Task 3 (`linhasParaGravar`).

---

### Task 1: Vitest + `vinculados` no modelo

**Files:**
- Modify: `package.json` (devDependency `vitest`, script `"test": "vitest run"`)
- Create: `vitest.config.ts` (alias `@` → raiz, `environment: 'node'`, `include: ['**/*.test.ts']`, excluir `node_modules`)
- Modify: `app/dashboard/juridico/types.ts` — `Prospeccao.vinculados: string[]`; novo tipo `LinhaImportacao`
- Modify: `app/dashboard/juridico/prospeccao-actions.ts` — `serializar` e retorno de `salvarProspeccao` incluem `vinculados`
- Test: `app/dashboard/juridico/prospeccao-importacao.test.ts` (smoke)

**Interfaces — Produces:**
```ts
// types.ts
interface Prospeccao { /* ... */ vinculados: string[] }
interface LinhaImportacao {
  dados: Partial<Record<keyof ProspeccaoInput, unknown>>
  /** Usuário confirmou a inclusão de uma linha divergente. */
  confirmado: boolean
}
```

- [ ] **Step 1:** `npm i -D vitest`; criar `vitest.config.ts`; teste smoke `expect(1).toBe(1)`.
- [ ] **Step 2:** `npm test` → 1 passed.
- [ ] **Step 3:** Adicionar `vinculados` aos tipos; em `serializar`: `vinculados: Array.isArray(data.vinculados) ? data.vinculados.filter((x) => typeof x === 'string') : []`; `salvarProspeccao` (criação) devolve `vinculados: []`. Atualização não toca em `vinculados`.
- [ ] **Step 4:** `npx tsc --noEmit` → sem erros (corrigir qualquer outro lugar que monte `Prospeccao` literal).
- [ ] **Step 5:** Commit `chore(leads): vitest e campo vinculados`.

---

### Task 2: Matriz e mapa de colunas

**Files:**
- Modify: `app/dashboard/juridico/prospeccao-parse.ts` — exportar `mapaCabecalho`, `ORDEM_POSICIONAL`; `parseLinhasPlanilha` passa a usar as funções novas (comportamento atual preservado)
- Create: `app/dashboard/juridico/prospeccao-importacao.ts`
- Create: `app/dashboard/juridico/ler-arquivo-planilha.ts` (cliente; SheetJS)
- Test: `app/dashboard/juridico/prospeccao-importacao.test.ts`

**Interfaces — Produces (em `prospeccao-importacao.ts`):**
```ts
type Campo = keyof ProspeccaoInput
/** Índice da coluna da planilha → campo do lead (ausente = ignorada). */
type MapaColunas = (Campo | null)[]
interface LeituraMatriz {
  matriz: string[][]          // linhas de dados (sem o cabeçalho)
  cabecalho: string[] | null  // títulos originais, se houver
  mapa: MapaColunas           // detectado
  porCabecalho: boolean
}
function celulaParaTexto(v: unknown): string
function lerMatriz(linhas: string[][]): LeituraMatriz
function trocarCampo(mapa: MapaColunas, coluna: number, campo: Campo | null): MapaColunas
function aplicarMapa(matriz: string[][], mapa: MapaColunas): { registros: ProspeccaoInput[]; ignoradas: number }
```
**Em `ler-arquivo-planilha.ts`:**
```ts
interface AbaPlanilha { nome: string; linhas: string[][] }
async function lerArquivoPlanilha(file: File): Promise<AbaPlanilha[]>
```

- [ ] **Step 1: Testes que falham**
  - `celulaParaTexto(12345678901)` → `'12345678901'`; `celulaParaTexto(1.19e10)` → `'11900000000'` (sem "E+"); `celulaParaTexto(35587.5)` → `'35587,5'`; `celulaParaTexto(new Date(2024, 0, 31))` → `'31/01/2024'`; `null` → `''`.
  - `normalizarProspeccao({ nomeExecutado: 'A', cpfCnpj: '1234567890' }).cpfCnpj` → `'01234567890'`; com 13 dígitos → 14 com zero à esquerda.
  - `parseValor('35587,5')` → `35587.5`.
  - `lerMatriz([['Relatório'], ['Nome do Executado','CPF','Placa','Banco','Comarca'], ['João','123','ABC1D23','X','Y'], ['','','','','']])` → `porCabecalho: true`, `matriz.length === 1`, `mapa[0] === 'nomeExecutado'`.
  - `lerMatriz` sem cabeçalho → mapa = `ORDEM_POSICIONAL` na largura da matriz, `porCabecalho: false`.
  - `trocarCampo(['nomeExecutado','comarca',null], 2, 'comarca')` → `['nomeExecutado', null, 'comarca']`.
  - `aplicarMapa` com linha sem nome → `ignoradas: 1`.
  - `parseLinhasPlanilha` (existente) com texto colado de 2 linhas + cabeçalho continua devolvendo os mesmos registros.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar. Notas:
  - `celulaParaTexto`: número inteiro → `BigInt`-safe `n.toFixed(0)`; não inteiro → `n.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 10 })`; `Date` → `dd/mm/aaaa`.
  - Padding de CPF/CNPJ fica em `normalizarProspeccao` (vale também para colar): só dígitos com 9–10 → `padStart(11,'0')`; 12–13 → `padStart(14,'0')`; sem máscara se veio com máscara.
  - `lerMatriz`: a linha de cabeçalho é a primeira para a qual `mapaCabecalho` não é null; linhas acima dela são descartadas; linhas totalmente vazias descartadas; colunas vazias no fim aparadas.
  - `lerArquivoPlanilha`: `const XLSX = await import('xlsx')`; `XLSX.read(await file.arrayBuffer(), { cellDates: true })`; cada aba → `sheet_to_json(ws, { header: 1, raw: true, defval: '' })` → `celulaParaTexto` em cada célula. Erro de leitura → lança `Error('Não foi possível ler o arquivo. Use .xlsx, .xls ou .xml do Excel.')`.
- [ ] **Step 4:** `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`; `npm test` → PASS; `npx tsc --noEmit` limpo.
- [ ] **Step 5:** Commit `feat(leads): leitura de planilha e mapa de colunas`.

---

### Task 3: Comparação, classificação e grupo

**Files:**
- Modify: `app/dashboard/juridico/prospeccao-importacao.ts`
- Test: `app/dashboard/juridico/prospeccao-importacao.test.ts`

**Interfaces — Produces:**
```ts
const CAMPOS_COMPARADOS: Campo[] = ['nomeExecutado','cpfCnpj','placa','numeroProcesso','comarca',
  'endereco','veiculo','anoModelo','banco','valorEntrada','valorFinanciado','valorParcela']
  // + telefones, comparados como conjunto
type Classe = 'novo' | 'duplicado' | 'divergente'
type Ref = { tipo: 'existente'; id: string } | { tipo: 'linha'; indice: number }
interface Correspondencia { ref: Ref; divergencias: (Campo | 'telefones')[] }
interface LinhaClassificada {
  indice: number
  registro: ProspeccaoInput
  classe: Classe
  correspondencias: Correspondencia[]
}
function divergencias(novo: ProspeccaoInput, atual: ProspeccaoInput): (Campo | 'telefones')[]
function classificarLinhas(
  registros: ProspeccaoInput[],
  existentes: { id: string; dados: ProspeccaoInput }[],
): LinhaClassificada[]
/** Índices das linhas que podem ser gravadas: novos + divergentes com confirmado. */
function linhasParaGravar(classificadas: LinhaClassificada[], confirmados: Set<number>): number[]
function grupoVinculado(id: string, itens: Pick<Prospeccao, 'id' | 'vinculados'>[]): Set<string>
```

**Regras (do spec):**
- Correspondência = compartilha alguma chave de `chavesDuplicidade` com um existente **ou** com uma linha anterior do arquivo que não seja `duplicado`.
- Comparação normalizada: sem acento, minúsculas, sem espaços/pontuação; CPF/placa só alfanumérico; valores por igualdade numérica.
- Campo diverge se o **novo tem valor** e o atual está **vazio ou diferente**. Novo vazio nunca diverge.
- Telefones: diverge se o novo tem ≥1 telefone e nenhum (só dígitos) está entre os do atual.
- `duplicado` se alguma correspondência tem zero divergências; `divergente` se todas têm ≥1; `novo` se não há correspondência.

- [ ] **Step 1: Testes que falham**
  - Mesmo CPF, mesma placa, resto igual com formatação diferente (`'José'` vs `'JOSE'`, `'(11) 99999-0000'` vs `'11999990000'`) → `duplicado`.
  - Mesmo CPF, placa diferente → `divergente`, divergências contém `'placa'`.
  - Mesma placa, comarca diferente → `divergente` com `'comarca'`.
  - Atual sem placa, novo com placa (mesmo CPF) → `divergente` com `'placa'`.
  - Novo sem endereço, atual com endereço → não diverge em `endereco`.
  - Valor de parcela diferente → `'valorParcela'`; telefone novo que não está entre os 3 do atual → `'telefones'`.
  - Correspondência com dois existentes, um idêntico → `duplicado`.
  - Duas linhas idênticas no arquivo, sem existentes → `[novo, duplicado]`, a segunda referencia `{ tipo: 'linha', indice: 0 }`.
  - `linhasParaGravar` com um divergente não confirmado → índice dele ausente; confirmado → presente; duplicado confirmado → ausente.
  - `grupoVinculado('a', [{id:'a',vinculados:['b']},{id:'b',vinculados:['c']},{id:'c',vinculados:[]},{id:'d',vinculados:[]}])` → `{a,b,c}`; ids órfãos ignorados.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar (grupo: BFS sobre arestas nos dois sentidos).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(leads): classificação de duplicados e divergentes`.

---

### Task 4: Servidor — importar com ligação e limpar ligações ao excluir

**Files:**
- Modify: `app/dashboard/juridico/prospeccao-actions.ts`

**Interfaces:**
- Consumes: `LinhaImportacao` (Task 1); `classificarLinhas`, `linhasParaGravar` (Task 3).
- Produces:
```ts
importarProspeccoes(linhas: LinhaImportacao[]): Promise<{
  success?: string; error?: string
  importados?: number; duplicados?: number; pendentes?: number
}>
```

- [ ] **Step 1:** Ler `node_modules/next/dist/docs/` sobre server actions (confirmar que nada mudou para `'use server'` + `revalidatePath`).
- [ ] **Step 2:** Reescrever `importarProspeccoes`:
  - valida tamanho (`IMPORT_MAX`), normaliza `dados`, descarta sem nome;
  - carrega existentes (descriptografando CPF como hoje) → `classificarLinhas`;
  - `confirmados` = índices com `confirmado === true`; grava `linhasParaGravar(...)`;
  - pré-gera `doc()` para cada linha gravada; `vinculados` do novo = ids das correspondências existentes + ids das linhas do lote referenciadas **que também estão sendo gravadas**; cada existente referenciado recebe `FieldValue.arrayUnion(novoId)`; linhas do lote referenciadas recebem o id de volta no próprio `set`;
  - commits em lotes de até 400 operações; `created_at` decrescente como hoje;
  - mensagem: `"N importado(s). N já cadastrado(s) ignorado(s). N divergente(s) sem confirmação não importado(s)."` (partes zeradas omitidas); tudo zero importado → `error` com o mesmo resumo.
- [ ] **Step 3:** `deleteProspeccao` / `deleteProspeccoes`: antes de apagar, para cada doc apagado, `arrayRemove(id)` nos `vinculados` dos leads que ele lista (ignorar os que também estão sendo apagados ou não existem).
- [ ] **Step 4:** `npx tsc --noEmit` limpo; `npm test` PASS.
- [ ] **Step 5:** Commit `feat(leads): importação com ligação entre leads divergentes`.

---

### Task 5: Modal "Importar planilha"

**Files:**
- Create: `app/dashboard/juridico/ImportarPlanilhaModal.tsx`
- Modify: `app/dashboard/juridico/ProspeccaoSection.tsx` — remover estado/JSX do modal atual (`importTexto`, `leitura`, `previa`, `handleImport`, modal ~linhas 1259–1340); botão vira "Importar planilha"

**Interfaces:**
- Consumes: `lerArquivoPlanilha`, `lerMatriz`, `trocarCampo`, `aplicarMapa`, `classificarLinhas` (Tasks 2–3); `importarProspeccoes` (Task 4).
- Produces:
```tsx
function ImportarPlanilhaModal(props: {
  open: boolean
  onClose: () => void
  existentes: Prospeccao[]
  onImportado: () => Promise<void> // ProspeccaoSection recarrega a lista e volta à página 1
}): JSX.Element
```

**Comportamento (spec "Entrada", "Correção de colunas", "Prévia"):**
- Duas entradas: `<input type="file" accept=".xlsx,.xls,.xml">` e o `Textarea` de colar (via `lerTsv`). A última usada vale.
- Várias abas → `Select` de aba (primeira por padrão).
- Tabela por colunas da planilha: título original + `Select` (campos de `PROSPECCAO_COLUNAS` + "Ignorar coluna"); coluna em "Ignorar" com destaque âmbar; primeiras 5 linhas como amostra.
- Sem coluna `nomeExecutado` → aviso e botão Importar desabilitado.
- Resumo: `N novos · N divergentes · N duplicados (não serão importados) · N sem nome (ignorados)`.
- Abas Novos / Divergentes / Duplicados, todas as linhas (rolagem). Divergente: lado a lado "Cadastrado" × "Planilha" para cada correspondência, campos de `divergencias` destacados, checkbox + "Marcar todos". Duplicado: mostra o correspondente.
- Importar `N` (novos + divergentes marcados): envia em partes de 400 em sequência, com "Importando parte X de Y"; erro numa parte interrompe, mostra quantas entraram e chama `onImportado`. Sucesso → toast com a mensagem do servidor, fecha, `onImportado`.
- Ao fechar/reabrir, estado zera.

- [ ] **Step 1:** Implementar componente e trocar no `ProspeccaoSection`.
- [ ] **Step 2:** `npx tsc --noEmit` e `npm run lint` limpos.
- [ ] **Step 3: Verificação manual** (dev server, `/dashboard/leads`): montar 3 arquivos de teste no scratchpad (.xlsx, .xls e .xml 2003 salvos do Excel ou gerados com SheetJS) contendo: 1 lead novo, 1 idêntico a um lead existente, 1 com mesmo CPF e placa diferente, 1 linha sem nome, CPF como número com zero à esquerda. Esperado: contagens 1/1/1/1, CPF com 11 dígitos, troca de coluna reflete no consolidado, colar continua funcionando.
- [ ] **Step 4:** Commit `feat(leads): modal de importação com prévia e correção de colunas`.

---

### Task 6: Selo "🔗 N relacionados" e filtro de grupo

**Files:**
- Modify: `app/dashboard/juridico/ProspeccaoSection.tsx`

**Interfaces — Consumes:** `grupoVinculado` (Task 3).

- [ ] **Step 1:** Estado `grupoDe: Prospeccao | null`. `filtrados` passa a aplicar, quando houver, `grupoVinculado(grupoDe.id, itens)` sobre `buscados` antes de `aplicarFiltros`. Definir/limpar o grupo faz `setPage(1)`; "Limpar filtros" também limpa o grupo.
- [ ] **Step 2:** Selo na célula do nome (tabela) e no `CartaoProspeccao` quando `vinculados` (filtrado pelos ids existentes em `itens`) tem ≥1: botão pequeno `🔗 {n} relacionado(s)` (n = tamanho do grupo − 1) que faz `setGrupoDe(p)`.
- [ ] **Step 3:** Faixa acima da lista: "Mostrando leads relacionados a <nome> ✕".
- [ ] **Step 4:** `npx tsc --noEmit` / lint limpos; manual: importar o divergente da Task 5 → os dois leads mostram o selo; clicar filtra os dois; ✕ volta à lista toda; excluir um → selo some do outro.
- [ ] **Step 5:** Commit `feat(leads): selo de leads relacionados com filtro do grupo`.

---

### Task 7: Script de limpeza respeita ligações

**Files:**
- Modify: `scripts/apagar-leads-duplicados.ts`

**Interfaces — Consumes:** `grupoVinculado` (Task 3).

- [ ] **Step 1:** Antes do union-find, calcular para cada doc o grupo de ligação (`grupoVinculado` com `{id, vinculados}` de todos os docs). Na união por chave, **não unir** `i` e `j` se `j` está no grupo de ligação de `i`.
- [ ] **Step 2:** Ao apagar: o lead que fica recebe a união dos `vinculados` dos apagados (menos ele mesmo e menos ids apagados); todos os docs que restam têm os ids apagados removidos de `vinculados` (na mesma passada do `merges`).
- [ ] **Step 3:** `npm run leads:duplicados` (simulação) — conferir que pares ligados não aparecem como grupo; nada é apagado sem `--apply`.
- [ ] **Step 4:** Commit `fix(leads): limpeza de duplicados respeita leads ligados` (incluir o spec e este plano no primeiro commit se ainda não estiverem).
