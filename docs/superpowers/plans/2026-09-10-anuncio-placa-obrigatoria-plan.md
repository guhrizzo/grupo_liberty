# Plano de implementação — Placa obrigatória + autofill no anúncio de terceiro

**Spec:** `docs/superpowers/specs/2026-09-10-anuncio-placa-obrigatoria-design.md`
**Branch:** `feat/anuncio-placa-obrigatoria` (já criada de `master`; spec commitado)
**Data:** 2026-09-10

Verificação global: `npm run build` limpo · `npm run lint` limpo · testes
manuais 1–10 do spec. **Sem merge na master sem "ok".**

Antes de escrever código: reler em `node_modules/next/dist/docs/` os guias de
**Route Handlers** (`dynamic = 'force-dynamic'`) e **Middleware/Proxy**
(`proxy.ts`, `config.matcher`) — Next.js 16 com breaking changes (AGENTS.md).
Anotar divergências no PR. (Já confirmado: `proxy.ts` roda antes de toda rota
coberta pelo `matcher`, incluindo `/api/*`.)

Convenções que este plano segue:
- Consulta por placa: cache-first em `_cache_placa` (Firestore, TTL 24h),
  depois API do Puxa Placa (`PUXA_PLACA_TOKEN`).
- Rate-limit público: `rateLimit(key, limit, windowMs)` de `utils/rate-limit.ts`,
  chamado em `proxy.ts` com `getClientIp(request)` (ver `PROPOSTA_LIMIT`).
- Autofill por placa no client: padrão de `VeiculosClient.tsx`
  (`buscarDadosPlaca` + debounce 600ms + `useRef` anti-repetição).
- Server actions em `app/dashboard/anuncios/actions.ts` (`'use server'`);
  tipos/validação síncronos em `shared.ts` (sem `'use server'`, mesmo motivo de
  `app/dashboard/veiculos/public.ts`).

---

## Passo 1 — Extrair a lógica de consulta para `utils/veiculos/consulta-placa.ts`

Puro refactor, sem mudar o comportamento de `/api/consulta-placa` — passo
isolado pra poder testar a regressão antes de acrescentar a rota pública.

**`utils/veiculos/consulta-placa.ts`** (novo, `import 'server-only'`)

Mover de `app/api/consulta-placa/route.ts`:
- A interface `PuxaPlacaResult`.
- `const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/` (renomear a constante
  do módulo pra não colidir com a da rota, se a rota mantiver validação própria
  — ver abaixo).
