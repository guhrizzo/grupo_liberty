# Anúncios de terceiros — dono anuncia veículo pelo site, Liberty faz a triagem

**Data:** 2026-09-08
**Status:** rascunho (aguardando aprovação)
**Branch:** `feat/anuncios-terceiros`
**Relacionado:** coleção `propostas` (fluxo espelhado, sentido inverso)

## Problema / objetivo

Hoje o site só mostra o estoque da Liberty e recebe **propostas de compra**
(`propostas`). O pedido é o inverso: uma pessoa de fora anuncia **o carro dela**
por uma página pública; o anúncio cai no sistema interno numa aba nova; e a
equipe (admin + vendedor) decide um de três caminhos:

1. **Recusar** o anúncio.
2. **Publicar direto no site** — o veículo entra no estoque e já aparece na
   vitrine pública.
3. **Aceitar e colocar no estoque** — o veículo entra no estoque como privado
   (não aparece no site ainda); a equipe publica depois quando quiser.

Nos caminhos 2 e 3 o veículo entra no estoque **marcado como "veículo de
terceiro" (não é da Liberty)** — selo visível só internamente.

Decisões de produto já tomadas (brainstorm 2026-09-08):

- Caminhos 2 e 3 diferem **apenas** em `publico = true/false`. Ambos criam um
  registro de veículo completo no estoque, com selo de terceiro.
- O selo "veículo de terceiro" é **só interno** (dashboard/estoque). O site
  público não distingue esses carros dos da Liberty.
- A aba nova é para **admin + vendedor** (mesma regra da aba Propostas, com
  chave de permissão configurável por usuário).
- O dono recebe **e-mail nos dois desfechos** (recusado e aceito/publicado),
  reaproveitando o Resend já configurado.
- Antes de publicar (caminho 2), o admin passa por uma **tela de revisão
  pré-preenchida** para conferir/ajustar preço, descrição, fotos etc.
- Formulário público em rota própria **e** botão "Anuncie seu veículo" no
  cabeçalho do site.
- Campos que o dono preenche: nome, CPF (com validação matemática), e-mail,
  telefone/WhatsApp; marca, modelo, ano, cor, câmbio, combustível,
  quilometragem, preço desejado, observações (todos obrigatórios); placa
  opcional; 1 a 10 fotos (mínimo 1).

## Não-objetivos (nesta entrega)

- Login/conta para o anunciante; página de "acompanhar meu anúncio".
- Vitrine pública separada de consignados; selo de terceiro no site público.
- Captcha (só honeypot + throttle por IP).
- Editar/reabrir anúncio já decidido.
- Integração com consulta de placa / FIPE no formulário público (pode vir
  depois).
- Qualquer alteração no fluxo de `propostas`.

## Arquitetura escolhida (Abordagem A)

Coleção nova `anuncios` isolada. Na aprovação, a triagem **cria um documento em
`veiculos`** — o estoque continua sendo a fonte única da verdade e a coleção
`veiculos` nunca recebe registro não-verificado vindo da rua.

```
Site público                          Sistema interno (dashboard)
────────────                          ───────────────────────────
/anuncie-seu-veiculo                  /dashboard/anuncios  (admin + vendedor)
  dono preenche + fotos                 lista de anúncios (pendentes / decididos)
       │                                     │
       ▼  POST /api/anuncios                 ├── Recusar ──► status: recusado + e-mail
  coleção `anuncios`                         │
  status: pendente  ───────────────────►     └── Aprovar ──► tela de revisão pré-preenchida
                                                              │
                                                              ├─ [Publicar no site] → cria `veiculos`
                                                              │                        terceiro:true, publico:true
                                                              │                        anúncio → publicado + e-mail
                                                              │
                                                              └─ [Só no estoque]    → cria `veiculos`
                                                                                       terceiro:true, publico:false
                                                                                       anúncio → no_estoque + e-mail
```

### Por que não as alternativas

- **Tudo dentro de `veiculos` com `origem:'anuncio'`**: polui `getVehicles()`,
  que alimenta home pública, dashboard, propostas e financeiro — risco de
  vazamento e de lixo no estoque.
