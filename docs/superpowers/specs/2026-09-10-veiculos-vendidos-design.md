# Veículos vendidos — vitrine no site + baixa automática em 30 dias

**Data:** 2026-09-10
**Status:** rascunho (aguardando revisão do spec)
**Branch:** `feat/veiculos-vendidos` (a criar a partir da `master`)
**Relacionado:** [`app/page.tsx`](../../../app/page.tsx), [`app/PublicVehiclesList.tsx`](../../../app/PublicVehiclesList.tsx), [`app/veiculos/[id]/page.tsx`](../../../app/veiculos/[id]/page.tsx), [`app/dashboard/veiculos/actions.ts`](../../../app/dashboard/veiculos/actions.ts), [`app/dashboard/veiculos/public.ts`](../../../app/dashboard/veiculos/public.ts), [`app/dashboard/veiculos/VeiculosClient.tsx`](../../../app/dashboard/veiculos/VeiculosClient.tsx), [`app/api/cron/lembretes-cobranca/route.ts`](../../../app/api/cron/lembretes-cobranca/route.ts), [`vercel.json`](../../../vercel.json), coleção `veiculos`

## Problema / objetivo

Quando um veículo é vendido ele hoje some do site (é marcado como privado ou
removido). Some também a prova social — "essa loja vende". O pedido: uma seção
pública **"Veículos vendidos"** onde os carros marcados como vendidos por alguém
do sistema ficam expostos por **30 dias** e depois são **apagados de vez**.
Alguém do sistema pode **desmarcar** ("deixar de ser vendido"), devolvendo o
carro ao estoque normal.

Decisões de produto já tomadas (brainstorm 2026-09-10):

- A vitrine de vendidos é uma **seção na home, abaixo do estoque** (não é página
  própria, não é filtro dentro da lista atual).
- "Apagado após 30 dias" = **excluir o veículo de vez** — doc do Firestore +
  fotos no Storage + contratos anexados, igual ao botão "Remover" de hoje.
  Irreversível.
- A marcação é um **terceiro estado** do veículo no estoque: **Disponível /
  Vendido / Privado** num seletor único (substitui o switch Público/Privado).
- Card do vendido no site: **selo "VENDIDO", sem exibir preço** (por quanto o
  veículo foi vendido é informação interna), e o card **continua clicável** para
  `/veiculos/[id]` (sem formulário de proposta). _(Ajuste 2026-09-10: a versão
  original mostrava o preço riscado; passou a não exibir valor nenhum a pedido
  do dono.)_
- O gatilho da exclusão é um **cron diário** na Vercel (não limpeza preguiçosa).
- Ao **desmarcar**, o veículo volta a **Disponível** e o prazo **zera** — se for
  remarcado como vendido, os 30 dias recomeçam.
- Quem marca/desmarca: **mesma regra de gerenciar veículos**
  (`assertPodeGerenciarVeiculos` — admin ou permissão `veiculos`).

## Não-objetivos (nesta entrega)

- Página dedicada `/vendidos` ou item de menu novo.
- Guardar histórico de vendas / data de estorno / preço de venda real.
- Preservar a visibilidade anterior (Público vs Privado) ao estornar — sempre
  volta como **Disponível/Público**.
- Prazo configurável pela UI (fica numa constante).
- Notificação/e-mail quando um vendido está prestes a ser apagado.
- Filtro "Vendidos" na listagem pública, busca ou ordenação nessa seção.
- Contabilizar vendidos em qualquer métrica de analytics ou nos contadores da
  home.
- _(sem itens — o changelog entra nesta branch, ver item 10)._

## Modelo de dados

Coleção `veiculos` ganha **um campo**:

```
vendidoEm: string | null   // ISO 8601 (new Date().toISOString()), como created_at
```

- `null` / ausente → veículo não está vendido.
- string ISO → instante em que foi marcado como vendido. Comparação
  lexicográfica de ISO 8601 == cronológica, então dá pra usar `where('vendidoEm',
  '<', cutoffIso)` direto.

