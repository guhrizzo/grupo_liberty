# Plano de implementação — Anúncios de terceiros

**Spec:** `docs/superpowers/specs/2026-09-08-anuncios-terceiros-design.md`
**Branch:** `feat/anuncios-terceiros`
**Data:** 2026-09-08

Verificação global: `npm run build` limpo · `npm run lint` limpo · testes manuais
1–12 do spec. **Sem merge na master sem "ok".**

Antes de escrever qualquer código: ler em `node_modules/next/dist/docs/` os guias
de **Route Handlers**, **`request.formData()` / uploads** e **App Router
(pages/layouts/metadata)** — o projeto roda um Next.js com breaking changes
(AGENTS.md). Anotar no PR qualquer divergência relevante.

Convenções já existentes que este plano segue:
- Firestore/Storage via `@/utils/firebase/admin` (`adminDb`, `adminStorage`).
- CPF: `validarCPF` (`@/utils/validadorCpf`) + `encrypt`/`decrypt` (`@/utils/crypto`).
- Máscaras: `@/utils/masks` (`maskCPFCNPJ`, `maskPhone`, `maskMoney`, `parseMoney`, `onlyDigits`).
- E-mail: `resend` + template HTML string (ver `utils/email/`).
- Gate de página: `getSessionUser` + `hasPageAccess` (`@/utils/permissions`).
- Módulo de tipos sem `'use server'` separado do `actions.ts` (ver `app/dashboard/veiculos/public.ts`).
- Opções canônicas: câmbio `manual|automatico|cvt|automatizado`; combustível
  `flex|gasolina|etanol|diesel|eletrico|hibrido` (de `VeiculosClient.tsx`); cor =
  texto livre. Extrair para `utils/veiculos/opcoes.ts` no Passo 1 e reusar nos dois lados.

---

## Passo 1 — Tipos, opções e helper de permissão (sem UI)

**`utils/veiculos/opcoes.ts`** (novo, sem `'use server'`)
- `export const CAMBIO_OPCOES = [{ value:'manual', label:'Manual' }, …] as const`
- `export const COMBUSTIVEL_OPCOES = [ … ] as const`
- Refatorar `VeiculosClient.tsx` para consumir essas constantes nos `<Select>`
  (troca mínima, mantém os mesmos `value`s).

**`app/dashboard/anuncios/shared.ts`** (novo, sem `'use server'`)
```ts
export type AnuncioStatus = 'pendente' | 'recusado' | 'publicado' | 'no_estoque'

export interface Anuncio {
  id: string
  nome: string
  cpf: string            // MASCARADO na saída de getAnuncios (nunca cru)
  email: string
  telefone: string
  marca: string; modelo: string; ano: number
  cor: string; cambio: string; combustivel: string
  quilometragem: number
  precoDesejado: number
  observacoes: string
  placa: string | null
  fotos: string[]
  status: AnuncioStatus
  motivoRecusa: string | null
  veiculoId: string | null
  created_at: string
  updated_at: string
  decididoPor: string | null
  decididoEm: string | null
}

/** Dados editáveis na tela de revisão antes de aprovar. */
export interface RevisaoVeiculo {
  marca: string; modelo: string; ano: number
  cor: string; cambio: string; combustivel: string
  quilometragem: number
  preco: number
  descricao: string
  placa: string | null
  localizacao: string          // 'Jaú/SP' default
  fotos: string[]              // subconjunto/ordem das fotos do anúncio
}

export function serializeAnuncio(id: string, d: FirebaseFirestore.DocumentData): Omit<Anuncio,'cpf'> & { cpf: string }
```

**`utils/permissions.ts`**
- `UserPermissions` += `anuncios?: boolean`.
- Novo:
```ts
export async function assertPodeVerAnuncios(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')
  const ok = user.role === 'admin' || user.role === 'vendedor'
    ? user.permissions?.anuncios !== false
    : user.permissions?.anuncios === true
  if (!ok) throw new Error('Acesso negado. Você não tem permissão para ver anúncios.')
  return user
}
```
  (mesma semântica de `hasPageAccess(user,'anuncios',['admin','vendedor'])`;
  manter os dois consistentes.)

