# Plano de implementação — Veículos vendidos

**Spec:** `docs/superpowers/specs/2026-09-10-veiculos-vendidos-design.md`
**Branch:** `feat/veiculos-vendidos` (já criada de `master`; spec commitado)
**Data:** 2026-09-10

Verificação global: `npm run build` limpo · `npm run lint` limpo · testes manuais
1–8 do spec. **Sem merge na master sem "ok".**

Antes de escrever código: reler em `node_modules/next/dist/docs/` os guias de
**Route Handlers** (`route.ts`, `dynamic = 'force-dynamic'`) e **`revalidatePath`**
— Next.js 16 com breaking changes (AGENTS.md). Anotar divergências no PR.
(Já conferido: route handler não é cacheado por padrão; `export const dynamic =
'force-dynamic'` é o padrão do projeto — ver `app/api/cron/lembretes-cobranca/route.ts`.)

Convenções que este plano segue:
- Firestore via `@/utils/firebase/admin` (`adminDb`, `adminStorage`).
- Datas: `new Date().toISOString()` (como `created_at`/`updated_at` em `actions.ts`).
- Server actions em `app/dashboard/veiculos/actions.ts` (`'use server'`, toda
  export `async`); mapeamento público síncrono em `public.ts` (sem `'use server'`).
- Cron: rota fina em `app/api/cron/<nome>/route.ts` só valida `CRON_SECRET`;
  lógica em `utils/<dominio>/<nome>.ts` (ver `utils/cobrancas/processar-lembretes.ts`).
- Cards públicos: markup no padrão de `app/PublicVehiclesList.tsx`.
- Toggle salvo isolado no estoque: padrão de `setVeiculoPublico` + `handleTogglePublico`.

---

## Passo 1 — Constante + helpers de estado/visibilidade

**`constants/veiculos.ts`** (novo)
```ts
/** Dias que um veículo "vendido" fica exposto no site antes de ser apagado de vez. */
export const VENDIDO_TTL_DIAS = 30
```

**`app/dashboard/veiculos/public.ts`** — acrescentar:
- `vendidoEm: string | null` em `PublicVeiculo`.
- `toPublicVeiculo`: `vendidoEm: v.vendidoEm`.
- ```ts
  export type EstoqueEstado = 'disponivel' | 'vendido' | 'privado'

  export function estoqueEstadoDe(
    v: { publico: boolean; vendidoEm: string | null },
  ): EstoqueEstado {
    if (v.vendidoEm) return 'vendido'
    return v.publico ? 'disponivel' : 'privado'
  }

  export function vendidoVisivel(
    vendidoEm: string | null | undefined,
    agora: number = Date.now(),
  ): boolean {
    if (!vendidoEm) return false
    const t = new Date(vendidoEm).getTime()
    return Number.isFinite(t) && agora - t <= VENDIDO_TTL_DIAS * 86_400_000
  }
  ```
  Import `VENDIDO_TTL_DIAS` de `@/constants/veiculos`.

_Commit 1: `feat(veiculos-vendidos): constante VENDIDO_TTL_DIAS e helpers de estado`_

---

## Passo 2 — Extrair exclusão completa para util reutilizável

**`utils/veiculos/apagar.ts`** (novo, `import 'server-only'`)

Mover para cá, de `app/dashboard/veiculos/actions.ts`:
- `extractFirebaseStoragePath(url: string): string | null` (hoje helper privado;
  passa a `export`).
- O miolo de `deleteVehicle` (sem auth, sem `revalidatePath`):
  ```ts
  /**
   * Apaga um veículo e todos os artefatos ligados: fotos no Storage,
   * documentos `veiculo_contratos` + seus PDFs, e o doc do veículo.
   * SEM checagem de permissão — o chamador garante (deleteVehicle após
   * assertPodeGerenciarVeiculos; cron via CRON_SECRET).
   */
  export async function apagarVeiculoCompleto(id: string): Promise<void>
  ```
  - Reaproveita os blocos "2", "2.5" e "3" atuais de `deleteVehicle`
    (fotos → `veiculo_contratos` batch → `docRef.delete()`).
  - Se o doc não existe, retorna sem erro (o cron pode ter concorrência).
  - Falha em foto/contrato individual: `console.error` e segue (comportamento atual).