**Nenhum campo de enum novo.** O estado de 3 valores é **derivado** de `publico`
+ `vendidoEm`:

| Estado exibido | Condição | Aparece no site |
| --- | --- | --- |
| **Vendido** | `vendidoEm != null` | seção "Vendidos" (enquanto ≤ `VENDIDO_TTL_DIAS`) |
| **Disponível** | `!vendidoEm && publico === true` | grid do estoque |
| **Privado** | `!vendidoEm && publico !== true` | não aparece |

`vendidoEm` **vence** `publico`: um veículo que estava privado e é marcado como
vendido aparece na vitrine de vendidos.

Helper de derivação (novo, em `app/dashboard/veiculos/public.ts` — módulo já sem
`'use server'`, compartilhável client/server):

```ts
export type EstoqueEstado = 'disponivel' | 'vendido' | 'privado'

export function estoqueEstadoDe(v: { publico: boolean; vendidoEm: string | null }): EstoqueEstado {
  if (v.vendidoEm) return 'vendido'
  return v.publico ? 'disponivel' : 'privado'
}
```

### Constante

`constants/veiculos.ts` (arquivo novo):

```ts
/** Dias que um veículo marcado como "vendido" fica exposto no site antes de ser apagado de vez. */
export const VENDIDO_TTL_DIAS = 30
```

### Índice Firestore

Nenhuma mudança em `firestore.indexes.json`. A query do cron é um range sobre
**campo único** (`vendidoEm`), que o Firestore indexa automaticamente. Docs sem
o campo simplesmente não entram no resultado do range — comportamento desejado.

## Componentes e mudanças

### 1. `app/dashboard/veiculos/actions.ts`

**a) `Veiculo` + `getVehicles`**
- Adicionar `vendidoEm: string | null` à interface `Veiculo`.
- No mapeador de `getVehicles`: `vendidoEm: data.vendidoEm ?? null`.

**b) `createVehicle`**
- Ler campo oculto `estoqueEstado` do form (`'disponivel' | 'vendido' | 'privado'`,
  default `'disponivel'`).
- Derivar na gravação:
  - `disponivel` → `publico: true`,  `vendidoEm: null`
  - `privado`    → `publico: false`, `vendidoEm: null`
  - `vendido`    → `publico: true`,  `vendidoEm: now`
- Mantém o campo `publico` que o form já manda como fallback quando
  `estoqueEstado` não vier (compat).

**c) Nova server action `setVeiculoEstoqueEstado(id, estado)`** — substitui
`setVeiculoPublico` (hoje usada só em `VeiculosClient.tsx`).

```ts
export async function setVeiculoEstoqueEstado(
  id: string,
  estado: 'disponivel' | 'vendido' | 'privado',
): Promise<VeiculoResponse>
```

- `assertPodeGerenciarVeiculos()` no topo (igual a `setVeiculoPublico`).
- Sem passar pelas validações do cadastro completo (mesma motivação da
  `setVeiculoPublico`: dado legado em outro campo não pode travar o seletor).
- Grava:
  - `disponivel` → `{ publico: true,  vendidoEm: null, updated_at }`
  - `privado`    → `{ publico: false, vendidoEm: null, updated_at }`
  - `vendido`    → `{ vendidoEm: new Date().toISOString(), updated_at }`
    (não mexe em `publico` — `vendidoEm` já domina no site e na página de detalhe)
- `revalidatePath('/dashboard/veiculos')` **e** `revalidatePath('/')` (a home
  pública muda de conteúdo).
- Mensagem de sucesso por estado ("Veículo marcado como vendido.", "Veículo de
  volta ao estoque.", "Veículo agora está privado.").

**d) Refatorar exclusão — extrair `apagarVeiculoCompleto(id)`**