**`app/dashboard/veiculos/actions.ts`**
- Interface `Veiculo` += `terceiro: boolean` e
  `terceiroInfo: { nome:string; email:string; telefone:string; anuncioId:string } | null`.
- No mapping de `getVehicles()`:
  `terceiro: typeof data.terceiro === 'boolean' ? data.terceiro : false`,
  `terceiroInfo: data.terceiroInfo ?? null`.
- `toPublicVeiculo` / `PublicVeiculo` em `public.ts`: **não mexer** (garante que
  não vaza).

_Commit 1: `feat(anuncios): tipos, opções de veículo compartilhadas e gate de permissão`_

---

## Passo 2 — E-mail ao anunciante

**`utils/email/templates/anuncio-status.ts`** (novo) — espelha
`templates/proposta-status.ts`. `renderAnuncioStatusEmail({ nome, marca, modelo,
status, motivoRecusa?, veiculoUrl? })` → HTML string.

**`utils/email/send-anuncio-email.ts`** (novo) — espelha `send-proposta-email.ts`:
mesmo `FROM_EMAIL`/`CC_EMAIL`, `RESEND_API_KEY` guard, try/catch, retorna
`Promise<boolean>`, nunca lança.
```ts
export interface AnuncioEmailPayload {
  nome: string; email: string
  marca: string; modelo: string
  status: 'recusado' | 'publicado' | 'no_estoque'
  motivoRecusa?: string | null
  veiculoUrl?: string | null
}
```
Assuntos: ver tabela do spec (§ E-mails).

_Commit 2: `feat(anuncios): e-mail de status ao anunciante (Resend)`_

---

## Passo 3 — Endpoint público `POST /api/anuncios`

**`app/api/anuncios/route.ts`** (novo). `export const runtime = 'nodejs'`
(precisa de `firebase-admin`). Sem auth.

Fluxo:
1. `const form = await req.formData()`.
2. Honeypot: `form.get('website')` não-vazio → `return Response.json({ ok:true }, { status:200 })` sem gravar.
3. `ip` de `req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'desconhecido'`;
   `ipHash = createHash('sha256').update(ip).digest('hex')` (`node:crypto`).
4. Throttle: `adminDb.collection('anuncios').where('ipHash','==',ipHash).where('created_at','>', new Date(Date.now()-3600e3).toISOString())` — `try` com índice composto; `catch` → query só por `ipHash` e filtra em memória. `size >= 5` → `429`.
5. Extrai + valida campos (helper `parseAnuncioForm(form)` → `{ data, error }`):
   - strings `trim`; `nome` ≥ 2; `email` inclui `@`; `telefone` `onlyDigits` ≥ 10.
   - `cpf`: `onlyDigits`; `validarCPF` → senão `400`.
   - `ano` int em `[1900, ano+1]`; `quilometragem` int ≥ 0; `precoDesejado` = `parseMoney` > 0.
   - `cambio` ∈ `CAMBIO_OPCOES`; `combustivel` ∈ `COMBUSTIVEL_OPCOES`; `cor`, `marca`, `modelo`, `observacoes` não-vazios (`observacoes` ≤ 2000).
   - `placa`: se vier, regex `^[A-Z]{3}-?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$` (upper); senão `null`.
6. Fotos: `form.getAll('fotos').filter(f => f instanceof File && f.size > 0)`.
   `length` 1–10; cada `type.startsWith('image/')` e `size <= 8*1024*1024`. Erro → `400`.
7. `const ref = adminDb.collection('anuncios').doc()` (id antes do upload).
8. Para cada foto `i`: `adminStorage.bucket().file('anuncios/${ref.id}/${i}-${rand}.${ext}')`,
   `.save(buffer, { metadata: { contentType } })`, `.makePublic()`, `.publicUrl()`.
   Se uma falhar: apaga as já enviadas de `anuncios/${ref.id}/` e retorna `500`.
9. `ref.set({ ...data, cpf: encrypt(cpfDigits), fotos: urls, status:'pendente',
   ipHash, motivoRecusa:null, veiculoId:null, decididoPor:null, decididoEm:null,
   created_at, updated_at })`.