- **`anuncios` como vitrine pública paralela**: os dois caminhos precisam
  aparecer no site igual aos outros carros; manter um front público paralelo
  dobra o trabalho sem ganho.

## Modelo de dados

### Coleção nova `anuncios`

| campo | tipo | observações |
|---|---|---|
| `nome` | string | dono do veículo; `trim`, ≥ 2 chars |
| `cpf` | string | **criptografado** com `encrypt()`; validado por `validarCPF()` no client e no server; guardado só dígitos antes de cifrar |
| `email` | string | contém `@` |
| `telefone` | string | ≥ 10 dígitos; usado para link WhatsApp |
| `marca` | string | obrigatório |
| `modelo` | string | obrigatório |
| `ano` | number | inteiro, 1900 .. ano atual + 1 |
| `cor` | string | obrigatório |
| `cambio` | string | obrigatório — mesmas opções do cadastro de veículo (`manual`/`automatico`/…) |
| `combustivel` | string | obrigatório — mesmas opções do cadastro (`flex`/`gasolina`/…) |
| `quilometragem` | number | inteiro ≥ 0 |
| `precoDesejado` | number | > 0 |
| `observacoes` | string | obrigatório, texto livre do dono (máx. ~2000 chars) |
| `placa` | string \| null | opcional; se vier, valida formato `ABC-1234` ou `ABC1D23` |
| `fotos` | string[] | 1 a 10 URLs públicas do Storage em `anuncios/<id>/` |
| `status` | `'pendente' \| 'recusado' \| 'publicado' \| 'no_estoque'` | inicial `pendente` |
| `motivoRecusa` | string \| null | opcional; incluído no e-mail de recusa |
| `veiculoId` | string \| null | preenchido na aprovação |
| `ipHash` | string | SHA-256 do IP de origem — anti-spam, não reversível |
| `created_at` | ISO string | |
| `updated_at` | ISO string | |
| `decididoPor` | string \| null | uid de quem recusou/aprovou |
| `decididoEm` | ISO string \| null | |

### `veiculos` — campos novos

| campo | tipo | observações |
|---|---|---|
| `terceiro` | boolean | default `false` (veículos existentes → `false` no mapping). `true` = não é da Liberty |
| `terceiroInfo` | `{ nome: string; email: string; telefone: string; anuncioId: string } \| null` | contato do dono. **Nunca** exposto publicamente |

Na aprovação também são preenchidos os campos de vendedor que já existem:
`sellerName` ← `nome`, `sellerCpf` ← `encrypt(cpf)`. `sellerCity` fica `null`
(não coletado do dono).

`getVehicles()` passa a ler `terceiro` (`typeof data.terceiro === 'boolean' ?
data.terceiro : false`) e `terceiroInfo` (`data.terceiroInfo ?? null`) e a
incluí-los no tipo `Veiculo`.

`toPublicVeiculo()` **não muda** — `terceiro` e `terceiroInfo` não entram no
`PublicVeiculo`, então nada vaza para páginas públicas.

### Fotos na aprovação

As fotos do anúncio (`anuncios/<id>/…`) são **copiadas** para `fotos/` (mesmo
diretório e padrão de nome de `uploadVehiclePhotos`), e as URLs copiadas é que
vão para `veiculos.fotos`. Assim o veículo fica idêntico a qualquer outro do
estoque e o anúncio mantém as originais como registro histórico. `excluirAnuncio`
só apaga `anuncios/<id>/` — nunca `fotos/`.

### Índices Firestore

- `anuncios` ordenado por `created_at desc` (lista do dashboard) → índice
  simples, já coberto.
- `anuncios` `where('status','==','pendente')` para o contador do menu → filtro
  de campo único, sem índice composto.
- `anuncios` `where('ipHash','==',x)` + `where('created_at','>',corte)` no
  throttle → **índice composto** `ipHash ASC, created_at ASC`. Adicionar a
  `firestore.indexes.json` com fallback no código (try/catch → query só por
  `ipHash` e filtra em memória), no mesmo padrão de
  `listarContratosVeiculoAction`.