O miolo de `deleteVehicle` (apagar fotos do Storage, apagar `veiculo_contratos`
+ seus arquivos, apagar o doc) vira uma função **não exportada como action**,
sem checagem de auth:

```ts
/** Apaga um veículo e todos os artefatos ligados (fotos, contratos). Sem auth — o chamador garante. */
async function apagarVeiculoCompleto(id: string): Promise<void>
```

- `apagarVeiculoCompleto` mora em **`utils/veiculos/apagar.ts`** (`import
  'server-only'`), junto com um `extractFirebaseStoragePath` movido pra lá (hoje
  é helper privado de `actions.ts`). Motivo: `actions.ts` tem `'use server'` e
  não deve exportar função chamada fora de contexto de componente/action; o cron
  é um util de servidor puro.
- `deleteVehicle` passa a: `assertPodeGerenciarVeiculos()` → `apagarVeiculoCompleto(id)`
  → `revalidatePath('/dashboard/veiculos')` + `revalidatePath('/')`.

### 2. `app/dashboard/veiculos/public.ts`

- `PublicVeiculo` ganha `vendidoEm: string | null`.
- `toPublicVeiculo`: `vendidoEm: v.vendidoEm`.
- Adicionar `EstoqueEstado` + `estoqueEstadoDe` (ver "Modelo de dados").
- Helper de janela pública:

```ts
import { VENDIDO_TTL_DIAS } from '@/constants/veiculos'

/** true se o veículo foi vendido há <= VENDIDO_TTL_DIAS (ainda deve aparecer na vitrine). */
export function vendidoVisivel(vendidoEm: string | null, agora = Date.now()): boolean {
  if (!vendidoEm) return false
  const t = new Date(vendidoEm).getTime()
  return Number.isFinite(t) && agora - t <= VENDIDO_TTL_DIAS * 24 * 60 * 60 * 1000
}
```

### 3. `app/page.tsx` (home pública)

```ts
const todosVeiculos = await getVehicles()
const disponiveis = todosVeiculos
  .filter(v => v.publico === true && !v.vendidoEm)
  .map(toPublicVeiculo)
const vendidos = todosVeiculos
  .filter(v => vendidoVisivel(v.vendidoEm))
  .map(toPublicVeiculo)
```

- Todos os contadores/looks que hoje usam `veiculos` (trust strip "{n} Veículos",
  header "Frota Disponível", "{n} veículos") passam a usar `disponiveis`.
- `<PublicVehiclesList veiculos={disponiveis} />` — sem mudança no componente.
- Abaixo da `<section id="estoque">`, nova `<section id="vendidos">` renderizada
  **só se `vendidos.length > 0`**, com `<PublicSoldVehiclesList veiculos={vendidos} />`.

### 4. `app/PublicSoldVehiclesList.tsx` (novo)

- `'use client'` não é necessário (sem estado/filtro) — **server component**.
- Props: `{ veiculos: PublicVeiculo[] }`. Ordena por `vendidoEm` desc (venda mais
  recente primeiro).
- Grid `sm:grid-cols-2 lg:grid-cols-3`, mesmo espaçamento do estoque.
- Card enxuto, visual "arquivado":
  - foto em `grayscale` suave + overlay; tarja diagonal ou selo **"VENDIDO"**
    (vermelho/neutro) no canto.
  - marca / modelo / ano / km.
  - **sem preço** — só o rótulo "Vendido". Por quanto foi vendido não vai pro site.
  - card inteiro é `<Link href={/veiculos/${v.id}}>` — sem botão "Ver detalhes",
    sem `ShareButton`.
- Cabeçalho da seção: rótulo "Já foi pra garagem de alguém" / "Vendidos
  recentemente" + contador. (copy final no PR.)
- Sem estado vazio próprio — a seção não renderiza quando não há vendidos.

### 5. Cron — `utils/veiculos/limpar-vendidos.ts` (novo)