- `const CACHE_TTL_MS = 24 * 60 * 60 * 1000`.
- Todo o corpo de "2. Verificar cache" até "7. Salvar no cache", como uma
  função:
  ```ts
  export type ConsultaPlacaResultado =
    | { ok: true; data: PuxaPlacaResult & { fromCache: boolean; cachedAt?: string } }
    | { ok: false; status: number; error: string; code?: 'token_missing' }

  /** Valida formato e consulta (cache-first). Sem gate de auth — quem chama decide. */
  export async function consultarPlaca(placaRaw: string): Promise<ConsultaPlacaResultado> {
    const placa = placaRaw.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!PLACA_REGEX.test(placa)) {
      return { ok: false, status: 400, error: 'Formato de placa inválido. Use Mercosul (ABC1D23) ou antiga (ABC1234).' }
    }

    const cacheRef = adminDb.collection('_cache_placa').doc(placa)
    try {
      const cached = await cacheRef.get()
      if (cached.exists) {
        const data = cached.data() as PuxaPlacaResult & { _cachedAt: number }
        const age = Date.now() - (data._cachedAt ?? 0)
        if (age < CACHE_TTL_MS) {
          const { _cachedAt, ...result } = data
          return { ok: true, data: { ...result, fromCache: true, cachedAt: new Date(_cachedAt).toISOString() } }
        }
      }
    } catch (err) {
      console.warn('[consulta-placa] Erro ao ler cache:', err)
    }

    const token = process.env.PUXA_PLACA_TOKEN
    if (!token) {
      return { ok: false, status: 503, error: 'Token do Puxa Placa não configurado.', code: 'token_missing' }
    }

    try {
      const apiRes = await fetch(`https://api.puxaplaca.app/v2/consulta/${placa}`, {
        headers: { token, Accept: 'application/json' },
        cache: 'no-store',
      })
      if (apiRes.status === 401) return { ok: false, status: 502, error: 'Token do Puxa Placa inválido ou saldo insuficiente.' }
      if (apiRes.status === 404) return { ok: false, status: 404, error: 'Veículo não encontrado para a placa informada.' }
      if (apiRes.status === 406) return { ok: false, status: 400, error: 'Placa com formato inválido.' }
      if (!apiRes.ok) return { ok: false, status: 502, error: `Erro na API externa (status ${apiRes.status}).` }

      const raw = await apiRes.json()
      // ... (mesma normalização de hoje: basico/fipe/parseFipeValor/result)
      const result: PuxaPlacaResult = { /* idêntico ao route.ts atual */ }

      try { await cacheRef.set({ ...result, _cachedAt: Date.now() }) }
      catch (err) { console.warn('[consulta-placa] Erro ao salvar cache:', err) }

      return { ok: true, data: { ...result, fromCache: false } }
    } catch (err) {
      console.error('[consulta-placa] Erro na requisição externa:', err)
      return { ok: false, status: 500, error: 'Falha na comunicação com o Sistema Puxa Placa.' }
    }
  }
  ```

**`app/api/consulta-placa/route.ts`** — mantém a checagem de sessão/role
(linhas 1-60 de hoje: `ROLES_PERMITIDOS = ['admin', 'vendedor']`) e a validação
de `placa` ausente (`{ error: 'Placa não informada.' }`, 400 — isso continua
na rota, não move pro util, pois é sobre o parâmetro da query, não sobre a
placa em si). Troca o corpo (itens 3–7 de hoje) por:
```ts
const resultado = await consultarPlaca(placa)
if (!resultado.ok) {
  return NextResponse.json(
    resultado.code === 'token_missing'
      ? { error: 'token_missing', message: resultado.error }
      : { error: resultado.error },
    { status: resultado.status },
  )
}
return NextResponse.json(resultado.data)
```
**Contrato inalterado**: mesmo payload, mesmos status HTTP, mesmas mensagens —
`PlacaFipeLookup.tsx` e `VeiculosClient.tsx` não precisam de nenhuma mudança.

Verificação: `npm run build`; testar manualmente a consulta por placa logado
como admin em `/dashboard/consulta-fipe` — resultado idêntico a antes.

_Commit 1: `refactor(anuncios): extrai consultarPlaca para utils/veiculos/consulta-placa`_

---

## Passo 2 — Endpoint público `GET /api/consulta-placa-publica`

**`app/api/consulta-placa-publica/route.ts`** (novo)
```ts
import { NextRequest, NextResponse } from 'next/server'
import { consultarPlaca } from '@/utils/veiculos/consulta-placa'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const placaRaw = request.nextUrl.searchParams.get('placa')
  if (!placaRaw) {
    return NextResponse.json({ error: 'Placa não informada.' }, { status: 400 })
  }

  const resultado = await consultarPlaca(placaRaw)
  if (!resultado.ok) {
    // Sem distinguir motivo pro público — o client trata qualquer falha como
    // "cai pro manual". Status HTTP preservado só por semântica HTTP.
    return NextResponse.json({ error: 'Não foi possível buscar os dados desta placa.' }, { status: resultado.status })
  }

  const { data } = resultado
  return NextResponse.json({
    marca: data.marca,
    modelo: data.modelo,
    anoFabricacao: data.anoFabricacao,
    anoModelo: data.anoModelo,
    cor: data.cor,
    combustivel: data.combustivel,
    valorFipe: data.valorFipe,
    renavam: data.renavam,
  })
}
```
- Sem `cookies()`/checagem de sessão — rota pública.
- Payload restrito ao subconjunto do spec (sem chassi, roubo/furto,
  município/UF, código/referência FIPE, histórico, logo, placa).

_Commit 2: `feat(anuncio-placa): endpoint público GET /api/consulta-placa-publica`_

---

## Passo 3 — Rate-limit no `proxy.ts`

**`proxy.ts`** — acrescentar, junto às outras constantes de limite:
```ts
// Consulta por placa pública (app/anuncie-seu-veiculo) — API paga por trás,
// sem login. Cache de 24h no Firestore evita custo repetido da mesma placa;
// isto aqui só limita quantas placas diferentes um IP pode tentar.
const CONSULTA_PLACA_LIMIT = 8
const CONSULTA_PLACA_WINDOW_MS = 15 * 60 * 1000 // 15 minutos
```
No corpo de `proxy()`, junto aos outros `if (pathname ...)`:
```ts
if (pathname === '/api/consulta-placa-publica' && request.method === 'GET') {
  const cp = rateLimit(`consulta-placa:${ip}`, CONSULTA_PLACA_LIMIT, CONSULTA_PLACA_WINDOW_MS)
  if (!cp.allowed) return tooManyRequests(cp.retryAfterSeconds)
}
```
(mesma posição/estilo do bloco `PROPOSTA_LIMIT` já existente, logo depois dele).

Verificação: `curl` repetido (>8x em <15min) pro endpoint → 9ª chamada 429 com
header `Retry-After`.

_Commit 3: `feat(anuncio-placa): rate-limit (8/15min por IP) na consulta pública`_

---

## Passo 4 — `AnuncioForm.tsx`: placa obrigatória + autofill

**Novo estado** (perto dos outros `useState` do veículo):
```ts
const [tabelaFipe, setTabelaFipe] = useState<number | null>(null)
const [renavam, setRenavam] = useState<string | null>(null)
const [buscandoPlaca, setBuscandoPlaca] = useState(false)
const placaJaBuscadaRef = useRef('')
```

**Constantes** (topo do arquivo, junto de `PLACA_RE`):
```ts
const placaSemMascara = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
```
(`PLACA_RE` já existe — reaproveitar, é a mesma regex de 7 chars.)

**`normalizarCombustivel`** — copiar a função local de `VeiculosClient.tsx:72`
pra `AnuncioForm.tsx` (mesmo padrão de duplicação local que o projeto já usa
pra `PLACA_RE` em 4 arquivos; não vale a pena um util compartilhado só por
isso agora — ver "Questões em aberto" do spec).

**`buscarDadosPlaca`** (useCallback):
```ts
const buscarDadosPlaca = useCallback(async (placaLimpa: string) => {
  setBuscandoPlaca(true)
  try {
    const res = await fetch(`/api/consulta-placa-publica?placa=${placaLimpa}`)
    if (!res.ok) throw new Error()
    const data = await res.json()
    if (data.marca) setMarca(data.marca)
    if (data.modelo) setModelo(data.modelo)
    if (data.anoModelo) setAno(String(data.anoModelo))
    if (data.cor) setCor(data.cor)
    const comb = normalizarCombustivel(data.combustivel)
    if (comb) setCombustivel(comb)
    setTabelaFipe(typeof data.valorFipe === 'number' && data.valorFipe > 0 ? data.valorFipe : null)
    setRenavam(data.renavam || null)
    toast.success('Marca, modelo, ano, cor e combustível preenchidos automaticamente.', 'Placa encontrada')
  } catch {
    placaJaBuscadaRef.current = ''
    toast.error('Não conseguimos buscar os dados automaticamente. Preencha manualmente.', 'Busca indisponível')
  } finally {
    setBuscandoPlaca(false)
  }
}, [toast])
```

**Debounce automático** (useEffect, mesmo padrão de `VeiculosClient.tsx:567-580`):
```ts
useEffect(() => {
  const limpa = placaSemMascara(placa)
  if (!PLACA_RE.test(limpa)) {
    placaJaBuscadaRef.current = ''
    return
  }
  if (placaJaBuscadaRef.current === limpa) return

  const t = setTimeout(() => {
    placaJaBuscadaRef.current = limpa
    buscarDadosPlaca(limpa)
  }, 600)
  return () => clearTimeout(t)
}, [placa, buscarDadosPlaca])
```

**`validar()`** — antes do check de formato existente (linha ~88):
```ts
if (!placa.trim()) return 'Informe a placa do veículo.'
```

**Input da placa** (linha ~293-300) — remove "(opcional)" do label, adiciona
`required`, mantém `containerClassName="sm:col-span-2"`. Acrescenta indicador
leve de busca:
```tsx
<Input
  label="Placa"
  required
  mask="plate"
  value={placa}
  onChange={(e) => setPlaca(e.target.value)}
  placeholder="ABC-1234 ou ABC1D23"
  containerClassName="sm:col-span-2"
  hint={buscandoPlaca ? 'Buscando dados do veículo...' : undefined}