## Site público

### Página `app/anuncie-seu-veiculo/page.tsx`

- Server Component só com `export const metadata` (title/description) + render de
  `<AnuncioForm />`. Sem sessão, sem dados do servidor.
- Não é rota privada (`PublicLayoutWrapper` já trata só `/dashboard`, `/login`,
  `/api` como privadas → o footer público aparece normalmente).

### `AnuncioForm.tsx` (client)

- Reusa `Input`, `Textarea`, `Select`, `Button`, `useToast` de
  `app/components/ui` e as máscaras `maskCPFCNPJ`, `maskPhone`, `maskMoney`,
  `parseMoney` de `utils/masks`.
- Seções: **Seus dados** (nome, CPF, e-mail, telefone) · **O veículo** (marca,
  modelo, ano, cor, câmbio, combustível, km, preço desejado, placa opcional,
  observações) · **Fotos**.
- Câmbio/combustível/cor como `Select` com as mesmas opções do formulário de
  veículo do dashboard (extrair a lista para um módulo compartilhado se ainda
  não existir, senão duplicar a constante com comentário).
- Validação no submit (toast no primeiro erro), espelhando o server:
  obrigatórios, `validarCPF(cpf)`, e-mail com `@`, telefone ≥ 10 dígitos, ano no
  intervalo, preço > 0, 1–10 fotos.
- Honeypot: `<input name="website" tabIndex={-1} autoComplete="off">` escondido
  via CSS (`position:absolute;left:-9999px`), rótulo "não preencha".
- Envio: `FormData` → `fetch('/api/anuncios', { method: 'POST', body })`. Sem
  server action (multipart grande num route handler é mais previsível e não
  esbarra em limite de server action).
- Sucesso → troca o formulário por um painel "Anúncio recebido! Nossa equipe vai
  avaliar as informações e as fotos e entrar em contato pelo telefone ou e-mail
  que você informou."

### `PhotoUploadField.tsx` (client)

- `<input type="file" accept="image/*" multiple>` + botão.
- Cada arquivo selecionado é **redimensionado/comprimido no navegador** via
  `<canvas>`: lado maior ≤ 1600px, JPEG qualidade ~0.8, alvo ≲ 1,5 MB. Mantém o
  total bem abaixo de qualquer limite e o Storage leve.
- Grid de miniaturas com botão remover; reordenação simples (mover ↑/↓) opcional
  — a 1ª foto é a capa.
- Recusa > 10 arquivos e arquivos não-imagem com toast.

### Route Handler `app/api/anuncios/route.ts`

- `export async function POST(req: Request)` — sem auth.
- Lê `await req.formData()`. Campos texto + `fotos` (múltiplos `File`).
- **Honeypot**: se `website` não vazio → responde `200 { ok: true }` (finge
  sucesso) e não grava nada.
- **Throttle**: `ipHash = sha256(ip)` (IP de `x-forwarded-for` / `x-real-ip`).
  Conta `anuncios` do mesmo `ipHash` na última 1h; ≥ 5 → `429 { error: 'Você já
  enviou vários anúncios recentemente. Aguarde um pouco e tente de novo.' }`.
- **Validação server** (revalida tudo; nunca confia no client): mesmos limites
  da tabela de dados. Erro → `400 { error }`.
- **Fotos**: 1–10; cada uma `image/*` e ≤ 8 MB (guarda-costas, já vêm
  comprimidas); grava via `adminStorage.bucket().file('anuncios/<id>/<i>-<rand>.<ext>')`,
  `makePublic()`, coleta `publicUrl()`.
- Cria doc em `anuncios` (`doc()` para ter o id antes, por causa do path das
  fotos), `status: 'pendente'`, `cpf` cifrado.
- Resposta `201 { ok: true }`. Erros de Storage/Firestore → `500 { error }` e
  `console.error`.
- Sem `revalidatePath` (nada público muda).

### Cabeçalho / hero

- [`app/page.tsx`](../../../app/page.tsx): no `<nav>` do header, botão "Anuncie
  seu veículo" (`variant="secondary"`, ícone `IconSpeakerphone`) antes do bloco
  de login/dashboard; e um `Button` secundário na hero ao lado de "Ver Estoque".
