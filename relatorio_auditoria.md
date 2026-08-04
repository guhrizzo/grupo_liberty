# Auditoria Técnica — Grupo Liberty Car

**Data da auditoria:** 03/08/2026
**Escopo:** Código-fonte completo do repositório `grupo_liberty` (site público + painel interno).
**Metodologia:** Leitura estática do código, análise de fluxos de autenticação/autorização, varredura de padrões (duplicação, queries, uso de `<img>`, etc.). Não foram feitas alterações no código — apenas leitura e análise.

---

## 1. Visão geral do projeto

**Liberty Car** é um sistema de gestão para uma revendedora de veículos (lojas em Jaú/SP e Bauru/SP), construído em **Next.js 16 (App Router) + React 19 + TypeScript**, com **Firebase** (Auth, Firestore, Storage) como backend principal, **Resend** para e-mails transacionais, **@react-pdf/renderer** para geração de contratos/propostas em PDF, e uma integração externa (**Puxa Placa**) para consulta de dados veiculares por placa.

O produto tem duas frentes:

1. **Site público** (`app/page.tsx`, `app/veiculos/[id]`): vitrine de veículos com filtros, galeria de fotos e formulário de proposta de compra (sem necessidade de login).
2. **Painel interno** (`app/dashboard/**`), protegido por login, com módulos de: Veículos, Consulta FIPE, Propostas, Contratos, Financeiro, Cobranças, Jurídico, Manutenção e Usuários — cada um com controle de acesso por **role** (`admin`, `vendedor`, `advogado`, `suporte`) e permissões finas por módulo.

O sistema também guarda dados sensíveis de clientes e vendedores (CPF, telefone, dados de financiamento, débitos do veículo) e gera documentos legais (contratos, autorizações) em PDF.

---

## 2. Resumo executivo

O projeto está funcional e razoavelmente bem estruturado (Server Actions, gates de permissão explícitos, validação de campos, PDF gerado no servidor). Porém a auditoria encontrou **um caminho de criação de conta não autenticado que concede acesso ao painel interno**, além de inconsistências no tratamento de dados sensíveis (CPF), consultas ao banco sem paginação (que não escalam), duplicação relevante de código e lacunas de SEO no site público (sem `robots.txt`, `sitemap.xml` ou dados estruturados).

Nenhum desses pontos foi corrigido — este documento é só o diagnóstico, organizado por prioridade.

---

## 3. 🔴 CRÍTICO

### 3.1 Server Action `signup` permite auto-cadastro não autorizado com acesso ao painel interno
**Arquivo:** `app/login/actions.ts:67-117`

A função `signup` cria um usuário no Firebase Auth e grava um perfil em `profiles` com `role: 'vendedor'` **fixo**, sem exigir aprovação de um admin:

```ts
export async function signup(formData: FormData) {
  ...
  await adminDb.collection('profiles').doc(localId).set({
    role: 'vendedor',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
}
```

Essa função **não é chamada por nenhum componente da UI** (`LoginForm.tsx` só usa `login` e `requestPasswordReset`) — mas isso não a torna inofensiva. Em Next.js, toda função exportada de um arquivo `'use server'` vira um endpoint HTTP invocável diretamente (a Server Action fica "viva" mesmo sem estar referenciada em nenhum JSX), independente de haver ou não um formulário apontando para ela.

Isso significa que **qualquer pessoa pode, sem login, criar uma conta com role `vendedor`** e, a partir daí, acessar via `/dashboard`: Propostas, Contratos, Financeiro e Cobranças (ver matriz de acesso em `app/components/DashboardShell.tsx:35-100` e `app/dashboard/layout.tsx`) — dados de clientes, propostas, valores e financiamento.

O fluxo "oficial" de criação de usuários (`app/dashboard/usuarios/actions.ts`) é corretamente protegido por `assertAdmin()` — o `signup` é um resquício que quebra essa garantia.

**Recomendação:** remover `signup` inteiramente (não está em uso) ou, se for necessário manter um fluxo de auto-cadastro, protegê-lo com convite/token de uso único e nunca atribuir uma role com acesso a dados internos por padrão.

### 3.2 Middleware de sessão não verifica assinatura do cookie
**Arquivo:** `utils/firebase/middleware.ts:3-47`