Espelha `utils/cobrancas/processar-lembretes.ts` (lógica separada da rota, para
poder ser testada / chamada manualmente no futuro).

```ts
import { adminDb } from '@/utils/firebase/admin'
import { apagarVeiculoCompleto } from '@/utils/veiculos/apagar'
import { VENDIDO_TTL_DIAS } from '@/constants/veiculos'

export interface LimparVendidosResultado {
  verificados: number
  removidos: number
  erros: number
}

export async function limparVeiculosVendidos(): Promise<LimparVendidosResultado> {
  const cutoff = new Date(Date.now() - VENDIDO_TTL_DIAS * 24 * 60 * 60 * 1000).toISOString()
  const snap = await adminDb.collection('veiculos').where('vendidoEm', '<', cutoff).get()
  let removidos = 0, erros = 0
  for (const doc of snap.docs) {
    try {
      await apagarVeiculoCompleto(doc.id)
      removidos++
    } catch (err) {
      console.error('[limpar-vendidos] falha ao apagar', doc.id, err)
      erros++
    }
  }
  return { verificados: snap.size, removidos, erros }
}
```

- `apagarVeiculoCompleto` vem de `utils/veiculos/apagar.ts` (ver item 1d) — util
  de servidor puro, sem `'use server'`, seguro pra chamar de outro util.

### 6. Cron — `app/api/cron/limpar-vendidos/route.ts` (novo)

Cópia estrutural de `app/api/cron/lembretes-cobranca/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { limparVeiculosVendidos } from '@/utils/veiculos/limpar-vendidos'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }
  try {
    const resultado = await limparVeiculosVendidos()
    return NextResponse.json({ ok: true, ...resultado })
  } catch (err) {
    console.error('[cron/limpar-vendidos]', err)
    return NextResponse.json({ ok: false, error: 'Erro ao limpar vendidos.' }, { status: 500 })
  }
}
```

