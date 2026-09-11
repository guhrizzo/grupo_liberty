# Placa obrigatória + autofill no anúncio de terceiro

**Data:** 2026-09-10
**Status:** rascunho (aguardando revisão do spec)
**Branch:** `feat/anuncio-placa-obrigatoria` (a partir da `master`)
**Relacionado:** [`app/anuncie-seu-veiculo/AnuncioForm.tsx`](../../../app/anuncie-seu-veiculo/AnuncioForm.tsx), [`app/api/anuncios/route.ts`](../../../app/api/anuncios/route.ts), [`app/api/consulta-placa/route.ts`](../../../app/api/consulta-placa/route.ts), [`app/dashboard/anuncios/shared.ts`](../../../app/dashboard/anuncios/shared.ts), [`app/dashboard/anuncios/actions.ts`](../../../app/dashboard/anuncios/actions.ts), [`app/dashboard/anuncios/RevisarAnuncioModal.tsx`](../../../app/dashboard/anuncios/RevisarAnuncioModal.tsx), [`app/dashboard/veiculos/VeiculosClient.tsx`](../../../app/dashboard/veiculos/VeiculosClient.tsx) (padrão de autofill já existente), [`proxy.ts`](../../../proxy.ts), [`utils/rate-limit.ts`](../../../utils/rate-limit.ts)

## Problema / objetivo

No formulário público `/anuncie-seu-veiculo` (dono anuncia veículo de terceiro),
a placa é hoje **opcional** e marca/modelo/ano/cor/câmbio/combustível são
digitados manualmente pelo dono, um a um. O cadastro interno de veículos já
resolve isso puxando os dados pela placa (Sistema Puxa Placa) — o pedido é
trazer a mesma experiência pro formulário público: **placa obrigatória**, e a
partir dela o sistema **puxa automaticamente** marca/modelo/ano/cor/combustível
e a **Tabela FIPE**. O **preço desejado continua um campo separado**, digitado
pelo dono — nunca inferido ou influenciado pela FIPE.

Decisões de produto já tomadas (brainstorm 2026-09-10):

- **Endpoint público novo**, sem exigir login, com **rate-limit por IP**
  (a consulta por placa é uma API paga — `/api/consulta-placa` atual é
  restrita a admin/vendedor e não pode ser exposta como está).
- Depois do autofill, marca/modelo/ano/cor/câmbio/combustível **continuam
  editáveis** (igual ao cadastro do estoque hoje) — o dono pode corrigir.
- **Se a busca falhar** (placa não encontrada, API fora do ar, token não
  configurado, rate-limit): **libera preenchimento manual** como fallback. A
  placa continua obrigatória; só os dados do carro caem pro manual. Não
  bloqueia o envio do anúncio.
- **FIPE e Renavam são salvos** no anúncio (campos internos) para a triagem ver
  e aproveitar ao aprovar pro estoque — poupa reconsulta.

## Não-objetivos (nesta entrega)

- CAPTCHA ou verificação humana adicional no formulário (fora de escopo; a
  proteção aqui é rate-limit por IP, como o resto do site público).