10. `Response.json({ ok:true }, { status:201 })`. Erros inesperados → `console.error` + `500 { error:'Não foi possível registrar seu anúncio. Tente novamente.' }`.

`firestore.indexes.json`: adicionar índice composto `anuncios` (`ipHash ASC`,
`created_at ASC`).

_Commit 3: `feat(anuncios): endpoint público POST /api/anuncios (honeypot + throttle + upload)`_

---

## Passo 4 — `PublicHeader` compartilhado

**`app/components/PublicHeader.tsx`** (novo). Server component (não usa estado);
recebe `user: { email?: string | null } | null`.
- Move o `<header className="sticky top-0 z-40 …">` de `app/page.tsx` (a versão
  mais completa) para cá.
- Props: `user`, `variant?: 'home' | 'inner'` (controla "Entrar no Painel" vs
  "Entrar", e mostrar/ocultar o e-mail do usuário — preservar o comportamento
  atual de cada página).
- Adiciona o botão **"Anuncie seu veículo"** (`Link href="/anuncie-seu-veiculo"`,
  `Button variant="secondary" size="sm"`, ícone `IconSpeakerphone`) antes do
  bloco login/dashboard.

Trocar em:
- `app/page.tsx`: `<PublicHeader user={user} variant="home" />` + `Button`
  secundário "Anuncie seu veículo" na hero, ao lado de "Ver Estoque".
- `app/veiculos/[id]/page.tsx`: `<PublicHeader user={user} variant="inner" />`.

Conferir visual nos dois (logado e deslogado).

_Commit 4: `refactor(site): extrai PublicHeader e adiciona CTA "Anuncie seu veículo"`_

---

## Passo 5 — Página e formulário público

**`app/anuncie-seu-veiculo/page.tsx`** (novo) — server component só com
`export const metadata` (title "Anuncie seu veículo | Liberty Car") + hero curto
+ `<AnuncioForm />`. `PublicLayoutWrapper` já mostra o footer (rota não-privada).

**`app/anuncie-seu-veiculo/PhotoUploadField.tsx`** (novo, client)
- `props: { fotos: LocalFoto[]; onChange(next): void; max?: number }`
  (`LocalFoto = { id:string; file:File; previewUrl:string }`).
- `<input type="file" accept="image/*" multiple>` → para cada arquivo:
  `compressImage(file)` via `<canvas>` (lado maior ≤ 1600px, `toBlob('image/jpeg', 0.8)`;
  se ainda > 1.5MB, re-tenta qualidade 0.6). Retorna novo `File`.
- Grid de miniaturas; remover; mover ↑/↓ (1ª = capa). Recusa > `max` (10) e
  não-imagem com `toast`.
- `revokeObjectURL` no unmount.

**`app/anuncie-seu-veiculo/AnuncioForm.tsx`** (novo, client)
- Estado por campo; `Input`/`Textarea`/`Select`/`Button`/`useToast` de `@/app/components/ui`.
- Selects de câmbio/combustível de `CAMBIO_OPCOES`/`COMBUSTIVEL_OPCOES`; cor =
  `Input` texto.
- Máscaras: CPF `maskCPFCNPJ`, telefone `maskPhone`, preço `maskMoney`, placa `maskPlate`.
- Honeypot: `<input name="website" className="sr-only-hp" tabIndex={-1} autoComplete="off" aria-hidden />`
  (CSS `position:absolute;left:-9999px;`).
- `validate()` no submit → primeiro erro vira `toast.error`; espelha o server
  (inclui `validarCPF`, 1–10 fotos).
- Submit: monta `FormData` (campos + `fotos` = arquivos comprimidos + `website`),
  `fetch('/api/anuncios', { method:'POST', body })`. `res.ok` → troca o form pelo
  painel de sucesso; `429`/`400`/`500` → `toast.error(json.error)`.
- Painel de sucesso: card "Anúncio recebido! Nossa equipe vai avaliar as
  informações e as fotos e entrar em contato pelo telefone ou e-mail informado."

_Commit 5: `feat(anuncios): página pública /anuncie-seu-veiculo com upload e compressão de fotos`_

---

## Passo 6 — Ações do dashboard

**`app/dashboard/anuncios/actions.ts`** (novo, `'use server'`) — toda ação inicia
com `await assertPodeVerAnuncios()`.