`updateSession()` decodifica o cookie `session` só com `atob`/`JSON.parse` (função `parseJwt`) e checa apenas o campo `exp` — **nunca valida a assinatura** do token, ao contrário de `getSessionUser()` e das Server Actions, que usam `adminAuth.verifySessionCookie()` (verificação criptográfica real via Firebase Admin).

Na prática, hoje o impacto é atenuado porque toda página/Server Action sensível **re-verifica** a sessão de forma correta (`app/dashboard/layout.tsx:22`, `utils/permissions.ts:37`) — então um cookie forjado passaria pelo middleware, mas seria barrado depois. Ainda assim, é uma trinca de confiança perigosa: qualquer código futuro que confie no middleware para decidir algo (ex.: um header, um redirect condicional, um cache) herda essa falha silenciosamente, e não há teste ou comentário no código alertando que a checagem é "só de UX".

**Recomendação:** verificar a assinatura no middleware (ou, no mínimo, documentar explicitamente que ele não deve ser usado como fonte de verdade de autenticação) e usar `session_verified` via chamada leve à Firebase Admin/Session API quando possível (Edge-compatible).

### 3.3 Nenhuma regra de segurança do Firestore/Storage rastreada no repositório
**Arquivos:** `firebase.json`, ausência de `firestore.rules` / `storage.rules`

`firebase.json` só referencia `firestore.indexes.json` — não há arquivo de regras versionado. Como o projeto também inicializa um **client SDK** do Firebase (`utils/firebase/client.ts`, com Auth/Firestore/Storage) além do Admin SDK, não é possível auditar, a partir do código, se as regras de segurança ativas no console do Firebase realmente impedem leitura/escrita direta do navegador nas coleções sensíveis (`propostas`, `veiculos`, `profiles`, `transacoes` etc.). Se as regras estiverem em modo permissivo (comum em projetos iniciados via console), qualquer usuário com a `apiKey` pública (exposta via `NEXT_PUBLIC_FIREBASE_API_KEY`) poderia ler/escrever diretamente no Firestore, contornando toda a lógica de Server Actions.

**Recomendação:** trazer `firestore.rules`/`storage.rules` para o repositório (fonte única da verdade, revisável em PR) e confirmar no console que estão em modo restritivo (deny-by-default), já que hoje o client SDK está inicializado mas aparentemente não é usado para leitura/escrita de dados (ver item 4.x abaixo) — o que sugere que dá para travar as regras bem apertado sem quebrar nada.

---

## 4. 🟠 ALTO

### 4.1 CPF tratado de forma inconsistente — texto plano em um lugar, criptografado em outro
Em `app/veiculos/[id]/actions.ts:64-65`, o CPF do cliente que envia uma proposta é criptografado antes de salvar:
```ts
const cpfCriptografado = encrypt(cpf.replace(/\D/g, ''))
```
Porém o campo `cpfCliente` do veículo (`app/dashboard/veiculos/actions.ts` — `createVehicle`/`updateVehicle`) e os campos `sellerCpf` são gravados **em texto plano** no Firestore, com validação apenas de tamanho (`cpfCliente.replace(/\D/g, '').length < 11`), sem sequer usar o validador matemático (`utils/validadorCpf.ts`) que já existe no projeto. O mesmo dado sensível (CPF) tem dois padrões de proteção diferentes dependendo de qual tela o gravou.

**Recomendação:** unificar — decidir se CPF será sempre criptografado em repouso (recomendado, dado que é dado pessoal sensível sob LGPD) e aplicar `encrypt()`/`validarCPF()` de forma consistente em todos os pontos de entrada (veículo, proposta, cadastro de usuário/vendedor).

### 4.2 Rota de peças de conserto sem gate de permissão específico
**Arquivo:** `app/api/veiculos/[id]/pecas-conserto/route.ts:18-38`

Diferente das rotas irmãs de PDF (`assertPodeGerarContratos`, `assertPodeGerarPropostaPDF`), esta rota só exige estar logado (`adminAuth.verifySessionCookie`), sem checar role/permissão. Qualquer usuário autenticado — inclusive um `vendedor` recém-criado via o bug 3.1 — consegue consultar dados internos de manutenção/custo de qualquer veículo.