- Header do `app/veiculos/[id]/page.tsx` (se replica o mesmo `<header>`): mesmo
  botão. Se o header já for um componente compartilhado, mudar só nele.

## Dashboard

### Navegação e permissão

- [`utils/permissions.ts`](../../../utils/permissions.ts): adicionar
  `anuncios?: boolean` em `UserPermissions`; criar
  `assertPodeVerAnuncios(): Promise<SessionUser>` (admin **ou**
  `permissions.anuncios === true`; senão `throw`). Opcional: `canVerAnuncios(user)`
  síncrono no mesmo padrão de `canManageVeiculos`.
- [`DashboardShell.tsx`](../../../app/components/DashboardShell.tsx): novo
  `NavItem` `{ href: '/dashboard/anuncios', label: 'Anúncios', icon: 'megaphone',
  roles: ['admin','vendedor'], permissionKey: 'anuncios' }` + case no `NavIcon`
  (`IconSpeakerphone`). Badge de pendentes reusando exatamente o mecanismo do
  `propostasPendentesCount` (novo prop `anunciosPendentesCount`, mesma lógica de
  render do contador).
- [`app/dashboard/layout.tsx`](../../../app/dashboard/layout.tsx): calcular
  `anunciosPendentesCount` (`anuncios` where `status == 'pendente'`, `.get().size`)
  para `['admin','vendedor']`, try/catch com `console.error` como o de propostas.
- [`app/dashboard/usuarios/*`](../../../app/dashboard/usuarios): adicionar o
  toggle de permissão `anuncios` na tela de gestão (seguir o padrão dos toggles
  existentes).

### `app/dashboard/anuncios/page.tsx`

- `getSessionUser()` → `redirect('/login')` se nulo.
- `hasPageAccess(user, 'anuncios', ['admin','vendedor'])` → senão
  `redirect('/dashboard?error=acesso_negado')`.
- `getAnuncios()` → `<AnunciosClient anuncios={...} />`.
- `export const metadata` + `loading.tsx` (Skeleton, padrão das outras abas).

### `app/dashboard/anuncios/actions.ts` (`'use server'`)

Todas as ações começam com `await assertPodeVerAnuncios()`.

- **`getAnuncios(): Promise<Anuncio[]>`** — `orderBy('created_at','desc')`. CPF
  descriptografado e **re-mascarado** (`maskCPFCNPJ`) só na saída; nunca devolve
  CPF cru. Retorna `[]` em erro (`console.error`), padrão de `getPropostas`.
- **`recusarAnuncio(id: string, motivo?: string)`** —
  `{ success?; error?; emailSent? }`. Exige `status === 'pendente'` (senão
  `error`). Update `status: 'recusado'`, `motivoRecusa`, `decididoPor/Em`.
  `revalidatePath('/dashboard/anuncios')`. Dispara e-mail `recusado`.
- **`aprovarAnuncio(id, dados: RevisaoVeiculo, opts: { publicar: boolean })`** —
  `{ success?; error?; veiculoId?; emailSent? }`. Exige `status === 'pendente'`.
  Passos:
  1. valida `dados` (mesmas regras de `createVehicle` para os campos usados).
  2. copia as fotos escolhidas de `anuncios/<id>/` para `fotos/` (Admin SDK).
  3. cria doc em `veiculos`: `marca, modelo, ano, cor, cambio, combustivel,
     quilometragem, preco: precoDesejado (ou ajustado), descricao: observacoes
     (ou ajustada), placa, fotos (copiadas), localizacao` (default `'Jaú/SP'` —
     admin ajusta depois), `publico: opts.publicar`, `terceiro: true`,
     `terceiroInfo: { nome, email, telefone, anuncioId: id }`,
     `sellerName: nome`, `sellerCpf: encrypt(cpfDigits)`, `created_by: user.uid`,
     timestamps. Demais campos financeiros ficam `null`.
  4. update `anuncios/<id>`: `status: publicar ? 'publicado' : 'no_estoque'`,
     `veiculoId`, `decididoPor/Em`.
  5. `revalidatePath('/dashboard/anuncios')`, `revalidatePath('/dashboard/veiculos')`,
     e `revalidatePath('/')` quando `publicar`.
  6. e-mail `publicado` (com link `/veiculos/<veiculoId>`) ou `no_estoque`.
  - Se a cópia de fotos falhar no meio, tenta limpar os arquivos já copiados
    antes de retornar `error` (padrão do cleanup de `anexarContratoVeiculoAction`).