**`app/dashboard/veiculos/actions.ts`** — ajustar:
- Remover a definição local de `extractFirebaseStoragePath`; importar de
  `@/utils/veiculos/apagar` (ainda usado em `updateVehicle`, ~linha 893).
- `deleteVehicle` vira:
  ```ts
  export async function deleteVehicle(id: string): Promise<{ success?: string; error?: string }> {
    try { await assertPodeGerenciarVeiculos() } catch (err: any) { return { error: err.message } }
    try {
      await apagarVeiculoCompleto(id)
      revalidatePath('/dashboard/veiculos')
      revalidatePath('/')
      return { success: 'Veículo removido com sucesso!' }
    } catch (error: any) {
      return { error: `Erro ao deletar veículo: ${error.message}` }
    }
  }
  ```
  (o `revalidatePath('/')` é novo — a home muda quando um veículo some.)
- Sem ciclo de import: `apagar.ts` não importa `actions.ts`.

Verificação: `npm run build` — checar que nada mais importava
`extractFirebaseStoragePath` de `actions.ts` (é privado hoje, então só uso interno).

_Commit 2: `refactor(veiculos): extrai apagarVeiculoCompleto para utils/veiculos/apagar`_

---

## Passo 3 — Campo `vendidoEm` e a action de estado

**`app/dashboard/veiculos/actions.ts`**

**a) Tipo + leitura**
- `Veiculo` interface: `vendidoEm: string | null` (perto de `publico`/`terceiro`).
- `getVehicles` mapper: `vendidoEm: data.vendidoEm ?? null`.

**b) `createVehicle`**
- Ler estado do form: `const estoqueEstadoRaw = (formData.get('estoqueEstado') as string) || ''`.
- Derivar (mantendo o `publico` legado como fallback quando `estoqueEstado` não vier):
  ```ts
  let vendidoEm: string | null = null
  let publicoFinal = publico            // já calculado hoje a partir de formData 'publico'
  if (estoqueEstadoRaw === 'vendido') { vendidoEm = now; publicoFinal = true }
  else if (estoqueEstadoRaw === 'privado') { publicoFinal = false }
  else if (estoqueEstadoRaw === 'disponivel') { publicoFinal = true }
  ```
  (`now` já existe no escopo do `try`; se `estoqueEstado` for lido antes do `try`,
  usar `new Date().toISOString()` na hora de montar `novoVeiculo`.)
- `novoVeiculo`: `publico: publicoFinal`, `vendidoEm`.

**c) Nova action `setVeiculoEstoqueEstado` — substitui `setVeiculoPublico`**
```ts
export async function setVeiculoEstoqueEstado(
  id: string,
  estado: 'disponivel' | 'vendido' | 'privado',
): Promise<VeiculoResponse> {
  try { await assertPodeGerenciarVeiculos() } catch (err: any) { return { error: err.message } }
  try {
    const docRef = adminDb.collection('veiculos').doc(id)
    const doc = await docRef.get()
    if (!doc.exists) return { error: 'Veículo não encontrado.' }

    const now = new Date().toISOString()
    const patch: Record<string, unknown> = { updated_at: now }
    let msg: string
    if (estado === 'vendido') {
      patch.vendidoEm = now
      msg = 'Veículo marcado como vendido.'
    } else if (estado === 'privado') {
      patch.publico = false
      patch.vendidoEm = null
      msg = 'Veículo agora está privado.'
    } else {
      patch.publico = true
      patch.vendidoEm = null
      msg = 'Veículo de volta ao estoque.'
    }
    await docRef.update(patch)
    revalidatePath('/dashboard/veiculos')
    revalidatePath('/')
    return { success: msg }
  } catch (error: any) {
    return { error: `Erro ao atualizar estado do veículo: ${error.message}` }
  }
}
```
- Remover `setVeiculoPublico` (só usada em `VeiculosClient.tsx`, trocada no Passo 4).
- `updateVehicle` **não** muda — não recebe nem grava `vendidoEm`; ao salvar o
  form inteiro de um veículo vendido, `publico` é reescrito mas `vendidoEm`
  permanece, então o veículo continua vendido. (Anotar no PR.)