### 7. `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/lembretes-cobranca", "schedule": "0 12 * * *" },
    { "path": "/api/cron/limpar-vendidos",   "schedule": "30 12 * * *" }
  ]
}
```

- **Atenção plano Vercel:** no plano Hobby o limite é 2 cron jobs e execução no
  máximo 1×/dia. Este é o segundo — se já existir outro cron não versionado aqui,
  revisar antes do deploy.

### 8. `app/dashboard/veiculos/VeiculosClient.tsx`

**a) Seletor de 3 estados** (substitui o bloco do switch "Visibilidade",
linhas ~1117-1158)

- Estado local: `const [estoqueEstado, setEstoqueEstado] = useState<EstoqueEstado>('disponivel')`
  (substitui `const [publico, setPublico] = useState(true)`).
- Ao abrir para editar (`handleEdit`): `setEstoqueEstado(estoqueEstadoDe(veiculo))`.
- `resetForm`: volta para `'disponivel'`.
- Controle segmentado (3 botões: Disponível / Vendido / Privado) com cores:
  - Disponível → verde (como o "Público" atual)
  - Vendido → âmbar/vermelho
  - Privado → neutro
- `handleSetEstoqueEstado(novo)`:
  - se `!editingId` → só `setEstoqueEstado(novo)` (vai no create via hidden field).
  - se `editingId` → otimista + `await setVeiculoEstoqueEstado(editingId, novo)`;
    em erro reverte para o valor anterior e mostra `result.error`; em sucesso
    `router.refresh()`. (Mesma mecânica de `handleTogglePublico`.)
- `publicoSaving` → renomear para `estadoSaving` (ou manter o nome, é interno).

**b) Envio no form** (`handleSubmit`, hoje `formData.append('publico', String(publico))`)
- Trocar por `formData.append('estoqueEstado', estoqueEstado)`.
- `updateVehicle` **não** grava `vendidoEm` (não recebe esse campo); o seletor já
  persistiu via `setVeiculoEstoqueEstado`. Só o `createVehicle` lê `estoqueEstado`.
  - Nota: ao editar um veículo **vendido** e salvar o form inteiro,
    `updateVehicle` reescreve `publico` (do valor derivado do estado atual) mas
    **não toca `vendidoEm`** → o veículo continua vendido. Ok.

**c) Badge do card do estoque** (linhas ~2239-2247)
- Passar de 2 estados (Público/Privado) para 3, usando `estoqueEstadoDe(v)`:
  - `disponivel` → verde "Disponível" (hoje "Público")
  - `vendido` → vermelho/âmbar "Vendido"
  - `privado` → escuro "Privado"
- `totalPublicos` (linha ~902) e o resumo no topo: decidir se "vendido" conta
  como público. **Decisão:** criar `totalDisponiveis` (só `disponivel`) e um
  `totalVendidos`; ajustar os rótulos do cabeçalho da aba.

**d) Import** — trocar `setVeiculoPublico` por `setVeiculoEstoqueEstado`; importar
`estoqueEstadoDe`, `EstoqueEstado` de `./public`.

### 9. `app/veiculos/[id]/page.tsx` (detalhe público)

- `const isVendido = !!veiculo.vendidoEm`
- Gate atual:
  `if (!isPublic && !showInternalInfo) notFound()`
  → `if (!isPublic && !isVendido && !showInternalInfo) notFound()`
  - Um vendido além dos 30 dias já foi apagado pelo cron → `notFound()` natural
    pelo `!docSnap.exists`. Não precisa checar a janela aqui (mas checar
    `vendidoVisivel` é opcional defensivo; **decisão: não checar**, deixa o
    registro visível até o cron apagar).
- Quando `isVendido` e visitante (não `showInternalInfo`):
  - Aviso no bloco de preço: **"Este veículo já foi vendido..."**.
  - **Sem preço** — rótulo "Vendido" e um traço no lugar do valor. Sem badge de
    desconto/−%. (Time interno continua vendo o preço real.)
  - Trocar `<PropostaForm />` por um card estático: "Este veículo já foi
    vendido." + `<Link href="/#estoque">Ver veículos disponíveis</Link>`.
- `generateMetadata`: acrescentar "(vendido)" ao título quando `vendidoEm` — nice
  to have, não bloqueante.

### 10. `constants/changelog.ts`

Nova entrada **no topo** do array `CHANGELOG`, no mesmo commit da mudança
(convenção do arquivo):

```ts
{
  id: '2026-09-10-veiculos-vendidos',
  date: '2026-09-10',
  title: 'Veículos vendidos no site',
  tag: 'novo',
  items: [
    'No estoque, a visibilidade do veículo agora tem três opções: Disponível, Vendido e Privado.',
    'Ao marcar como "Vendido", o carro sai da vitrine principal e aparece numa seção "Vendidos" na home, com selo e preço riscado.',
    'Veículos vendidos ficam expostos por 30 dias e depois são removidos automaticamente (junto com as fotos).',
    'Dá pra voltar atrás a qualquer momento: mudar de "Vendido" para "Disponível" recoloca o carro no estoque e zera a contagem dos 30 dias.',
  ],
}
```

Texto final revisável no PR.

## Fluxos

### Marcar como vendido
1. Usuário com permissão abre o veículo no estoque → seletor → "Vendido".
2. `setVeiculoEstoqueEstado(id, 'vendido')` grava `vendidoEm = now`.
3. `revalidatePath('/')` → home some o card do grid de disponíveis e mostra na
   seção "Vendidos".
4. `/veiculos/[id]` passa a mostrar estado "vendido" para visitantes.

### Estornar (deixar de ser vendido)
1. Seletor → "Disponível".
2. `setVeiculoEstoqueEstado(id, 'disponivel')` grava `publico: true, vendidoEm: null`.
3. Volta ao grid normal. Prazo zerado — remarcar começa novos 30 dias.

### Baixa automática
1. Cron diário 12:30 → `GET /api/cron/limpar-vendidos` (Bearer `CRON_SECRET`).
2. `limparVeiculosVendidos()` busca `vendidoEm < now-30d`.
3. Para cada: `apagarVeiculoCompleto` (fotos + contratos + doc).
4. Resposta `{ ok, verificados, removidos, erros }` (logada pela Vercel).

## Erros / resiliência

- Cron sem `CRON_SECRET` ou header errado → 401 (igual lembretes).
- Falha ao apagar um veículo no loop → conta em `erros`, segue os demais; o doc
  fica e é tentado de novo no dia seguinte.
- Falha ao apagar uma foto/contrato individual dentro de `apagarVeiculoCompleto`
  → já é `console.error` e segue (comportamento atual do `deleteVehicle`
  preservado).
- `setVeiculoEstoqueEstado` em veículo inexistente → `{ error: 'Veículo não encontrado.' }`.
- Data `vendidoEm` corrompida → `vendidoVisivel` retorna `false` (não aparece no
  site) e o range do cron (`< cutoff`) provavelmente pega e apaga. Aceitável.

## Testes / verificação (manual, sem suíte automatizada no projeto)

1. **Marcar vendido** (veículo público) → some do grid da home, aparece em
   "Vendidos" com selo + preço riscado; card clica e abre detalhe sem form de
   proposta.
2. **Marcar vendido** (veículo privado) → aparece em "Vendidos" (vendidoEm vence);
   detalhe acessível a visitante deslogado.
3. **Estornar** → volta ao grid de disponíveis; contadores da home batem.
4. **Contadores** da home e do topo da aba de estoque não incluem vendidos.
5. **Cron local:** setar `vendidoEm` manualmente para 31 dias atrás num doc de
   teste, `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/limpar-vendidos`
   → doc some, fotos somem do Storage, resposta `removidos: 1`.
6. **Cron sem secret** → 401.
7. Mobile: seção "Vendidos" e selo legíveis (ver memória
   `fix-mobile-textos-quebrados-publico`).
8. `npm run build` / lint limpos.

## Arquivos tocados (resumo)

| Arquivo | Ação |
| --- | --- |
| `constants/veiculos.ts` | novo — `VENDIDO_TTL_DIAS` |
| `app/dashboard/veiculos/actions.ts` | `Veiculo.vendidoEm`, `getVehicles`, `createVehicle`, nova `setVeiculoEstoqueEstado`, remover `setVeiculoPublico`, extrair miolo de `deleteVehicle` |
| `utils/veiculos/apagar.ts` | novo — `apagarVeiculoCompleto` (`server-only`) |
| `app/dashboard/veiculos/public.ts` | `PublicVeiculo.vendidoEm`, `toPublicVeiculo`, `EstoqueEstado`, `estoqueEstadoDe`, `vendidoVisivel` |
| `app/page.tsx` | split disponíveis/vendidos, contadores, nova seção |
| `app/PublicSoldVehiclesList.tsx` | novo — grid de vendidos |
| `app/veiculos/[id]/page.tsx` | gate + estado "vendido" na UI |
| `app/dashboard/veiculos/VeiculosClient.tsx` | seletor de 3 estados, badge do card, contadores |
| `utils/veiculos/limpar-vendidos.ts` | novo — lógica do cron |
| `app/api/cron/limpar-vendidos/route.ts` | novo — rota do cron |
| `vercel.json` | 2º cron |
| `constants/changelog.ts` | nova entrada `2026-09-10-veiculos-vendidos` no topo |

## Questões em aberto

- Copy final: rótulo da seção "Vendidos" na home, texto do banner no detalhe,
  texto da entrada de changelog.
- Plano Vercel comporta o 2º cron? (confirmar antes do deploy)
- ~~Changelog nesta branch ou separada?~~ → **nesta branch** (item 10).