**Recomendação:** aplicar o mesmo gate usado nas rotas de PDF (`assertPodeGerarPropostaPDF` ou equivalente) para manter consistência.

### 4.3 Exclusão de fotos/arquivos só funciona para um dos três hosts de imagem configurados
**Arquivo:** `app/dashboard/veiculos/actions.ts:551-566` (`deleteVehicle`) e `:752-769` (`updateVehicle`)

A lógica de remoção de fotos no Storage faz `url.split('storage.googleapis.com/')` para extrair o caminho do arquivo:
```ts
const parts = url.split('storage.googleapis.com/')
if (parts[1]) { ... await bucket.file(filePath).delete() }
```
Mas `next.config.ts:11-27` permite imagens de **três** hosts diferentes: `tdnioxrmhfhfvlfvuand.supabase.co`, `storage.googleapis.com` e `grupo-liberty.firebasestorage.app`. Para qualquer foto hospedada nos outros dois domínios, `parts[1]` fica `undefined`, o `if` é pulado silenciosamente e **o arquivo nunca é apagado do storage** — nem há log de aviso. Resultado: arquivos órfãos acumulando indefinidamente (custo de armazenamento) sempre que uma foto não estiver em `storage.googleapis.com`.

**Recomendação:** guardar o `storagePath` (não a URL pública) junto com o registro do veículo — como já é feito corretamente para `veiculo_contratos` (`storagePath` explícito) — em vez de tentar reconstruir o caminho a partir da URL.

### 4.4 Consultas ao Firestore sem paginação/limite em toda a aplicação
Exemplos (não exaustivo): `getVehicles()` (`app/dashboard/veiculos/actions.ts:176-178`), `getTransacoes()` (`app/dashboard/financeiro/actions.ts:73-76`), listagem de cobranças e parcelas (`app/dashboard/cobrancas/actions.ts:93-94`), `getAllUsersAction` (`app/dashboard/usuarios/actions.ts:55`), `listarTodosContratosVeiculoAction` (`app/veiculos/[id]/actions.ts:210-213`).

Nenhuma dessas chamadas usa `.limit()` — toda a coleção é lida e serializada a cada carregamento de página. Funciona bem com o volume atual de dados, mas não escala: conforme o estoque/histórico crescer, cada acesso ao dashboard fica mais lento e mais caro (cobrança do Firestore é por leitura de documento).

**Recomendação:** paginação server-side (cursor do Firestore) nas listagens do dashboard, começando pelos módulos com maior volume esperado (Propostas, Cobranças, Financeiro).

### 4.5 Homepage pública busca TODOS os veículos (inclusive dados internos) e filtra depois
**Arquivo:** `app/page.tsx:27-29`

```ts
const todosVeiculos = await getVehicles()
const veiculos = todosVeiculos.filter(v => v.publico === true)
```

`getVehicles()` traz também os veículos privados e **todos os campos internos** (CPF do cliente, débitos, dados de financiamento, dados do vendedor) para dentro do processo do servidor a cada acesso à home — para em seguida descartar a maior parte no filtro em memória. Embora esses dados não cheguem ao navegador (o filtro acontece antes da renderização), é uma consulta desnecessariamente cara e um manuseio desnecessário de dados sensíveis numa rota **pública e sem autenticação**.

**Recomendação:** filtrar no próprio Firestore (`where('publico', '==', true)`) e, idealmente, projetar só os campos necessários à vitrine pública.

### 4.6 Injeção de HTML no e-mail transacional via nome do cliente
**Arquivo:** `utils/email/templates/proposta-status.ts:97` + `app/veiculos/[id]/actions.ts` (nome vem de formulário público, validado só quanto ao tamanho mínimo)

```ts
<h1 ...>Olá, ${clienteNome}!</h1>
```

`clienteNome` vem do formulário público de proposta (`enviarPropostaAction`), validado apenas com `nome.length < 2` — sem sanitização de HTML — e é interpolado cru no template de e-mail enviado via Resend, tanto ao cliente quanto em cópia para a equipe interna (`CC_EMAIL`). Um nome contendo tags HTML quebra o layout do e-mail ou injeta conteúdo (ex.: um link de phishing) no e-mail visto pela equipe.