- `getAnuncios(): Promise<Anuncio[]>` — `orderBy('created_at','desc')`. Para cada
  doc: `cpf` = `maskCPFCNPJ(decrypt(d.cpf) ?? '')` (nunca cru). `catch` → `[]` + `console.error`.
- `recusarAnuncio(id: string, motivo?: string): Promise<{ success?; error?; emailSent? }>`
  - lê doc; exige `status === 'pendente'` (senão `error`).
  - `update({ status:'recusado', motivoRecusa: motivo?.trim() || null, decididoPor: user.uid, decididoEm: nowIso, updated_at: nowIso })`.
  - `revalidatePath('/dashboard/anuncios')`.
  - `emailSent = await sendAnuncioStatusEmail({ status:'recusado', … })`.
- `aprovarAnuncio(id: string, dados: RevisaoVeiculo, opts: { publicar: boolean }): Promise<{ success?; error?; veiculoId?; emailSent? }>`
  1. lê anúncio; exige `status === 'pendente'`.
  2. valida `dados` (marca/modelo não-vazios, `ano` no range, `preco > 0`,
     `cambio`/`combustivel` nas opções, `fotos` ⊆ `anuncio.fotos` e `length ≥ 1`).
  3. **copia** cada foto escolhida de `anuncios/<id>/…` para
     `fotos/<ts>-<rand>.<ext>` (`bucket.file(src).copy(dest)` + `dest.makePublic()`),
     coleta as novas URLs na ordem de `dados.fotos`. Falha no meio → apaga as
     cópias já feitas, retorna `error`.
  4. `veiculoRef = adminDb.collection('veiculos').doc()`; `set({ marca, modelo,
     ano, cor, cambio, combustivel, quilometragem: dados.quilometragem,
     preco: dados.preco, precoComDesconto:null, tabelaFipe:null, placa: dados.placa,
     renavam:null, descricao: dados.descricao, fotos: <copiadas>,
     localizacao: dados.localizacao || 'Jaú/SP', publico: opts.publicar,
     terceiro:true, terceiroInfo:{ nome, email, telefone, anuncioId:id },
     sellerName: nome, sellerCpf: encrypt(cpfDigits), sellerCity:null,
     cpfCliente:null, telefoneCliente:null, …demais campos financeiros null…,
     custoEfetivoTotal:null, debitos:null, debitosItens:[],
     created_by: user.uid, created_at: nowIso, updated_at: nowIso })`.
     (Espelhar o shape de `createVehicle` para não faltar campo que as telas leem.)
  5. `anuncioRef.update({ status: opts.publicar ? 'publicado' : 'no_estoque',
     veiculoId: veiculoRef.id, decididoPor: user.uid, decididoEm: nowIso, updated_at: nowIso })`.
  6. `revalidatePath('/dashboard/anuncios')`, `revalidatePath('/dashboard/veiculos')`,
     e se `publicar` também `revalidatePath('/')`.
  7. `veiculoUrl = opts.publicar ? \`${SITE_URL}/veiculos/${veiculoRef.id}\` : null`
     (usar a env de URL do site já usada nos e-mails/PDF; senão path relativo).
     `emailSent = await sendAnuncioStatusEmail({ status: opts.publicar ? 'publicado' : 'no_estoque', veiculoUrl, … })`.
- `excluirAnuncio(id: string): Promise<{ success?; error? }>`
  - exige `status` ∈ `['recusado','publicado','no_estoque']`.
  - apaga `anuncios/<id>/` do Storage (`bucket.deleteFiles({ prefix: \`anuncios/${id}/\` })`, best-effort try/catch).
  - `anuncioRef.delete()`; `revalidatePath('/dashboard/anuncios')`.
  - **nunca** toca `fotos/`.

_Commit 6: `feat(anuncios): server actions de triagem (recusar / aprovar / excluir)`_

---

## Passo 7 — Navegação, contador e permissão na tela de usuários

**`app/components/DashboardShell.tsx`**
- `NavItem.icon` union += `'megaphone'`; `NavIcon` case → `IconSpeakerphone`.
- `NAV_ITEMS` += `{ href:'/dashboard/anuncios', label:'Anúncios', icon:'megaphone',
  roles:['admin','vendedor'], permissionKey:'anuncios' }` (após "Propostas").