_Commit 3: `feat(veiculos-vendidos): campo vendidoEm + action setVeiculoEstoqueEstado`_

---

## Passo 4 — Estoque: seletor de 3 estados

**`app/dashboard/veiculos/VeiculosClient.tsx`**

- Import: trocar `setVeiculoPublico` → `setVeiculoEstoqueEstado`; adicionar
  `import { estoqueEstadoDe, type EstoqueEstado } from './public'`.
- Estado: trocar `const [publico, setPublico] = useState(true)` por
  `const [estoqueEstado, setEstoqueEstado] = useState<EstoqueEstado>('disponivel')`.
  Renomear `publicoSaving`→`estadoSaving` (opcional, interno).
- `handleEdit` (~linha 611): `setPublico(veiculo.publico)` →
  `setEstoqueEstado(estoqueEstadoDe(veiculo))`.
- `resetForm` (~linha 478): `setPublico(true)` → `setEstoqueEstado('disponivel')`.
- `handleSubmit` (~linha 735): `formData.append('publico', String(publico))` →
  `formData.append('estoqueEstado', estoqueEstado)`.
  (manter também `formData.append('publico', String(estoqueEstado !== 'privado'))`
  como fallback pro caminho legado do `createVehicle`; ou remover se o Passo 3b
  cobrir — decisão: **manter**, custo zero.)
- `handleTogglePublico` → `handleSetEstoqueEstado(novo: EstoqueEstado)`:
  - `if (!editingId) { setEstoqueEstado(novo); return }`
  - otimista: guarda `anterior`, `setEstoqueEstado(novo)`, `setEstadoSaving(true)`,
    `await setVeiculoEstoqueEstado(editingId, novo)`; em `result.error` reverte
    (`setEstoqueEstado(anterior)`) + `setMessage`; em sucesso `setMessage` +
    `router.refresh()`. `finally` limpa `setEstadoSaving(false)`.
- **UI** (bloco ~1117-1158, "Visibilidade"): trocar o switch por um segmented
  control com 3 botões — `Disponível` / `Vendido` / `Privado`:
  - `role="radiogroup"`, cada botão `role="radio"` + `aria-checked`.
  - ativo: Disponível = verde (`bg-emerald-500 text-white`), Vendido =
    âmbar (`bg-amber-500 text-white`), Privado = neutro (`bg-neutral-800 text-white`);
    inativos: `bg-white text-neutral-600 border`.
  - `disabled={estadoSaving}`; "Salvando…" ao lado quando `estadoSaving`.
  - manter o comentário explicando que `vendido` vence a visibilidade.
- **Badge do card** (~2239-2247): usar `estoqueEstadoDe(v)`:
  - `disponivel` → verde "Disponível"
  - `vendido` → âmbar "Vendido"
  - `privado` → escuro "Privado"
- **Contador do topo** (~2160-2168): `totalPublicos` →
  ```ts
  const totalDisponiveis = useMemo(() => veiculos.filter(v => estoqueEstadoDe(v) === 'disponivel').length, [veiculos])
  const totalVendidos = useMemo(() => veiculos.filter(v => estoqueEstadoDe(v) === 'vendido').length, [veiculos])
  ```
  Texto: `· {totalDisponiveis} no site` + (se `totalVendidos > 0`) `· {totalVendidos} vendido(s)`.

Verificação: editar um veículo → alternar os 3 estados → cada um persiste
(recarregar a página confirma), card e contador refletem.

_Commit 4: `feat(veiculos-vendidos): seletor Disponível/Vendido/Privado no estoque`_

---

## Passo 5 — Home: separar disponíveis de vendidos + seção nova

**`app/PublicSoldVehiclesList.tsx`** (novo — server component, sem `'use client'`)
- Props `{ veiculos: PublicVeiculo[] }`. Ordena por `vendidoEm` desc.
- Grid `sm:grid-cols-2 lg:grid-cols-3`, gap igual ao estoque.
- Card = `<Link href={\`/veiculos/${v.id}\`}>` cobrindo tudo:
  - foto (`next/image`, `className="... grayscale"`), fallback `IconCar`.
  - selo **"VENDIDO"** — `absolute top-3 left-3`, `bg-neutral-900/90 text-white`,
    mesma pílula do card atual.
  - marca / modelo / ano / km (reaproveitar as classes do card de
    `PublicVehiclesList`).
  - preço **riscado**: se `precoComDesconto < preco`, riscar `precoComDesconto`;
    senão `preco`. `line-through text-neutral-400`. Sem badge de %.
  - sem `ShareButton`, sem botão "Ver detalhes".