**Recomendação:** escapar entidades HTML (`&`, `<`, `>`, `"`, `'`) em qualquer valor de usuário interpolado nos templates de e-mail.

### 4.7 `createVehicle` / `updateVehicle` — ~230 linhas quase idênticas duplicadas
**Arquivo:** `app/dashboard/veiculos/actions.ts:300-527` e `:606-824`

As duas funções repetem, praticamente linha a linha, toda a extração de ~30 campos do `FormData` e as validações. Já há sinal de *drift* entre elas: `createVehicle` valida `cpfCliente`, `telefoneCliente`, `telefoneAcessoria`, `valorParcela`, `custoAcumulado`, `debitos`, `parcelasRestantes`, `taxaJuros` e `valorEntrada` (linhas 430-460); `updateVehicle` **não valida nenhum desses campos** (só marca/modelo/ano/preço/km/placa/renavam, linhas 698-732) — ou seja, hoje já é possível salvar um valor de parcela ou taxa de juros inválido ao **editar** um veículo, mesmo que a criação bloqueie isso.

**Recomendação:** extrair um único `parseVeiculoFormData(formData)` + `validateVeiculo(fields)` reutilizado pelas duas Server Actions.

### 4.8 Blocos `catch` vazios escondem falhas reais do Firestore em produção
**Arquivos (não exaustivo):** `app/dashboard/cobrancas/actions.ts:136` (`} catch {}` — literalmente vazio, nada é logado); `app/veiculos/[id]/actions.ts:166, 183, 206` (`catch { return [] }`); `app/dashboard/propostas/actions.ts:132-134, 238-240, 253-255` (`catch { }` só com comentário, sem `console.error`); `app/dashboard/manutencao/actions.ts:318-320`.

Em todos esses pontos, se a consulta ao Firestore falhar por qualquer motivo real (índice composto ausente, permissão negada, timeout), o código trata como se simplesmente não houvesse dados (`return []`), sem registrar o erro. Do ponto de vista do usuário e da operação, uma falha de infraestrutura fica indistinguível de "não há registros" — dificultando diagnosticar problemas em produção.

**Recomendação:** ao menos um `console.error` em cada `catch`, idealmente com um serviço de observabilidade (Sentry, etc.) para esses fallbacks silenciosos.

---

## 5. 🟡 MÉDIO

### 5.1 Dependências e componentes mortos
- `@supabase/ssr` e `@supabase/supabase-js` estão no `package.json` mas **não há nenhum import delas em todo o projeto** (confirmado por busca em `app`, `utils`, `constants`, `scripts`). `next.config.ts` ainda lista um host do Supabase Storage nos `remotePatterns`, indicando migração incompleta para Firebase.
- `three` (biblioteca 3D pesada) só é usada por `app/components/floating.tsx`, encapsulado por `app/components/FloatingLinesSafe.tsx` — que **não é importado em nenhum outro arquivo** do app. É código morto carregando uma dependência pesada no `package.json`/`node_modules`.

**Recomendação:** remover as dependências não usadas (`npm uninstall @supabase/ssr @supabase/supabase-js three @types/three`) e os arquivos órfãos, ou documentar por que devem ficar (ex.: feature planejada).

### 5.2 Ausência de `robots.txt` e `sitemap.xml`
Não existe `app/robots.ts`/`app/sitemap.ts` nem arquivos estáticos equivalentes. Para um site de vitrine cujo objetivo é ser encontrado no Google, isso significa depender só de crawling espontâneo, sem indicar explicitamente quais páginas indexar nem ajudar o Google a descobrir as páginas de veículo (`/veiculos/[id]`), que são geradas dinamicamente e não estão linkadas de nenhum índice central além da home.

**Recomendação:** adicionar `app/sitemap.ts` (listando `/` + todas as `/veiculos/[id]` públicas, via `getVehicles()` filtrado) e `app/robots.ts` liberando o público e bloqueando `/dashboard`.

### 5.3 Sem dados estruturados (JSON-LD) nas páginas de veículo
`app/veiculos/[id]/page.tsx` já tem um bom `generateMetadata` (title, description, Open Graph — linhas 17-64), mas não emite `schema.org` (`Vehicle`/`Product` + `Offer` com preço, condição, marca/modelo). Isso é prática padrão em sites de classificados de veículos e habilita rich snippets (preço, disponibilidade) no resultado de busca do Google — hoje esse ganho de CTR está sendo deixado na mesa.