- **`excluirAnuncio(id: string)`** — só `status` em
  `['recusado','publicado','no_estoque']`. Apaga `anuncios/<id>/` do Storage
  (best-effort) e o doc. Nunca toca `fotos/`. `revalidatePath('/dashboard/anuncios')`.

### `AnunciosClient.tsx` (client)

- Estrutura visual espelhando `PropostasClient`: filtros por status
  (`todos/pendente/recusado/publicado/no_estoque`), busca por nome/veículo,
  contador de resultados.
- Card por anúncio:
  - **Dono**: nome, CPF mascarado, e-mail (`mailto:`), telefone com botão
    WhatsApp (`getWhatsAppLink`, texto adaptado: "Olá {nome}, recebemos o
    anúncio do seu {marca} {modelo} na Liberty Car!").
  - **Veículo**: marca/modelo/ano, km, cor, câmbio, combustível, preço desejado,
    placa, observações.
  - **Fotos**: grid + `PhotoLightbox`.
  - **Status badge** (âmbar/rose/emerald/neutro).
  - **Ações** (só se `pendente`): `Recusar` (abre `ConfirmDialog`/modal com
    textarea de motivo opcional) · `Aprovar` (abre `RevisarAnuncioModal`).
  - Se decidido: badge do desfecho + link "Ver veículo" quando há `veiculoId`;
    botão `Excluir` (com `ConfirmDialog`).
- Toasts de sucesso/erro + `router.refresh()` como em `PropostasClient`.

### `RevisarAnuncioModal.tsx` (client)

- Modal (ou rota dedicada `/dashboard/anuncios/[id]/revisar` se ficar grande) com
  formulário **pré-preenchido** pelos dados do anúncio: marca, modelo, ano, cor,
  câmbio, combustível, km, preço, descrição (= observações), placa, localização
  (`Select` Jaú/Bauru), seleção/ordem das fotos.
- Rodapé com dois botões de confirmação:
  - **"Publicar no site"** → `aprovarAnuncio(id, dados, { publicar: true })`.
  - **"Só adicionar ao estoque"** → `aprovarAnuncio(id, dados, { publicar: false })`.
- Aviso curto: "O veículo entra no estoque marcado como *veículo de terceiro*."

## Selo "Veículo de terceiro" (interno)

- Lista de veículos e página de detalhe **no dashboard**: badge âmbar "Veículo de
  terceiro — não é da Liberty" quando `terceiro === true`. Tooltip/expandível
  com `terceiroInfo` (nome, e-mail, telefone) e link para
  `/dashboard/anuncios` (ou o anúncio de origem via `anuncioId`).
- **Nada** no site público, nos PDFs, nem no payload `PublicVeiculo`.

## E-mails (Resend)

Novo `utils/email/send-anuncio-email.ts` + `utils/email/templates/anuncio-status.ts`,
espelhando `send-proposta-email.ts` / `templates/proposta-status.ts`. Mesmos
`FROM_EMAIL` e `CC_EMAIL`. Nunca lança (loga e retorna `boolean`); o toast do
dashboard mostra "E-mail enviado ao anunciante" quando `true`.

| status | assunto | corpo (resumo) |
|---|---|---|
| `recusado` | `Sobre o seu anúncio — {marca} {modelo} \| Liberty Car` | agradece o interesse, informa que não seguirão com este anúncio, inclui `motivoRecusa` se houver |
| `publicado` | `Seu veículo foi publicado — {marca} {modelo} \| Liberty Car` | confirma que o veículo está no site, com link; equipe entra em contato para alinhar |
| `no_estoque` | `Recebemos o seu veículo — {marca} {modelo} \| Liberty Car` | anúncio aceito, veículo registrado, equipe entra em contato para os próximos passos |

## Código compartilhado sem `'use server'`

`utils/anuncios/types.ts` (ou `app/dashboard/anuncios/shared.ts`) — interface
`Anuncio`, `AnuncioStatus`, `RevisaoVeiculo`, e helpers de serialização puros,
no mesmo padrão de [`app/dashboard/veiculos/public.ts`](../../../app/dashboard/veiculos/public.ts)
(um módulo `'use server'` não pode exportar tipos/funções síncronas).

## Segurança / privacidade

- CPF: validado (dígitos verificadores) no client e no server; guardado
  **sempre cifrado** (`encrypt`), exibido mascarado, nunca serializado cru para
  o client.
- Endpoint público sem auth: honeypot + throttle por `ipHash` (IP nunca gravado
  em claro). Sem PII em query string.
- `terceiroInfo` e `sellerCpf` nunca entram em `PublicVeiculo` nem em rota
  pública — cobrir com os testes abaixo.
- Upload público: só `image/*`, teto de tamanho, nomes de arquivo gerados pelo
  servidor (não o nome do cliente).

## Plano de testes (manual)

1. **Formulário público**: enviar com CPF inválido → bloqueia no client e, se
   forçado, no server. CPF válido + todos os campos + 3 fotos → sucesso; doc em
   `anuncios` com `status: pendente`, CPF cifrado, 3 URLs em `anuncios/<id>/`.
2. **Honeypot**: preencher o campo `website` via devtools → responde ok mas nada
   é gravado.
3. **Throttle**: 5 envios seguidos do mesmo IP → o 6º retorna 429.
4. **Fotos**: enviar 11 fotos → recusado; enviar imagem de 12 MB → comprime no
   client e passa; enviar um PDF renomeado → recusado no server.
5. **Menu/permissão**: usuário `vendedor` sem flag `anuncios` e sem default? —
   confirmar regra (vendedor tem por default). Usuário `suporte` **não** vê a
   aba. Badge de pendentes aparece e zera ao decidir.
6. **Recusar**: com e sem motivo → `status: recusado`, e-mail chega ao dono
   (com o motivo quando informado), CC para a equipe.
7. **Aprovar → Publicar no site**: ajustar preço e descrição na revisão,
   remover 1 foto → cria `veiculos` com `publico:true`, `terceiro:true`,
   `terceiroInfo` e `sellerCpf` preenchidos, fotos copiadas em `fotos/`;
   aparece na home; `anuncios` → `publicado` + `veiculoId`; e-mail `publicado`
   com link correto.
8. **Aprovar → Só no estoque**: cria `veiculos` com `publico:false`; **não**
   aparece na home; aba de veículos mostra o selo "veículo de terceiro"; e-mail
   `no_estoque`.
9. **Vazamento**: abrir a home e a página do veículo publicado → nenhuma
   referência a CPF, e-mail ou telefone do dono no HTML/payload.
10. **Excluir anúncio** publicado → some da lista; o `veiculos` e as fotos em
    `fotos/` **permanecem**; a pasta `anuncios/<id>/` é removida.
11. **Aprovar duas vezes**: segunda chamada (anúncio já não-`pendente`) →
    `error`, nenhum veículo duplicado.
12. `npm run build` limpo; `npm run lint` limpo.

## Pendências para o plano

- Confirmar se o `<header>` público é componente compartilhado ou está duplicado
  em `app/page.tsx` e `app/veiculos/[id]/page.tsx` (define se o botão entra em 1
  ou 2 lugares).
- Ler `node_modules/next/dist/docs/` (Route Handlers, `formData`, uploads) antes
  de escrever o endpoint — o projeto roda um Next.js com breaking changes
  (AGENTS.md).
- Verificar a lista canônica de opções de câmbio/combustível/cor no formulário
  de veículo do dashboard para reusar no formulário público.
- Definir se a revisão é modal ou rota própria conforme o tamanho do form.