- Prop `anunciosPendentesCount?: number` (default 0); no `.map`, `count` também
  considera `item.href === '/dashboard/anuncios' ? anunciosPendentesCount : …`.

**`app/dashboard/layout.tsx`**
- Junto do bloco de `propostasPendentesCount`: se `['admin','vendedor'].includes(role)`,
  `anunciosPendentesCount = (await adminDb.collection('anuncios').where('status','==','pendente').get()).size`
  em try/catch com `console.error`. Passar para `<DashboardShell>`.

**`app/dashboard/usuarios/*`** — adicionar o toggle `anuncios` na lista de
permissões editáveis (seguir o mesmo array/UI que já rende `propostas`,
`contratos`, etc.; conferir `UserManagementClient.tsx` e `actions.ts`).

_Commit 7: `feat(anuncios): item de menu, contador de pendentes e permissão de usuário`_

---

## Passo 8 — Telas do dashboard

**`app/dashboard/anuncios/page.tsx`** (novo)
```tsx
const user = await getSessionUser()
if (!user) redirect('/login')
if (!hasPageAccess(user, 'anuncios', ['admin', 'vendedor'])) redirect('/dashboard?error=acesso_negado')
const anuncios = await getAnuncios()
return <AnunciosClient anuncios={anuncios} />
```
+ `export const metadata` + `app/dashboard/anuncios/loading.tsx` (Skeleton, padrão das outras abas).

**`app/dashboard/anuncios/AnunciosClient.tsx`** (novo, client) — estrutura visual
espelhando `PropostasClient.tsx`:
- filtros de status (`todos | pendente | recusado | publicado | no_estoque`),
  busca por nome e por veículo, contador de resultados, `EmptyState`.