### 5.4 Nenhuma ferramenta de analytics no site público
Não há Google Analytics/GTM/Meta Pixel em nenhum lugar do código. A equipe não tem como medir tráfego, origem dos visitantes, nem taxa de conversão de visita → proposta enviada.

### 5.5 Higiene do repositório — arquivos de debug versionados
Estão **rastreados pelo Git** (não cobertos pelo `.gitignore`) diversos artefatos de depuração, somando >1,2 MB:
`dump2-out.txt` (1,05 MB), `edge-resp.json`/`edge-resp-pretty.json`, `veiculo-detail.html`, `veiculo-detail2.html`, `veiculo-detail2-dom.html`, `header-block.html`, `dev.log`, `test-pdf.cjs`. Pelo conteúdo (dumps de HTML renderizado, respostas de rede), são claramente saídas de sessões de debug manual que acabaram comitadas.

**Recomendação:** remover do histórico (ou pelo menos do HEAD) e adicionar padrões ao `.gitignore` (`dev.log`, `*-out.txt`, `edge-resp*.json`, arquivos de debug soltos na raiz).

### 5.6 `VeiculoPicker.tsx` duplicado em dois módulos
`app/dashboard/cobrancas/VeiculoPicker.tsx` (193 linhas) e `app/dashboard/propostas/nova/VeiculoPicker.tsx` (194 linhas) são praticamente o mesmo componente reimplementado duas vezes — mesma lógica de busca/seleção de veículo, ambos usando `<img>` cru (ver 5.7).

**Recomendação:** mover para `app/components/` como componente único parametrizável.

### 5.7 Uso de `<img>` em vez de `next/image` em 3 pontos
`app/dashboard/cobrancas/CobrancasClient.tsx:1588`, `app/dashboard/cobrancas/VeiculoPicker.tsx:149`, `app/dashboard/propostas/nova/VeiculoPicker.tsx:152`. O restante do app usa corretamente `next/image` (`GalleryViewer`, `PublicVehiclesList`, `VeiculosClient`) — esses três pontos perdem otimização automática (lazy-load, resize, formato moderno).

### 5.8 Componentes cliente muito grandes
`CadastrarPropostaClient.tsx` (1818 linhas), `CobrancasClient.tsx` (1797), `VeiculosClient.tsx` (1737) concentram toda a lógica de tela + formulários + listagem num único componente `'use client'`, aumentando o bundle JS enviado ao navegador e dificultando manutenção/revisão de código.

**Recomendação:** quebrar em subcomponentes (formulário, tabela, filtros, modais) e mover o que não precisa de interatividade para Server Components.

### 5.9 `getSessionUser`/`assertAdmin` reimplementados em quase todo `actions.ts`
Praticamente idênticos em `app/veiculos/[id]/actions.ts`, `app/dashboard/veiculos/actions.ts`, `app/dashboard/financeiro/actions.ts`, `app/dashboard/usuarios/actions.ts`, entre outros — apesar de já existir `getSessionUser` centralizado e bem documentado em `utils/permissions.ts`. Essa duplicação é provavelmente a raiz do item 4.1 (CPF tratado diferente em lugares diferentes): sem um único ponto de autenticação/autorização, é fácil um arquivo ficar "para trás" em relação às regras dos outros.

**Recomendação:** consolidar tudo em `utils/permissions.ts` e importar dali.

### 5.11 Metadados de SEO incompletos além do que já existe
Complementando o item 5.2/5.3: não há `metadataBase` definido em `app/layout.tsx` — sem ele, URLs relativas de imagem Open Graph e a resolução de canonical ficam indefinidas/não confiáveis em produção. Nenhuma página define `alternates.canonical` (risco de conteúdo duplicado se `/veiculos/[id]` for acessível com query strings). A home (`app/page.tsx:9-12`) não tem bloco `openGraph` — só `title`/`description` — diferente da página de veículo, que já implementa isso corretamente. E o caso "veículo não encontrado" (`app/veiculos/[id]/page.tsx:24`) devolve só um título, sem `robots: { index: false }`, deixando o Google livre para indexar uma página de erro.