- Sem estado vazio (a seção só renderiza quando há itens).

**`app/page.tsx`**
```ts
const todosVeiculos = await getVehicles()
const disponiveis = todosVeiculos
  .filter((v) => v.publico === true && !v.vendidoEm)
  .map(toPublicVeiculo)
const vendidos = todosVeiculos
  .filter((v) => vendidoVisivel(v.vendidoEm))
  .map(toPublicVeiculo)
```
- Import `vendidoVisivel` de `./dashboard/veiculos/public`.
- Trocar todos os usos de `veiculos` por `disponiveis` (trust strip linha ~80,
  contador ~107-108, `<PublicVehiclesList veiculos={disponiveis} />` ~110).
- Após `</section>` do `#estoque`, adicionar:
  ```tsx
  {vendidos.length > 0 && (
    <section id="vendidos" className="space-y-6">
      <div className="flex items-end justify-between gap-4 border-b border-neutral-200 pb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-neutral-400">
            Saíram do estoque
          </p>
          <h2 className="text-2xl md:text-3xl font-black text-neutral-900 mt-1">
            Vendidos recentemente
          </h2>
        </div>
        <span className="shrink-0 text-xs font-semibold text-neutral-500 whitespace-nowrap">
          {vendidos.length} {vendidos.length === 1 ? 'veículo' : 'veículos'}
        </span>
      </div>
      <PublicSoldVehiclesList veiculos={vendidos} />
    </section>
  )}
  ```
  (copy dos rótulos revisável no PR.)

_Commit 5: `feat(veiculos-vendidos): seção "Vendidos recentemente" na home`_

---

## Passo 6 — Página de detalhe do veículo vendido

**`app/veiculos/[id]/page.tsx`**
- Após montar `veiculo`: `const isVendido = !!veiculo.vendidoEm`.
- Gate (~linha 96): `if (!isPublic && !showInternalInfo) notFound()` →
  `if (!isPublic && !isVendido && !showInternalInfo) notFound()`.
  (veículo vendido além dos 30d já foi apagado → `!docSnap.exists` cobre.)
- Quando `isVendido && !showInternalInfo`:
  - No bloco de preço: rótulo "Preço à vista" → "Vendido"; envolver o valor em
    `<span className="line-through text-neutral-400">`; **não** renderizar o
    bloco de desconto/`−%`.
  - Banner acima da ficha: `<div>` âmbar/neutro "Este veículo já foi vendido."
  - Trocar `<PropostaForm .../>` (~linha 259) por card estático:
    "Este veículo já foi vendido." + `<Link href="/#estoque">Ver veículos disponíveis</Link>`.
    Para o time (`showInternalInfo`) manter o `PropostaForm` normal.
- `generateMetadata`: se `v.vendidoEm`, sufixo " (vendido)" no `title`. (nice-to-have)

_Commit 6: `feat(veiculos-vendidos): estado "vendido" na página pública do veículo`_

---

## Passo 7 — Cron de baixa automática

**`utils/veiculos/limpar-vendidos.ts`** (novo)
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
  const cutoff = new Date(Date.now() - VENDIDO_TTL_DIAS * 86_400_000).toISOString()
  const snap = await adminDb.collection('veiculos').where('vendidoEm', '<', cutoff).get()
  let removidos = 0
  let erros = 0
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
- Range sobre campo único `vendidoEm` — Firestore auto-indexa; **sem** mudança em
  `firestore.indexes.json`. Docs sem o campo não entram no resultado.

**`app/api/cron/limpar-vendidos/route.ts`** (novo) — cópia estrutural de
`app/api/cron/lembretes-cobranca/route.ts`:
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