- card por anúncio:
  - **Dono**: nome, CPF (já mascarado), `mailto:` no e-mail, telefone + botão
    WhatsApp (`getWhatsAppLink` adaptado: "Olá {nome}, recebemos o anúncio do seu
    {marca} {modelo} na Liberty Car!").
  - **Veículo**: marca/modelo/ano, km, cor, câmbio, combustível, preço desejado
    (`formatCurrency`), placa, observações (`whitespace-pre-line`).
  - **Fotos**: grid + `PhotoLightbox`.
  - **Status badge** (âmbar pendente / rose recusado / emerald publicado / sky no_estoque).
  - **Ações** se `pendente`: `Recusar` → abre modal com `<textarea>` motivo
    (opcional) → `recusarAnuncio`. `Aprovar` → abre `RevisarAnuncioModal`.
  - se decidido: badge do desfecho + (se `veiculoId`) `Link` "Ver veículo no
    estoque" `/dashboard/veiculos?veiculoId=…` (ou site se publicado); botão
    `Excluir` com `ConfirmDialog` → `excluirAnuncio`.
  - toasts + `router.refresh()`; toast extra "E-mail enviado ao anunciante"
    quando `emailSent`.

**`app/dashboard/anuncios/RevisarAnuncioModal.tsx`** (novo, client)
- Modal (overlay + `ZoomIn`, padrão do projeto). Form pré-preenchido a partir do
  anúncio: marca, modelo, ano, cor, câmbio (`Select`), combustível (`Select`),
  quilometragem, preço (`maskMoney`, inicia com `moneyFromNumber(precoDesejado)`),
  descrição (= `observacoes`), placa, localização (`Select` Jaú/SP · Bauru/SP,
  default Jaú/SP), e as fotos (checkbox + mover ↑/↓ para escolher quais e ordem).
- Rodapé: `[Só adicionar ao estoque]` (secundário) e `[Publicar no site]`
  (primário) → `aprovarAnuncio(id, dados, { publicar })`. Loading + fecha no
  sucesso + `router.refresh()`.
- Aviso: "O veículo entra no estoque marcado como *veículo de terceiro* (não é da Liberty)."

_Commit 8: `feat(anuncios): aba /dashboard/anuncios com lista, recusa e modal de revisão`_

---

## Passo 9 — Selo "Veículo de terceiro" no estoque

**`app/dashboard/veiculos/VeiculosClient.tsx`**
- Na lista/cards e no painel de detalhe: quando `v.terceiro`, badge âmbar
  "Veículo de terceiro — não é da Liberty".
- Um expander/tooltip com `v.terceiroInfo` (nome, e-mail, telefone) e `Link`
  para `/dashboard/anuncios`.
- Garantir que nada disso aparece nas telas/queries públicas (já garantido pelo
  `toPublicVeiculo` intacto — conferir no teste 9).

_Commit 9: `feat(anuncios): selo "veículo de terceiro" no estoque interno`_

---

## Passo 10 — Verificação final

Rodar os **testes manuais 1–12 do spec**. Resumo:
1. form público: CPF inválido barra (client e server); envio válido cria
   `anuncios` pendente, CPF cifrado, fotos em `anuncios/<id>/`.
2. honeypot preenchido → 200 fake, nada gravado.
3. 6º envio do mesmo IP em 1h → 429.
4. 11 fotos barra; imagem 12MB comprime e passa; PDF renomeado barra no server.
5. `suporte` não vê a aba; `vendedor` vê; badge de pendentes aparece e zera.
6. recusar com/sem motivo → status + e-mail (com motivo quando houver) + CC.
7. aprovar → publicar: ajustes na revisão aplicam; `veiculos` com `publico:true`,
   `terceiro:true`, `terceiroInfo`+`sellerCpf` OK, fotos em `fotos/`; aparece na
   home; anúncio `publicado`+`veiculoId`; e-mail com link certo.
8. aprovar → só estoque: `publico:false`, não aparece na home, selo no estoque,
   e-mail `no_estoque`.
9. **vazamento**: home + página do veículo publicado → sem CPF/e-mail/telefone
   do dono no HTML/payload.
10. excluir anúncio publicado → some da lista; `veiculos` e `fotos/` permanecem;
    `anuncios/<id>/` some.
11. aprovar duas vezes → 2ª falha, sem veículo duplicado.
12. `npm run build` e `npm run lint` limpos.

Depois: parar. Abrir PR só com "ok" do Gustavo.

---

## Sequência de commits (branch `feat/anuncios-terceiros`)

1. `feat(anuncios): tipos, opções de veículo compartilhadas e gate de permissão`
2. `feat(anuncios): e-mail de status ao anunciante (Resend)`
3. `feat(anuncios): endpoint público POST /api/anuncios (honeypot + throttle + upload)`
4. `refactor(site): extrai PublicHeader e adiciona CTA "Anuncie seu veículo"`
5. `feat(anuncios): página pública /anuncie-seu-veiculo com upload e compressão de fotos`
6. `feat(anuncios): server actions de triagem (recusar / aprovar / excluir)`
7. `feat(anuncios): item de menu, contador de pendentes e permissão de usuário`
8. `feat(anuncios): aba /dashboard/anuncios com lista, recusa e modal de revisão`
9. `feat(anuncios): selo "veículo de terceiro" no estoque interno`
2 spec commits (`c549465`, `617b425`) já estão na branch.

---

## Pendências / decisões que dependem de você

- **Regras do Firebase Storage**: o upload é feito pelo Admin SDK no servidor
  (ignora as rules), então nada a mudar no console — confirmar que o bucket
  aceita `makePublic()` (os uploads de veículo já fazem isso, então deve estar OK).
- **Índice composto** `anuncios (ipHash, created_at)` precisa ser criado no
  console do Firebase (ou via `firebase deploy --only firestore:indexes`) — o
  código tem fallback, mas o índice deixa o throttle eficiente. Adicionado ao
  `firestore.indexes.json` neste plano.
- **Env da URL do site** para o link no e-mail de "publicado" — reusar a mesma
  variável já usada em e-mails/PDFs (confirmar o nome na implementação;
  `grupolibertycar.com.br` é o domínio de produção pelo spec do app desktop).
- Copiar as fotos para `fotos/` (em vez de referenciar as do anúncio) é decisão
  do spec — dobra o armazenamento por anúncio aprovado (aceitável; ≤ 10 imagens
  comprimidas).