**Recomendação:** definir `metadataBase` no layout raiz, adicionar `canonical` e `openGraph` na home, e marcar `noindex` nas páginas de "não encontrado".

### 5.12 Rotas do dashboard sem `loading.tsx`
`app/dashboard/financeiro/`, `app/dashboard/cobrancas/`, `app/dashboard/propostas/nova/`, `app/dashboard/propostas/registros/` e `app/dashboard/consulta-fipe/` não têm `loading.tsx` (ao contrário de `veiculos`, `propostas`, `contratos`, `juridico`, `manutencao`, `usuarios`, que têm). Justamente `financeiro` e `cobrancas` são dos módulos com mais dados e consultas sem `.limit()` (ver 4.4) — são os que mais se beneficiariam de um fallback de streaming/skeleton enquanto a busca completa resolve.

### 5.13 Campos de busca/ordenação da vitrine pública sem rótulo acessível
**Arquivo:** `app/PublicVehiclesList.tsx:106-113` (busca) e `:116-126` (ordenação)

O `Input` de busca (`id="vehicle-search"`) e o `Select` de ordenação (`id="vehicle-sort"`) não recebem a prop `label` — e `app/components/ui/Input.tsx` só renderiza um `<label>` visível quando essa prop é passada. Na prática, esses dois controles de filtro da página mais importante do site (a vitrine) não têm nome acessível além do `placeholder`, o que é insuficiente para leitores de tela.

**Recomendação:** adicionar `label`/`aria-label` a ambos os campos.

### 5.14 `moneyFromNumber` duplicada com comportamento diferente em `masks.ts` e `financeiro/money.ts`
`utils/masks.ts:92-100` e `app/dashboard/financeiro/money.ts:63-66` definem **duas funções com o mesmo nome e a mesma assinatura** (`number | null | undefined → string`), mas com caminhos de arredondamento diferentes (`Math.round(n*100)` + `maskMoney` vs. `toLocaleString`). Ter duas implementações homônimas em módulos diferentes é uma armadilha real para um import trocado por engano no futuro (ex.: alguém importar a de `masks.ts` num contexto financeiro esperando o comportamento da outra).

**Recomendação:** manter uma única `moneyFromNumber` (em `utils/format.ts`, por exemplo) e remover a outra.

### 5.15 Uso extensivo de `any` na camada de Server Actions
92 ocorrências de `: any`/`as any` em 20 arquivos, concentradas justamente na camada que escreve no Firestore (`app/dashboard/veiculos/actions.ts`: 11, `financeiro/actions.ts`: 10, `manutencao/actions.ts`: 10, `usuarios/actions.ts`: 13, `juridico/actions.ts`: 9, `propostas/actions.ts`: 9). Destaque para `app/veiculos/[id]/page.tsx:76` — `const veiculo = { id: docSnap.id, ...docSnap.data() } as any` — o objeto que alimenta toda a página pública do veículo (preço, desconto, débitos, financiamento) não é checado pelo TypeScript a partir daí, incluindo campos financeiros mostrados só para a equipe interna (linhas 265-301).

**Recomendação:** tipar o retorno de `docSnap.data()` com a interface `Veiculo` já existente em `app/dashboard/veiculos/actions.ts`, e priorizar remover `any` na camada de Server Actions primeiro (é onde um erro de tipo tem mais chance de corromper dado gravado).

### 5.16 Firebase Admin inicializa silenciosamente sem credenciais se faltar variável de ambiente
**Arquivo:** `utils/firebase/admin.ts:15-30`

Se `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` não estiverem todas definidas, o código não lança erro — ele cai para `initializeApp({ projectId, storageBucket })` sem `credential`. O app sobe normalmente e só falha, de forma confusa, na primeira chamada real ao Firestore/Auth. Um erro claro na inicialização ("variável X ausente") pouparia tempo de diagnóstico, especialmente ao configurar um novo ambiente.

### 5.17 Chave de criptografia reaproveita a credencial do Firebase, com fallback inseguro
**Arquivo:** `utils/crypto.ts:5-9`