**`vercel.json`** — 2º cron:
```json
{
  "crons": [
    { "path": "/api/cron/lembretes-cobranca", "schedule": "0 12 * * *" },
    { "path": "/api/cron/limpar-vendidos",   "schedule": "30 12 * * *" }
  ]
}
```

_Commit 7: `feat(veiculos-vendidos): cron diário que apaga vendidos após 30 dias`_

---

## Passo 8 — Changelog

**`constants/changelog.ts`** — nova entrada **no topo** de `CHANGELOG`:
```ts
{
  id: '2026-09-10-veiculos-vendidos',
  date: '2026-09-10',
  title: 'Veículos vendidos no site',
  tag: 'novo',
  items: [
    'No estoque, a visibilidade do veículo agora tem três opções: Disponível, Vendido e Privado.',
    'Ao marcar como "Vendido", o carro sai da vitrine principal e aparece numa seção "Vendidos recentemente" na home, com selo e preço riscado.',
    'Veículos vendidos ficam expostos por 30 dias e depois são removidos automaticamente (junto com as fotos).',
    'Dá pra voltar atrás: mudar de "Vendido" para "Disponível" recoloca o carro no estoque e zera a contagem dos 30 dias.',
  ],
}
```

_Commit 8: `chore(changelog): entrada "Veículos vendidos no site"`_

---

## Passo 9 — Verificação final

Testes manuais do spec (rodar `npm run dev`; ver memória `worktree-env-local` se
for worktree):

1. **Marcar vendido** (veículo público) → sai do grid da home, entra em "Vendidos
   recentemente" com selo + preço riscado; card abre `/veiculos/[id]` sem form de
   proposta, com banner "vendido".
2. **Marcar vendido** (veículo privado) → aparece em "Vendidos" (vendidoEm vence);
   `/veiculos/[id]` acessível a visitante deslogado.
3. **Estornar** (Vendido → Disponível) → volta ao grid; `vendidoEm` nulo;
   contadores da home e do topo do estoque batem.
4. **Contadores** — home ("Frota Disponível", trust strip) e topo do estoque não
   contam vendidos.
5. **Cron local:** setar `vendidoEm` de um doc de teste para 31 dias atrás →
   `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/limpar-vendidos`
   → doc some, fotos somem do Storage, resposta `{ removidos: 1 }`.
6. **Cron sem secret / secret errado** → 401.
7. **Mobile** — segmented control no estoque e seção "Vendidos" legíveis
   (ver `fix-mobile-textos-quebrados-publico`).
8. `npm run build` limpo; `npm run lint` limpo.

Depois: parar. Abrir PR só com "ok" do Gustavo.

---

## Sequência de commits (branch `feat/veiculos-vendidos`)

Spec já commitado na branch (`6284e06` + ajuste do item 10).

1. `feat(veiculos-vendidos): constante VENDIDO_TTL_DIAS e helpers de estado`
2. `refactor(veiculos): extrai apagarVeiculoCompleto para utils/veiculos/apagar`
3. `feat(veiculos-vendidos): campo vendidoEm + action setVeiculoEstoqueEstado`
4. `feat(veiculos-vendidos): seletor Disponível/Vendido/Privado no estoque`
5. `feat(veiculos-vendidos): seção "Vendidos recentemente" na home`
6. `feat(veiculos-vendidos): estado "vendido" na página pública do veículo`
7. `feat(veiculos-vendidos): cron diário que apaga vendidos após 30 dias`
8. `chore(changelog): entrada "Veículos vendidos no site"`

---

## Pendências / decisões que dependem de você

- **Plano Vercel** — o 2º cron só roda no Hobby se ainda houver cota (limite 2
  crons, 1×/dia). Confirmar antes do deploy; não bloqueia o desenvolvimento.
- **Copy** — rótulos "Saíram do estoque" / "Vendidos recentemente" na home,
  texto do banner na página de detalhe, texto da entrada de changelog.
- **`firestore.rules`** — coleção `veiculos` já é lida no servidor via Admin SDK
  (ignora rules). Só conferir que não há regra ampla expondo `vendidoEm` de forma
  indevida ao cliente (campo não é sensível, mas vale o olhar).
- **Veículo que era Privado + vendido + estornado** volta como **Público** (não
  guardamos a visibilidade anterior) — confirmado no spec como aceitável.