- Exibir a Tabela FIPE ou o Renavam **para o dono** no formulário — ficam
  internos (evita ancorar o preço desejado na FIPE, mantém "preço desejado é
  algo à parte" como pedido).
- Alertas de roubo/furto, chassi, município/UF, tipo/espécie ou histórico de
  preços FIPE no formulário público — só a consulta interna
  (`/dashboard/consulta-fipe`, cadastro do estoque) continua vendo isso.
- Botão de "consultar placa de novo" manual — a busca é 100% automática ao
  completar a placa (mesmo padrão do `VeiculosClient`), sem UI de retry.
- Mudar o comportamento de `/api/consulta-placa` (uso interno) além de extrair
  a lógica compartilhada.
- Validar a placa contra a Receita/Detran além do que a própria consulta já
  retorna (não encontrado = segue fluxo manual, sem bloqueio).

## Arquitetura

### 1. Lógica de consulta compartilhada — `utils/veiculos/consulta-placa.ts` (novo)

Extrai de `app/api/consulta-placa/route.ts` (mantendo o comportamento atual
idêntico) o miolo puro: checar cache Firestore (`_cache_placa`, TTL 24h),
chamar a API do Puxa Placa, normalizar a resposta, gravar no cache.

```ts
import 'server-only'

export interface PuxaPlacaResult { /* mesmo shape de hoje */ }

export type ConsultaPlacaResultado =
  | { ok: true; data: PuxaPlacaResult & { fromCache: boolean; cachedAt?: string } }
  | { ok: false; status: number; error: string; code?: 'token_missing' }

/** Valida formato + consulta (cache-first). Não faz gate de auth — quem chama decide. */
export async function consultarPlaca(placaRaw: string): Promise<ConsultaPlacaResultado>
```

- `app/api/consulta-placa/route.ts` passa a: checar sessão/role (como hoje) →
  chamar `consultarPlaca` → devolver `data` tal qual (mesmo payload de hoje,
  **sem mudança de contrato** pro `PlacaFipeLookup`/`VeiculosClient`).
- Erros (`token_missing`, não encontrado, roubo/furto, upstream fora) mapeados
  pros mesmos status HTTP que a rota já devolve hoje.

### 2. Endpoint público — `GET /api/consulta-placa-publica` (novo)

```ts
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // 1. valida formato da placa (mesma regex) — 400 se inválida
  // 2. chama consultarPlaca(placa)
  // 3. em erro: repassa o status (404/502/503/500) com mensagem genérica
  // 4. em sucesso: devolve SÓ o subconjunto seguro
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

- **Sem checagem de sessão** — é a única rota do site que expõe essa consulta
  paga sem login, por isso o rate-limit (item 3) é obrigatório, não opcional.
- Nunca devolve: `chassi`, `rouboFurto`, `municipio`, `uf`, `especie`, `tipo`,
  `codigoFipe`, `referenciaFipe`, `historicoPrecFipe`, `logo`, `placa`
  (o cliente já sabe a placa que digitou).

### 3. Rate-limit — `proxy.ts`

Mesmo padrão do `PROPOSTA_LIMIT` já existente (envio de proposta pública):

```ts
const CONSULTA_PLACA_LIMIT = 8
const CONSULTA_PLACA_WINDOW_MS = 15 * 60 * 1000 // 15 minutos

if (pathname === '/api/consulta-placa-publica' && request.method === 'GET') {
  const cp = rateLimit(`consulta-placa:${ip}`, CONSULTA_PLACA_LIMIT, CONSULTA_PLACA_WINDOW_MS)
  if (!cp.allowed) return tooManyRequests(cp.retryAfterSeconds)
}
```

8/15min cobre re-digitação de placa com typo sem abrir brecha de custo — o
cache de 24h no Firestore já barra reconsulta da mesma placa.

### 4. `AnuncioForm.tsx`

- **Placa vira obrigatória**: label "Placa" (remove "(opcional)"),
  `containerClassName` sai do `sm:col-span-2` isolado — mantém no grid normal.
  `validar()` ganha `if (!placa.trim()) return 'Informe a placa do veículo.'`
  antes do check de formato já existente.
- Novo estado oculto (não renderizado): `tabelaFipe: number | null`,
  `renavam: string | null` — preenchidos só pelo autofill, nunca editados
  pelo dono.
- **Autofill automático** — mesmo padrão de `VeiculosClient.tsx`
  (`buscarDadosPlaca` + `useEffect` com debounce 600ms + `useRef` para não
  repetir a mesma consulta):
  ```ts
  const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
  const placaSemMascara = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const placaJaBuscadaRef = useRef('')
  const [buscandoPlaca, setBuscandoPlaca] = useState(false)

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
      if (data.valorFipe) setTabelaFipe(data.valorFipe)
      if (data.renavam) setRenavam(data.renavam)
      toast.success('Marca, modelo, ano, cor e combustível preenchidos automaticamente.', 'Placa encontrada')
    } catch {
      placaJaBuscadaRef.current = '' // permite tentar de novo se a placa mudar e voltar
      toast.error('Não conseguimos buscar os dados automaticamente. Preencha manualmente.', 'Busca indisponível')
    } finally {
      setBuscandoPlaca(false)
    }
  }, [toast])

  useEffect(() => {
    const limpa = placaSemMascara(placa)
    if (!PLACA_REGEX.test(limpa)) { placaJaBuscadaRef.current = ''; return }
    if (placaJaBuscadaRef.current === limpa) return
    const t = setTimeout(() => {
      placaJaBuscadaRef.current = limpa
      buscarDadosPlaca(limpa)
    }, 600)
    return () => clearTimeout(t)
  }, [placa, buscarDadosPlaca])
  ```
  - `normalizarCombustivel` — reaproveitar o mesmo helper que `VeiculosClient`
    usa pra mapear os valores do Puxa Placa pros valores aceitos por
    `COMBUSTIVEL_OPCOES` (mover pra um util compartilhado se hoje for uma
    função local do `VeiculosClient` — ver item 6).
  - Falha (qualquer erro: não encontrada, rate-limit, API fora, token ausente)
    → toast único e genérico, **sem bloquear nada**: os campos do carro
    seguem editáveis manualmente como já são hoje.
  - Indicador visual leve (`buscandoPlaca`) próximo ao campo Placa — um texto
    "Buscando…" ou o mesmo spinner que outros forms usam.
- `handleSubmit`: acrescenta `fd.append('tabelaFipe', tabelaFipe ? String(tabelaFipe) : '')`
  e `fd.append('renavam', renavam ?? '')`.

### 5. `/api/anuncios/route.ts` (`parseAnuncioForm`)

- Placa deixa de ser opcional:
  ```ts
  const placaRaw = str(form, 'placa').toUpperCase().replace(/\s/g, '')
  if (!placaRaw) return { error: 'Informe a placa do veículo.' }
  if (!PLACA_RE.test(placaRaw)) return { error: 'Placa inválida. Use ABC-1234 ou ABC1D23.' }
  const placa = placaRaw
  ```
  (`AnuncioData.placa` deixa de ser `string | null` e vira `string`.)
- Novos campos, ambos opcionais (podem faltar se o autofill falhou):
  ```ts
  const tabelaFipeRaw = str(form, 'tabelaFipe')
  const tabelaFipe = tabelaFipeRaw ? Number(tabelaFipeRaw) : null
  const renavam = str(form, 'renavam') || null
  ```
- `AnuncioData` ganha `tabelaFipe: number | null` e `renavam: string | null`;
  `ref.set(...)` grava os dois no doc de `anuncios`.

### 6. Tipos e triagem — `app/dashboard/anuncios/shared.ts`

- `Anuncio` ganha `tabelaFipe: number | null` e `renavam: string | null`.
- `RevisaoVeiculo` ganha os mesmos dois campos (editáveis na triagem, para
  corrigir antes de aprovar).
- `validarRevisaoVeiculo`: sem validação obrigatória nova — ambos continuam
  opcionais mesmo na revisão (nem todo anúncio antigo/fallback vai ter).

### 7. `app/dashboard/anuncios/actions.ts`

- `serializar()`: mapeia `tabelaFipe: d.tabelaFipe ?? null` e
  `renavam: d.renavam ?? null` a partir do doc de `anuncios`.
- `aprovarAnuncio()`: no `veiculoRef.set(...)`, troca os hoje fixos
  `tabelaFipe: null` e `renavam: null` por `dados.tabelaFipe` e
  `dados.renavam` (o que a triagem confirmou/editou no modal).

### 8. `RevisarAnuncioModal.tsx`

- Novo estado `tabelaFipe` (money-masked, `moneyFromNumber(anuncio.tabelaFipe)`)
  e `renavam` (`anuncio.renavam ?? ''`), inicializados do anúncio.
- Dois campos a mais no grid do modal: "Tabela FIPE (R$)" e "Renavam" — mesmo
  padrão visual dos outros `Input` do modal, não obrigatórios.
- `montarDados()` inclui os dois em `RevisaoVeiculo`.

## Fluxos

### Dono anuncia com placa válida e API disponível
1. Digita a placa → 600ms depois, `GET /api/consulta-placa-publica` (mesma
   placa nunca repete: `placaJaBuscadaRef`).
2. Sucesso → marca/modelo/ano/cor/combustível preenchidos (editáveis), FIPE e
   Renavam guardados em estado oculto, toast de confirmação.
3. Dono ajusta o que quiser, preenche cidade/UF/quilometragem/observações/fotos
   e o **preço desejado** (sempre manual).
4. Envia → `/api/anuncios` grava `tabelaFipe`/`renavam` junto.
5. Triagem vê os dois campos pré-preenchidos no `RevisarAnuncioModal` e, ao
   aprovar, eles vão pro veículo criado no estoque.

### Placa não encontrada / API fora / token ausente / rate-limit
1. Toast único: "Não conseguimos buscar os dados automaticamente. Preencha
   manualmente."
2. Campos do carro continuam vazios e editáveis — fluxo idêntico ao formulário
   de hoje, só que a placa já foi digitada e é obrigatória pra enviar.
3. `tabelaFipe`/`renavam` vão `null` no anúncio; a triagem revisa sem esses
   dados (como hoje).

### Triagem aprova anúncio antigo (antes desta mudança)
- `anuncio.tabelaFipe`/`anuncio.renavam` inexistentes no doc → `serializar()`
  cai no fallback `?? null` → modal mostra os campos vazios, editáveis
  normalmente. Nenhuma migração de dado necessária.

## Erros / resiliência

- `/api/consulta-placa-publica` sem `placa` ou formato inválido → 400,
  mensagem genérica (mesmo texto de erro de formato do form).
- Token do Puxa Placa não configurado → a rota pública responde com o mesmo
  status/erro que a interna hoje (503/`token_missing`), mas o client público
  não expõe esse detalhe ao dono — trata como qualquer falha (fallback manual).
- Firestore indisponível ao gravar cache → não deve derrubar a consulta (já é
  o comportamento hoje em `/api/consulta-placa`: loga e segue).
- Rate-limit estourado → 429, cliente trata como falha genérica (fallback
  manual) — **não** mostra "tente novamente mais tarde" pra não incentivar
  retry que reforça o próprio limite.
- `aprovarAnuncio` com `tabelaFipe`/`renavam` ausentes → grava `null` no
  veículo, igual ao comportamento atual.

## Testes / verificação (manual)

1. **Placa válida com dados na Puxa Placa** → autofill preenche
   marca/modelo/ano/cor/combustível; campos continuam editáveis; FIPE/Renavam
   não aparecem na tela; envio grava os dois campos no Firestore
   (conferir doc em `anuncios`).
2. **Placa sem cadastro** (404 da Puxa Placa) → toast de fallback, envio segue
   funcionando com preenchimento manual, `tabelaFipe`/`renavam` gravam `null`.
3. **Sem `PUXA_PLACA_TOKEN` configurado** (dev local) → mesmo comportamento do
   item 2, sem erro visível de configuração pro visitante.
4. **Placa vazia** → não deixa enviar (`validar()` bloqueia antes do POST).
5. **Rate-limit**: 9 requisições em <15min pro endpoint público do mesmo IP →
   a 9ª recebe 429 e o form cai no fallback manual sem travar.
6. **Cache**: buscar a mesma placa duas vezes em sequência → segunda vem
   `fromCache` (verificar no Firestore que não duplicou chamada à API paga —
   pode conferir via log/contagem, já que o campo `fromCache` não é exposto
   publicamente).
7. **`/api/consulta-placa` (uso interno, dashboard)** continua funcionando
   exatamente igual após a extração para `consultarPlaca` — regressão no
   cadastro do estoque e em `/dashboard/consulta-fipe`.
8. **Triagem**: aprovar um anúncio com FIPE/Renavam preenchidos → veículo
   criado no estoque tem `tabelaFipe`/`renavam` corretos (hoje ficam `null`
   sempre). Editar os campos no modal antes de aprovar reflete no veículo.
9. **Anúncio antigo** (sem os campos no doc) → aprovação não quebra, campos do
   modal aparecem vazios.
10. `npm run build` / lint limpos.

## Arquivos tocados (resumo)

| Arquivo | Ação |
| --- | --- |
| `utils/veiculos/consulta-placa.ts` | novo — lógica compartilhada de consulta (cache + Puxa Placa) |
| `app/api/consulta-placa/route.ts` | refatora pra usar `consultarPlaca`; contrato inalterado |
| `app/api/consulta-placa-publica/route.ts` | novo — endpoint público, sem auth, payload restrito |
| `proxy.ts` | rate-limit novo pro endpoint público (8/15min) |
| `app/anuncie-seu-veiculo/AnuncioForm.tsx` | placa obrigatória, autofill automático, campos ocultos FIPE/Renavam |
| `app/api/anuncios/route.ts` | placa obrigatória na validação; grava `tabelaFipe`/`renavam` |
| `app/dashboard/anuncios/shared.ts` | `Anuncio`/`RevisaoVeiculo` ganham `tabelaFipe`/`renavam` |
| `app/dashboard/anuncios/actions.ts` | `serializar` mapeia os campos; `aprovarAnuncio` usa em vez de `null` fixo |
| `app/dashboard/anuncios/RevisarAnuncioModal.tsx` | dois campos novos no modal de revisão |

## Questões em aberto

- Copy final dos toasts de sucesso/falha do autofill.
- Se `normalizarCombustivel` (hoje local a `VeiculosClient.tsx`) deve virar
  util compartilhado em `utils/veiculos/` — decisão no PR conforme o que o
  código já tiver quando for implementado.