```ts
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.FIREBASE_PRIVATE_KEY || 'liberty-car-secret-salt-2026',
  'liberty-salt',
  32
)
```
Usar `FIREBASE_PRIVATE_KEY` como origem da chave de criptografia de CPF acopla dois segredos que deveriam ser independentes (rotacionar a credencial do Firebase muda silenciosamente a chave de criptografia, tornando CPFs já salvos ilegíveis). Além disso, se essa variável não estiver definida em algum ambiente, o código cai para uma string fixa **hardcoded no repositório público do código** — ou seja, qualquer CPF criptografado nesse cenário estaria protegido por uma chave conhecida.

**Recomendação:** variável de ambiente dedicada (`CPF_ENCRYPTION_KEY`), sem fallback — falhar explicitamente se ausente.

---

## 6. 🟢 BAIXO

- **`sanitizeFilename`/`sanitizeString` duplicados** em `app/api/contratos/[id]/pdf/route.ts`, `app/api/veiculos/[id]/contratos/[cid]/pdf/route.ts` e `app/veiculos/[id]/actions.ts` — mesma função reescrita 3 vezes com pequenas variações. Extrair para `utils/`.
- **Formatação de moeda (`Intl.NumberFormat('pt-BR', {style:'currency',...})`) repetida inline** em pelo menos `app/page.tsx`, `app/veiculos/[id]/page.tsx` e `app/PublicVehiclesList.tsx`, apesar de já existir `utils/format.ts` — checar se `formatCurrency` já existe lá e reaproveitar.
- **`AGENTS.md` aponta para `node_modules/next/dist/docs/`** como fonte de instruções — esse diretório é gerado pelo `npm install` e não é garantido permanecer estável entre atualizações/CI; melhor referenciar uma versão fixa da documentação oficial do Next.js correspondente à versão do `package.json` (`^16.2.10`).
- **`dev.log` versionado** (6,9 KB) — log de desenvolvimento não deveria estar no Git de forma alguma (ver também item 5.5).
- **`CobrancasClient.tsx` usa markup próprio para estado vazio** (linhas ~668-683) em vez do componente compartilhado `EmptyState`, usado pelos outros 8 componentes de dashboard (`VeiculosClient`, `PropostasClient`, `ManutencaoClient`, `FinanceiroClient`, `JuridicoClient`, `ContratosClient`, `UserManagementClient`, `PropostasRegistradasClient`) — pequena inconsistência visual/de padrão.
- **`app/login/actions.ts:38`** — no fluxo de login, mensagens de erro do Firebase não mapeadas caem num `else` que expõe o **código bruto** da API (ex.: `TOO_MANY_ATTEMPTS_TRY_LATER`) diretamente ao usuário, em vez de uma mensagem genérica; e a chamada usa `NEXT_PUBLIC_FIREBASE_API_KEY` sem checar se a variável existe antes de montar a URL do fetch (linha 19-21), ao contrário do padrão mais defensivo já usado em `app/api/consulta-placa/route.ts:101-107`.
- Código em geral está limpo quanto a alguns antipadrões comuns: não há `alert()`/`window.confirm()`, não há `dangerouslySetInnerHTML` e há poucos `console.log` esquecidos (fora do esperado em logs de erro) — vale reconhecer como ponto positivo. (Os `catch` vazios que existem estão detalhados no item 4.8, que é o único antipadrão desta lista que de fato aparece com frequência.)

---

## 7. Sugestões de funcionalidades (aumento de valor)

**Site público:**
- **Simulador de financiamento público** — o motor de cálculo (`utils/financing.ts`, Tabela Price) já existe e é usado internamente (`ProjecaoQuitacao.tsx`); expor uma versão simplificada na página do veículo aumentaria a conversão (cliente já vê a parcela estimada antes de enviar proposta).
- **Favoritos/comparador de veículos** (mesmo sem conta — via `localStorage`) e busca por faixa de preço/ano/km (hoje só há busca por texto + filtro de marca/câmbio).
- **Botão de contato direto via WhatsApp** com mensagem pré-preenchida por veículo, além do formulário de proposta.
- **Analytics** (GA4/Meta Pixel) para medir funil visita → proposta e origem de tráfego — pré-requisito para qualquer investimento em marketing.
- **SEO técnico:** `sitemap.xml`, `robots.txt` e JSON-LD (`Vehicle`/`Offer`) — ver seção 5.2/5.3.