/>
```
(`Input` já aceita `hint` — confirmado em `app/components/ui/Input.tsx`.)

**`handleSubmit`** — acrescentar ao `FormData`:
```ts
fd.append('tabelaFipe', tabelaFipe != null ? String(tabelaFipe) : '')
fd.append('renavam', renavam ?? '')
```

Verificação: digitar uma placa válida com veículo cadastrado na Puxa Placa →
campos preenchem sozinhos, toast de sucesso, FIPE/Renavam não aparecem em
tela nenhuma; digitar placa inexistente → toast de fallback, campos seguem
editáveis vazios.

_Commit 4: `feat(anuncio-placa): placa obrigatória + autofill automático em AnuncioForm`_

---

## Passo 5 — `/api/anuncios/route.ts`: placa obrigatória + novos campos

**`parseAnuncioForm`** — troca o bloco atual (linhas ~102-107):
```ts
const placaRaw = str(form, 'placa').toUpperCase().replace(/\s/g, '')
if (!placaRaw) return { error: 'Informe a placa do veículo.' }
if (!PLACA_RE.test(placaRaw)) return { error: 'Placa inválida. Use ABC-1234 ou ABC1D23.' }
const placa = placaRaw
```
Acrescenta, antes do `return { data: {...} }`:
```ts
const tabelaFipeRaw = str(form, 'tabelaFipe')
const tabelaFipeNum = tabelaFipeRaw ? Number(tabelaFipeRaw) : null
const tabelaFipe = tabelaFipeNum !== null && Number.isFinite(tabelaFipeNum) && tabelaFipeNum > 0 ? tabelaFipeNum : null
const renavam = str(form, 'renavam') || null
```

**`interface AnuncioData`** — `placa: string | null` vira `placa: string`;
acrescenta `tabelaFipe: number | null` e `renavam: string | null`.

**`fingerprint(data)`** — sem mudança (já não usa `placa`).

**`POST` handler** — no `ref.set({...})`, acrescenta `tabelaFipe: data.tabelaFipe`
e `renavam: data.renavam` junto dos demais campos do veículo (perto de
`placa: data.placa`).

Verificação: enviar anúncio com placa válida (fluxo completo, com fotos) →
doc em `anuncios` tem `placa` (string, nunca null), `tabelaFipe`, `renavam`
gravados.

_Commit 5: `feat(anuncio-placa): placa obrigatória e tabelaFipe/renavam em /api/anuncios`_

---

## Passo 6 — Tipos e triagem: `shared.ts` + `actions.ts`

**`app/dashboard/anuncios/shared.ts`**
- `Anuncio`: acrescenta `tabelaFipe: number | null` e `renavam: string | null`
  (perto de `placa`).
- `RevisaoVeiculo`: mesmos dois campos, opcionais.
- `validarRevisaoVeiculo`: sem validação nova (ambos continuam facultativos).

**`app/dashboard/anuncios/actions.ts`**
- `serializar()`: acrescenta `tabelaFipe: d.tabelaFipe ?? null` e
  `renavam: d.renavam ?? null` (fallback `null` cobre anúncios antigos sem o
  campo no doc).
- `aprovarAnuncio()` → no `veiculoRef.set({...})` (linhas ~165-210), troca:
  ```ts
  tabelaFipe: null,
  ...
  renavam: null,
  ```
  por:
  ```ts
  tabelaFipe: dados.tabelaFipe,
  ...
  renavam: dados.renavam,
  ```

Verificação: `npx tsc --noEmit` — `RevisaoVeiculo` ganhando campos obrigatórios
(ou opcionais?) precisa bater com o que `RevisarAnuncioModal` vai montar no
Passo 7; decidir `tabelaFipe`/`renavam` como **opcionais** em `RevisaoVeiculo`
(`tabelaFipe?: number | null`) pra não quebrar nada que já monte o objeto sem
eles — mas como só há um lugar que monta (`montarDados()`), podem ser
obrigatórios (`number | null`, sem `?`) contanto que o Passo 7 sempre inclua.
**Decisão: obrigatórios (`number | null`)**, Passo 7 sempre preenche.

_Commit 6: `feat(anuncio-placa): tabelaFipe/renavam em Anuncio, RevisaoVeiculo e aprovarAnuncio`_

---

## Passo 7 — `RevisarAnuncioModal.tsx`: campos na triagem

- Novo estado, perto dos outros (linha ~43):
  ```ts
  const [tabelaFipe, setTabelaFipe] = useState(moneyFromNumber(anuncio.tabelaFipe ?? 0))
  const [renavam, setRenavam] = useState(anuncio.renavam ?? '')
  ```
- `montarDados()` (linha ~74-89) acrescenta:
  ```ts
  tabelaFipe: parseMoney(tabelaFipe) > 0 ? parseMoney(tabelaFipe) : null,
  renavam: renavam.trim() ? renavam.trim() : null,
  ```
- UI: dois `Input` a mais no grid (perto de "Placa", linha ~126+):
  ```tsx
  <Input
    label="Tabela FIPE (R$)"
    inputMode="decimal"
    value={tabelaFipe}
    onChange={(e) => setTabelaFipe(maskMoney(e.target.value))}
    placeholder="R$ 0,00"
  />
  <Input
    label="Renavam"
    value={renavam}
    onChange={(e) => setRenavam(e.target.value)}
    placeholder="000000000"
  />
  ```
  (checar imports: `maskMoney` já deve estar disponível no arquivo — usado
  para `preco`; se não, importar de `@/utils/masks`.)

Verificação: abrir um anúncio recém-enviado com FIPE/Renavam vindos do
autofill → modal mostra os dois pré-preenchidos; editar e aprovar → veículo
criado no estoque tem os valores editados (não os originais do anúncio).

_Commit 7: `feat(anuncio-placa): campos Tabela FIPE e Renavam no modal de revisão`_

---

## Passo 8 — Verificação final

Testes manuais do spec (`npm run dev`):

1. Placa válida com dados na Puxa Placa → autofill completo, FIPE/Renavam
   ocultos, envio grava os dois no Firestore.
2. Placa sem cadastro (404) → fallback manual, envio funciona, campos gravam
   `null`.
3. Sem `PUXA_PLACA_TOKEN` (comentar no `.env.local` local) → mesmo
   comportamento do item 2.
4. Placa vazia → não envia (`validar()` bloqueia antes do POST).
5. Rate-limit: >8 requisições em <15min pro endpoint público do mesmo IP → 9ª
   dá 429, form cai no fallback.
6. Cache: mesma placa duas vezes → segunda não dispara nova chamada à API paga
   (checar log/`fromCache` no doc de `_cache_placa`, já que não é exposto
   publicamente).
7. `/api/consulta-placa` interno (dashboard) continua idêntico —
   `/dashboard/consulta-fipe` e o autofill do cadastro do estoque sem regressão.
8. Triagem: aprovar anúncio com FIPE/Renavam → veículo criado tem os valores
   certos; anúncio antigo sem os campos → modal com campos vazios, aprovação
   não quebra.
9. Mobile: campo Placa (obrigatório, com indicador de busca) legível.
10. `npm run build` limpo; `npm run lint` limpo.

Depois: parar. Abrir PR só com "ok" do Gustavo.

---

## Sequência de commits (branch `feat/anuncio-placa-obrigatoria`)

Spec já commitado (`c234eb7`).

1. `refactor(anuncios): extrai consultarPlaca para utils/veiculos/consulta-placa`
2. `feat(anuncio-placa): endpoint público GET /api/consulta-placa-publica`
3. `feat(anuncio-placa): rate-limit (8/15min por IP) na consulta pública`
4. `feat(anuncio-placa): placa obrigatória + autofill automático em AnuncioForm`
5. `feat(anuncio-placa): placa obrigatória e tabelaFipe/renavam em /api/anuncios`
6. `feat(anuncio-placa): tabelaFipe/renavam em Anuncio, RevisaoVeiculo e aprovarAnuncio`
7. `feat(anuncio-placa): campos Tabela FIPE e Renavam no modal de revisão`

---

## Pendências / decisões que dependem de você

- Copy final dos toasts de sucesso/falha do autofill.
- `normalizarCombustivel` duplicada em `AnuncioForm.tsx` (copiada de
  `VeiculosClient.tsx`) — inevitável dado o padrão atual do projeto
  (`PLACA_RE`/`PLACA_REGEX` já duplicada em 4 lugares); posso extrair pra
  `utils/veiculos/opcoes.ts` se preferir, é um ajuste pequeno e opcional.