**Painel interno:**
- **Paginação real** nas listagens (Propostas, Cobranças, Financeiro, Usuários) — necessário à medida que o volume cresce (ver 4.4).
- **Log de auditoria** (quem alterou o quê, quando) para veículos, propostas e contratos — hoje só existe `updated_at`, sem histórico nem autor da última alteração em vários módulos.
- **Exportação para Excel/CSV** dos módulos Financeiro e Cobranças, para reconciliação contábil externa.
- **Alertas automáticos de cobrança em atraso** — o módulo já modela parcelas (`cobranca_parcelas`); notificações por e-mail/WhatsApp quando uma parcela vence poderiam usar a mesma infra do Resend já configurada para propostas.
- **Relatórios por loja** (Jaú vs. Bauru) — o campo `localizacao` já existe no veículo; um dashboard comparativo por unidade é um desdobramento natural.
- **Assinatura eletrônica de contratos** — hoje o PDF de contrato é gerado e anexado manualmente; integrar um provedor de assinatura eletrônica fecharia o ciclo sem sair do sistema.

---

## 8. Tabela-resumo

| # | Item | Categoria | Prioridade |
|---|------|-----------|------------|
| 3.1 | `signup` cria conta com acesso ao painel sem autorização | Segurança/Bug | Crítico |
| 3.2 | Middleware não verifica assinatura do cookie de sessão | Segurança | Crítico |
| 3.3 | Regras do Firestore/Storage não versionadas/auditáveis | Segurança | Crítico |
| 4.1 | CPF ora criptografado, ora em texto plano | Segurança/Dados | Alto |
| 4.2 | Rota de peças de conserto sem gate de permissão | Segurança | Alto |
| 4.3 | Exclusão de foto falha silenciosamente p/ 2 de 3 hosts | Bug | Alto |
| 4.4 | Queries sem paginação em toda a app | Performance | Alto |
| 4.5 | Home pública busca todos os veículos p/ filtrar depois | Performance | Alto |
| 4.6 | HTML injetável no e-mail de proposta | Segurança | Alto |
| 4.7 | `createVehicle`/`updateVehicle` duplicados (com drift) | Duplicação/Bug | Alto |
| 4.8 | `catch {}` vazios escondem falhas do Firestore | Bug/Observabilidade | Alto |
| 5.1 | Dependências/componentes mortos (Supabase, three) | Manutenção | Médio |
| 5.2 | Sem `robots.txt`/`sitemap.xml` | SEO | Médio |
| 5.3 | Sem JSON-LD nas páginas de veículo | SEO | Médio |
| 5.4 | Sem analytics no site público | Produto | Médio |
| 5.5 | Arquivos de debug versionados (>1,2 MB) | Higiene | Médio |
| 5.6 | `VeiculoPicker` duplicado | Duplicação | Médio |
| 5.7 | `<img>` em vez de `next/image` (3 locais) | Performance | Médio |
| 5.8 | Componentes cliente muito grandes (>1700 linhas) | Performance/Manutenção | Médio |
| 5.9 | Auth helpers duplicados em cada `actions.ts` | Duplicação | Médio |
| 5.11 | `metadataBase`/canonical/OG da home ausentes | SEO | Médio |
| 5.12 | Rotas sem `loading.tsx` (financeiro, cobranças...) | Performance | Médio |
| 5.13 | Busca/ordenação da vitrine sem label acessível | UX/A11y | Médio |
| 5.14 | `moneyFromNumber` duplicada com comportamento diferente | Duplicação/Bug | Médio |
| 5.15 | Uso extensivo de `any` no server-action layer | Manutenção/Bug | Médio |
| 5.16 | Firebase Admin inicializa sem credencial silenciosamente | Bug | Médio |
| 5.17 | Chave de criptografia reaproveita credencial + fallback fraco | Segurança | Médio |
| 6.x | `sanitizeFilename` duplicado, formatação de moeda inline, `AGENTS.md` desatualizável, `dev.log` versionado, empty-state inconsistente, erro de login expõe código interno | Manutenção | Baixo |

---

*Relatório gerado por auditoria estática de código. Nenhum arquivo do projeto foi modificado.*
