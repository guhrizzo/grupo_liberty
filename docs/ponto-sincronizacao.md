# Registro de ponto — guia de implementação e sincronização

Este documento descreve o registro de ponto do projeto **grupo-liberty** (Next.js 16 + Firebase) para que o mesmo recurso seja implementado em outro projeto **com comportamento idêntico**. Versão de referência: commit `98ecdee` (18/11/2026).

> **Projeto com Supabase em vez de Firebase?** Siga este guia para as regras e para os arquivos que não dependem de banco, e use [ponto-supabase.md](ponto-supabase.md) para o banco (SQL), a sessão e as actions. O código da seção 9 que acessa `adminDb`/`adminAuth` é a versão Firebase.

> Regra de ouro: o que está em **"2. Contrato de sincronização"** e em **"9. Código de referência"** deve ser igual nos dois projetos. Todo o resto (telas, menu, componentes) pode ser adaptado ao visual de cada projeto.

---

## 1. Visão geral

Funcionários registram **4 batidas por dia**, nesta ordem fixa: `entrada → saida_almoco → volta_almoco → saida`.

Há duas formas de bater, e **as duas só funcionam no celular, dentro do raio da empresa**:

1. **QR code:** um computador da empresa exibe um QR que muda a cada 30 s. O funcionário lê o QR com a câmera do próprio site (botão "Escanear QR code") e a batida é registrada.
2. **Ponto digital:** botão "Bater ponto digital", sem QR. O celular informa a localização e o servidor só libera dentro do raio.

A **folha de ponto** (horas do mês, saldo, correção de batidas, jornada, Excel e PDF) é exclusiva dos ADMs supremos.

### Quem pode o quê

| Função | Quem | Aparelho |
| --- | --- | --- |
| Bater ponto (QR e digital) | só e-mails de `PONTO_FUNCIONARIOS_EMAILS` | **só celular/tablet** |
| Exibir o QR | só e-mails de `PONTO_FUNCIONARIOS_EMAILS` | **só computador** |
| Folha de ponto, correções, jornada, Excel/PDF | só ADM supremo (`ADM_SUPREMO_EMAILS`) | qualquer |

A detecção de aparelho é regra de uso (User-Agent), **não** segurança: quem trocar o User-Agent consegue contornar. A segurança real está no token do QR, no login e na checagem de localização feita no servidor.

---

## 2. Contrato de sincronização (deve ser idêntico nos dois projetos)

### 2.1 Fuso e dia
- Fuso: `America/Sao_Paulo`, offset fixo `-03:00` (o Brasil não tem horário de verão desde 2019).
- O "dia" do registro é a data `YYYY-MM-DD` em São Paulo (`hojeSaoPaulo`, ver seção 9). **Nunca** usar o relógio/UTC do servidor para definir o dia.
- O horário da batida é sempre o **do servidor** (`new Date().toISOString()`), nunca o do celular.

### 2.2 Coleções do Firestore

**`ponto_registros/{uid}_{AAAA-MM-DD}`** — um documento por funcionário por dia:

| Campo | Tipo | Observação |
| --- | --- | --- |
| `uid` | string | uid do Firebase Auth |
| `email`, `nome` | string | `nome` = displayName ou e-mail |
| `data` | string | `AAAA-MM-DD` (São Paulo) |
| `mes` | string | `AAAA-MM` (usado para consultar o mês sem índice composto) |
| `batidas` | map | chaves `entrada`, `saida_almoco`, `volta_almoco`, `saida`; valor = ISO 8601 UTC |
| `origens` | map | mesma chave de `batidas`; valor `qr` \| `digital` \| `manual` (registros antigos não têm: tratar como QR) |
| `distancias` | map | metros até a empresa, para batidas `qr`/`digital` |
| `jornadaMin` | number | jornada esperada **copiada no dia em que o documento é criado** |
| `edicoes` | array | histórico das correções do ADM: `{ porUid, porEmail, em, campo, de, para, motivo }` |

**`ponto_config/{uid}`** — `{ jornadaMin, atualizadoEm, atualizadoPor }` (padrão 480 min = 8h; mínimo 30 min, máximo 960 min).

### 2.3 Regras de negócio
- Ordem fixa das batidas; não repete nem pula etapa; dia com 4 batidas não aceita mais.
- Intervalo mínimo entre duas batidas do mesmo funcionário: **2 minutos**.
- Gravação em **transação** do Firestore (`runTransaction`), com `tx.update` se o doc existe e `tx.set` se não.
- Total do dia = `(saida_almoco − entrada) + (saida − volta_almoco)`. Dia com menos de 4 batidas é **incompleto**: sem total e sem saldo, destacado na folha.
- Saldo do dia = total − `jornadaMin` do próprio registro. Total do mês = soma dos dias completos; dias incompletos não entram nas horas.
- Correção do ADM: exige motivo (mínimo 3 caracteres), não aceita data futura, exige horários em ordem cronológica, grava em `edicoes`, marca a batida como `manual` e remove a distância dela. Hora vazia apaga a batida.
- Mudar a jornada vale só para dias ainda sem registro; dias já criados mantêm a jornada da época.

### 2.4 Token do QR (algoritmo exato)
- Janela de **30 s**: `janela = floor(Date.now() / 30000)`.
- Token: `"<janela>.<hmac>"`, com `hmac = HMAC-SHA256(PONTO_QR_SECRET, "ponto:<janela>")` em hexadecimal.
- Válido na janela atual e na anterior (≈ 30–60 s). Comparação em tempo constante.
- O token identifica a empresa, não a pessoa; a pessoa vem da sessão.
- **Se os dois projetos compartilham o mesmo `PONTO_QR_SECRET`**, um QR gerado em um é aceito no outro. Se não é isso que você quer, use segredos diferentes.
- O QR codifica `https://<dominio>/dashboard/ponto/bater?t=<token>`. O leitor do site só aceita QR cuja origem seja o próprio domínio e cujo caminho seja `/dashboard/ponto/bater`.

### 2.5 Localização
- Centro: `PONTO_EMPRESA_LAT` / `PONTO_EMPRESA_LNG`; raio `PONTO_RAIO_M` (padrão **200 m**).
- Distância pela fórmula de haversine (raio da Terra 6.371.000 m).
- O servidor recusa se a **precisão do GPS** informada for pior que **100 m** (evita liberar com localização aproximada por Wi-Fi/IP).
- Se a localização da empresa não estiver configurada, o ponto fica **bloqueado** (não libera).
- Limite conhecido: a posição vem do aparelho; GPS falso (mock location) burla.

### 2.6 Mensagens ao usuário (curtas, sem textos sobre localização na tela)
- Fora da área: `Você precisa estar na empresa para bater o ponto.`
- GPS fraco: `Sinal de GPS fraco. Vá para um local aberto e tente de novo.`
- QR vencido: `QR expirado. Escaneie o QR code da tela novamente.`
- Sem autorização: `Seu usuário não está autorizado a bater ponto.`
- Aparelho errado: `O ponto só pode ser batido pelo celular.` / `O QR code só pode ser gerado em um computador.`
- Dia completo: `Seu ponto de hoje já está completo.`
- Intervalo mínimo: `Você acabou de bater o ponto. Aguarde alguns minutos para a próxima batida.`
- O pop-up de permissão de localização é do navegador e **não dá para esconder**; aparece só na 1ª vez se a pessoa escolher "permitir sempre".

---

## 3. Variáveis de ambiente

| Variável | Para quê |
| --- | --- |
| `PONTO_QR_SECRET` | Segredo (≥ 16 caracteres) que assina o QR. Gerar com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `PONTO_EMPRESA_LAT` / `PONTO_EMPRESA_LNG` | Coordenada **exata** da empresa (Google Maps → botão direito → copiar coordenadas). Aceita vírgula decimal. |
| `PONTO_RAIO_M` | Raio em metros (padrão 200). |

Variáveis novas na Vercel só valem para deploys feitos depois delas: faça **Redeploy**.

---

## 4. Dependências

```
npm i qrcode jsqr xlsx @react-pdf/renderer
npm i -D @types/qrcode
```
- `qrcode`: desenha o QR na tela do computador.
- `jsqr`: lê o QR pela câmera dentro do site (funciona em iPhone e Android).
- `xlsx` e `@react-pdf/renderer`: exportação da folha (o grupo-liberty já usava).
- Também usa `firebase-admin`, `next`, `react`, `motion` e `@tabler/icons-react` do projeto.

---

## 5. Estrutura de arquivos

```
constants/ponto.ts                         # constantes, tipos, lista de funcionários, podeBaterPonto
utils/ponto/token.ts                       # gerar/validar token do QR
utils/ponto/calculo.ts                     # horas, saldo, resumo, formatação, fuso
utils/ponto/geo.ts                         # haversine, local da empresa, verificação de raio
utils/ponto/dispositivo.ts                 # User-Agent mobile (+ detecção no navegador)
utils/ponto/useDispositivoMobile.ts        # hook (useSyncExternalStore) mobile/desktop/null
utils/ponto/registros.ts                   # serializar doc, jornada, segredo (server-only)
utils/ponto/*.test.ts                      # testes (vitest) de token, cálculo, geo, dispositivo

app/dashboard/ponto/page.tsx               # folha (ADM supremo)
app/dashboard/ponto/FolhaClient.tsx        # UI da folha: mês, resumo, dia a dia, edição, jornada, exportar
app/dashboard/ponto/actions.ts             # getFolhaMes, salvarJornada, editarBatida (ADM supremo)
app/dashboard/ponto/pdf/FolhaPontoDocument.tsx
app/dashboard/ponto/bater/page.tsx         # tela do funcionário (valida token e lista de autorizados)
app/dashboard/ponto/bater/BaterPontoClient.tsx   # botões, geolocalização, leitor de QR
app/dashboard/ponto/bater/LeitorQr.tsx     # câmera + jsqr
app/dashboard/ponto/bater/actions.ts       # baterPonto, baterPontoDigital, getMeuDia
app/dashboard/ponto/qr/page.tsx            # tela do QR (desktop)
app/dashboard/ponto/qr/QrClient.tsx        # desenha e renova o QR
app/dashboard/ponto/qr/actions.ts          # getTokenQr
app/api/ponto/pdf/route.ts                 # PDF da folha de um funcionário
app/api/ponto/xlsx/route.ts                # Excel do mês (abas Resumo e Batidas)
```

Mais: `utils/firebase/middleware.ts` (sem sessão em `/dashboard/ponto/bater`, redireciona ao login com `?redirect=<caminho+query>` para voltar à batida), e itens no menu lateral (ver seção 7).

---

## 6. Fluxos

**Funcionário (celular):** menu "Bater ponto" → vê o resumo do dia → botão "Escanear QR code" (abre a câmera, lê o QR, pede a localização e registra) **ou** botão "Bater ponto digital" (pede a localização e registra). Ao concluir, o token sai da URL (`router.replace`) para recarregar a página não oferecer nova batida.

**QR (computador):** menu "QR do ponto" → página renova o token antes da janela virar (a cada 25 s) e mostra uma barra de tempo. No celular a página só mostra um aviso.

**Folha (ADM supremo):** escolhe o mês → tabela de todos os funcionários (jornada, dias completos/incompletos, horas, saldo) → clica no funcionário para ver o dia a dia → clica numa célula para lançar/corrigir (com motivo) → botão "Jornada" por funcionário → exportar Excel (mês inteiro) ou PDF (um funcionário). Legenda: ícone de pin = ponto digital, **M** = lançado/corrigido pelo ADM, sem marca = QR.

---

## 7. O que adaptar no outro projeto

| Peça do grupo-liberty | Adaptar para |
| --- | --- |
| `getSessionUser()` (`utils/permissions.ts`) → `{ uid, email, name, role }` | a função de sessão do outro projeto |
| `assertPageAccess('ponto')` + `PermissionKey 'ponto'` em `ABAS_SOMENTE_ADM_SUPREMO` | o gate que limita a folha a ADM supremo |
| `ADM_SUPREMO_EMAILS` | lista de ADMs supremos do outro projeto |
| `PONTO_FUNCIONARIOS_EMAILS` | quem bate ponto lá (se for outra equipe, edite a lista) |
| `adminDb`, `adminAuth` (`utils/firebase/admin`) | o Firebase Admin do outro projeto |
| `hojeSaoPaulo` | helper de data no fuso de São Paulo (ver seção 9) |
| Componentes `Button`, `Card`, `Modal`, `StatusBadge`, `Select`, `useToast`, `Breadcrumb` | os equivalentes do outro projeto |
| Menu (`DashboardShell`) | itens: **Bater ponto** (`/dashboard/ponto/bater`, só mobile, só autorizados), **QR do ponto** (`/dashboard/ponto/qr`, só desktop, só autorizados), **Folha de ponto** (`/dashboard/ponto`, só ADM supremo). Ao usar prefixo para destacar o item ativo, `/dashboard/ponto` deve casar só com o caminho exato (os outros dois têm seus próprios itens). |
| Changelog | registrar a novidade, se o projeto tiver |

Se o outro projeto **usar o mesmo Firebase/Firestore** do grupo-liberty, os dados são compartilhados de fato: use exatamente as coleções e campos da seção 2.2 e confira as Firestore Rules/índices. A consulta da folha usa só `where('mes', '==', mes)` e `where('data', '==', dia)` (igualdade em um campo, sem índice composto).

---

## 8. Como manter os dois projetos sincronizados

1. **Fonte única de verdade:** os arquivos da seção 9 abaixo são cópias literais. Em caso de dúvida, o grupo-liberty (`master`) manda.
2. Mudou uma regra (raio, intervalo, precisão do GPS, janela do QR, ordem das batidas, fórmula de horas)? Altere **os dois** projetos no mesmo dia e atualize este documento.
3. Mudou o formato dos dados (campos de `ponto_registros`/`ponto_config`)? Se o Firestore for compartilhado, ajuste primeiro o leitor (tolerante a campo ausente), depois o gravador.
4. Ao copiar para o outro projeto, rode os testes de `utils/ponto/*.test.ts`: eles travam o comportamento do token, do cálculo, da geolocalização e da detecção de aparelho.
5. Anote aqui, ao atualizar, o hash do commit de referência (topo do documento).

### Checklist de implantação no outro projeto
- [ ] Dependências instaladas (seção 4)
- [ ] Variáveis criadas na Vercel e **Redeploy** feito (seção 3)
- [ ] Arquivos copiados e adaptados (seções 5 e 7)
- [ ] `?redirect=` no middleware para `/dashboard/ponto/bater`
- [ ] Menu com os 3 itens, cada um com sua restrição de aparelho/usuário
- [ ] `vitest run` passando
- [ ] Teste em produção: QR no computador, bater no celular dentro e fora da empresa, folha, correção, Excel e PDF
- [ ] Apagar os registros de teste do dia (coleção `ponto_registros`)

---

## 9. Código de referência (cópia literal dos arquivos do grupo-liberty)

Helper usado por todos os arquivos (`utils/cobrancas/encargos.ts` no grupo-liberty):

```ts
const FORMATADOR_DIA_SP = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Hoje (`YYYY-MM-DD`) no fuso do negócio — não usar o relógio UTC do servidor. */
export function hojeSaoPaulo(agora: Date = new Date()): string {
  return FORMATADOR_DIA_SP.format(agora)
}
```

### `constants/ponto.ts`

```ts
// Registro de ponto — constantes compartilhadas (servidor e cliente).

/**
 * Quem bate ponto (Gustavo, Jessica e Álesis). Só essas contas veem "Bater
 * ponto", conseguem registrar batida e aparecem na folha de ponto.
 */
export const PONTO_FUNCIONARIOS_EMAILS: readonly string[] = [
  'gurizzo943@gmail.com',
  'jhessycamalaquias1@gmail.com',
  'alesisquiojau@gmail.com',
]

export function podeBaterPonto(email: string | null | undefined): boolean {
  const e = email?.toLowerCase().trim()
  return !!e && PONTO_FUNCIONARIOS_EMAILS.includes(e)
}

/** Ordem fixa das batidas do dia. */
export const BATIDAS = ['entrada', 'saida_almoco', 'volta_almoco', 'saida'] as const
export type Batida = (typeof BATIDAS)[number]
export type Batidas = Partial<Record<Batida, string>> // ISO 8601 (UTC)

export const BATIDA_LABEL: Record<Batida, string> = {
  entrada: 'Entrada',
  saida_almoco: 'Saída para o almoço',
  volta_almoco: 'Volta do almoço',
  saida: 'Saída',
}

/** Jornada diária padrão, em minutos (8h). */
export const JORNADA_PADRAO_MIN = 480
export const JORNADA_MIN_MAXIMA = 16 * 60

/** Intervalo mínimo entre duas batidas seguidas (evita toque/escaneio duplo). */
export const INTERVALO_MIN_ENTRE_BATIDAS_MS = 2 * 60 * 1000

/** Cada janela do QR dura 30 s; o token vale a janela atual e a anterior (~60 s). */
export const QR_JANELA_MS = 30 * 1000

/** Ponto digital: raio padrão ao redor da empresa e pior precisão de GPS aceita. */
export const RAIO_PONTO_M_PADRAO = 200
export const PRECISAO_MAX_M = 100

/** Como a batida foi registrada. */
export type OrigemBatida = 'qr' | 'digital' | 'manual'

/** Fuso do ponto. O Brasil não tem horário de verão desde 2019, então o offset é fixo. */
export const FUSO_PONTO = 'America/Sao_Paulo'
export const OFFSET_PONTO = '-03:00'

export const COLECAO_PONTO = 'ponto_registros'
export const COLECAO_PONTO_CONFIG = 'ponto_config'

export interface EdicaoPonto {
  porUid: string
  porEmail: string
  em: string // ISO
  campo: Batida
  de: string | null // ISO
  para: string | null // ISO
  motivo: string
}

export interface RegistroPonto {
  id: string
  uid: string
  email: string
  nome: string
  data: string // YYYY-MM-DD (America/Sao_Paulo)
  batidas: Batidas
  /** Origem de cada batida (registros antigos não têm: tratar como QR). */
  origens: Partial<Record<Batida, OrigemBatida>>
  /** Distância até a empresa (m) das batidas digitais. */
  distancias: Partial<Record<Batida, number>>
  jornadaMin: number
  edicoes: EdicaoPonto[]
}

```

### `utils/ponto/token.ts`

```ts
// Token do QR rotativo do ponto. Sem estado: `<janela>.<hmac>`, onde a janela
// muda a cada QR_JANELA_MS. Vale a janela atual e a anterior (~60 s).
// Roda só no servidor (usa node:crypto); o segredo é passado por parâmetro
// para ser testável.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { QR_JANELA_MS } from '@/constants/ponto'

function assinar(segredo: string, janela: number): string {
  return createHmac('sha256', segredo).update(`ponto:${janela}`).digest('hex')
}

export function gerarTokenPonto(segredo: string, agora: number = Date.now()): string {
  const janela = Math.floor(agora / QR_JANELA_MS)
  return `${janela}.${assinar(segredo, janela)}`
}

export function validarTokenPonto(
  token: unknown,
  segredo: string,
  agora: number = Date.now(),
): boolean {
  if (typeof token !== 'string' || !segredo) return false
  const m = /^(\d{1,12})\.([0-9a-f]{64})$/.exec(token)
  if (!m) return false
  const janela = Number(m[1])
  const atual = Math.floor(agora / QR_JANELA_MS)
  if (janela > atual || janela < atual - 1) return false
  const esperado = Buffer.from(assinar(segredo, janela), 'hex')
  const recebido = Buffer.from(m[2], 'hex')
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
}

```

### `utils/ponto/calculo.ts`

```ts
// Cálculos do ponto — funções puras, sem acesso a banco (testáveis).

import { BATIDAS, FUSO_PONTO, OFFSET_PONTO, type Batida, type Batidas } from '@/constants/ponto'

/** Próxima batida esperada no dia, ou null se o dia já está completo. */
export function proximaBatida(batidas: Batidas): Batida | null {
  return BATIDAS.find((b) => !batidas[b]) ?? null
}

export function diaCompleto(batidas: Batidas): boolean {
  return BATIDAS.every((b) => !!batidas[b])
}

/** Minutos trabalhados no dia; null se o dia está incompleto. */
export function minutosTrabalhados(batidas: Batidas): number | null {
  if (!diaCompleto(batidas)) return null
  const t = (b: Batida) => new Date(batidas[b]!).getTime()
  const manha = t('saida_almoco') - t('entrada')
  const tarde = t('saida') - t('volta_almoco')
  if (manha < 0 || tarde < 0) return null
  return Math.round((manha + tarde) / 60000)
}

/** Saldo do dia (trabalhado − jornada); null se o dia está incompleto. */
export function saldoDia(batidas: Batidas, jornadaMin: number): number | null {
  const trab = minutosTrabalhados(batidas)
  return trab === null ? null : trab - jornadaMin
}

export interface DiaParaResumo {
  batidas: Batidas
  jornadaMin: number
}

export interface ResumoMes {
  trabalhadoMin: number
  saldoMin: number
  diasCompletos: number
  diasIncompletos: number
}

/** Soma o mês: só dias completos entram nas horas e no saldo. */
export function resumoMes(dias: DiaParaResumo[]): ResumoMes {
  const r: ResumoMes = { trabalhadoMin: 0, saldoMin: 0, diasCompletos: 0, diasIncompletos: 0 }
  for (const d of dias) {
    const trab = minutosTrabalhados(d.batidas)
    if (trab === null) {
      // Dia sem nenhuma batida não conta como incompleto.
      if (BATIDAS.some((b) => d.batidas[b])) r.diasIncompletos++
      continue
    }
    r.diasCompletos++
    r.trabalhadoMin += trab
    r.saldoMin += trab - d.jornadaMin
  }
  return r
}

/** Valida que as batidas presentes estão em ordem cronológica. */
export function batidasEmOrdem(batidas: Batidas): boolean {
  let anterior = -Infinity
  for (const b of BATIDAS) {
    const v = batidas[b]
    if (!v) continue
    const ms = new Date(v).getTime()
    if (Number.isNaN(ms) || ms < anterior) return false
    anterior = ms
  }
  return true
}

/** "8h30"; com `comSinal`, "+0h15" / "−1h00". */
export function formatarMinutos(min: number, comSinal = false): string {
  const abs = Math.abs(Math.round(min))
  const texto = `${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}`
  if (!comSinal) return texto
  if (min === 0) return texto
  return `${min > 0 ? '+' : '−'}${texto}`
}

const FORMATADOR_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_PONTO,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** "HH:mm" no fuso do ponto. */
export function horaSP(iso: string): string {
  return FORMATADOR_HORA.format(new Date(iso))
}

/** Converte data (YYYY-MM-DD) + hora (HH:mm) de São Paulo em ISO UTC; null se inválido. */
export function isoDeDataHoraSP(data: string, hora: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null
  const d = new Date(`${data}T${hora}:00${OFFSET_PONTO}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Dias (YYYY-MM-DD) de um mês (YYYY-MM). */
export function diasDoMes(mes: string): string[] {
  const [ano, m] = mes.split('-').map(Number)
  const total = new Date(Date.UTC(ano, m, 0)).getUTCDate()
  return Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`)
}

```

### `utils/ponto/geo.ts`

```ts
// Geolocalização do ponto digital — funções puras (testáveis).

import { PRECISAO_MAX_M, RAIO_PONTO_M_PADRAO } from '@/constants/ponto'

export interface Coordenada {
  lat: number
  lng: number
}

export interface LocalEmpresa extends Coordenada {
  raioM: number
}

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function distanciaMetros(a: Coordenada, b: Coordenada): number {
  const R = 6_371_000
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function coordenadaValida(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  )
}

/** Lê a localização da empresa das variáveis de ambiente; null se não configurada. */
export function lerLocalEmpresa(env: Record<string, string | undefined>): LocalEmpresa | null {
  const lat = Number(env.PONTO_EMPRESA_LAT?.trim().replace(',', '.'))
  const lng = Number(env.PONTO_EMPRESA_LNG?.trim().replace(',', '.'))
  if (!env.PONTO_EMPRESA_LAT || !env.PONTO_EMPRESA_LNG || !coordenadaValida(lat, lng)) return null
  const raio = Number(env.PONTO_RAIO_M)
  return { lat, lng, raioM: Number.isFinite(raio) && raio > 0 ? raio : RAIO_PONTO_M_PADRAO }
}

export type VerificacaoLocal =
  | { ok: true; distanciaM: number }
  | { ok: false; erro: string }

/** Decide se a posição informada libera o ponto digital. */
export function verificarLocal(
  local: LocalEmpresa,
  pos: { lat: unknown; lng: unknown; precisaoM: unknown },
): VerificacaoLocal {
  if (!coordenadaValida(pos.lat, pos.lng)) return { ok: false, erro: 'Localização inválida.' }
  const precisao = typeof pos.precisaoM === 'number' && Number.isFinite(pos.precisaoM) ? pos.precisaoM : Infinity
  if (precisao > PRECISAO_MAX_M) {
    return { ok: false, erro: 'Sinal de GPS fraco. Vá para um local aberto e tente de novo.' }
  }
  const distanciaM = distanciaMetros(local, { lat: pos.lat as number, lng: pos.lng as number })
  if (distanciaM > local.raioM) {
    return { ok: false, erro: 'Você precisa estar na empresa para bater o ponto.' }
  }
  return { ok: true, distanciaM: Math.round(distanciaM) }
}

```

### `utils/ponto/dispositivo.ts`

```ts
// Tipo de aparelho: o QR do ponto é gerado só no computador e lido só no celular.
// É uma regra de uso (UX), não de segurança: o User-Agent pode ser trocado.

const UA_MOBILE = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|Opera Mini|IEMobile/i

export function ehUserAgentMobile(ua: string | null | undefined): boolean {
  return !!ua && UA_MOBILE.test(ua)
}

/** Detecção no navegador. iPadOS se apresenta como Mac, então confere o toque. */
export function detectarMobileNoNavegador(): boolean {
  if (ehUserAgentMobile(navigator.userAgent)) return true
  if (/Mac/i.test(navigator.platform) && navigator.maxTouchPoints > 1) return true
  return window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches
}

```

### `utils/ponto/useDispositivoMobile.ts`

```ts
'use client'

import { useSyncExternalStore } from 'react'
import { detectarMobileNoNavegador } from './dispositivo'

const semAssinatura = () => () => {}

/** true = celular/tablet, false = computador, null = ainda não sabemos (servidor/hidratação). */
export function useDispositivoMobile(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    semAssinatura,
    () => detectarMobileNoNavegador(),
    () => null,
  )
}

```

### `utils/ponto/registros.ts`

```ts
import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import {
  COLECAO_PONTO_CONFIG,
  JORNADA_PADRAO_MIN,
  type Batida,
  type Batidas,
  type EdicaoPonto,
  type RegistroPonto,
} from '@/constants/ponto'
import { BATIDAS } from '@/constants/ponto'

/** Segredo que assina o QR. Lança se não estiver configurado. */
export function segredoPonto(): string {
  const s = process.env.PONTO_QR_SECRET
  if (!s || s.length < 16) throw new Error('PONTO_QR_SECRET não configurado no servidor.')
  return s
}

export function serializarRegistro(id: string, d: FirebaseFirestore.DocumentData): RegistroPonto {
  const batidas: Batidas = {}
  for (const b of BATIDAS) {
    const v = d.batidas?.[b]
    if (typeof v === 'string') batidas[b as Batida] = v
  }
  const edicoes: EdicaoPonto[] = Array.isArray(d.edicoes) ? d.edicoes : []
  const origens: RegistroPonto['origens'] = {}
  const distancias: RegistroPonto['distancias'] = {}
  for (const b of BATIDAS) {
    const o = d.origens?.[b]
    if (o === 'qr' || o === 'digital' || o === 'manual') origens[b] = o
    const dist = d.distancias?.[b]
    if (typeof dist === 'number') distancias[b] = dist
  }
  return {
    id,
    uid: String(d.uid ?? ''),
    email: String(d.email ?? ''),
    nome: String(d.nome ?? ''),
    data: String(d.data ?? ''),
    batidas,
    origens,
    distancias,
    jornadaMin: typeof d.jornadaMin === 'number' ? d.jornadaMin : JORNADA_PADRAO_MIN,
    edicoes,
  }
}

export async function getJornadaMin(uid: string): Promise<number> {
  const snap = await adminDb.collection(COLECAO_PONTO_CONFIG).doc(uid).get()
  const v = snap.data()?.jornadaMin
  return typeof v === 'number' && v > 0 ? v : JORNADA_PADRAO_MIN
}

```

### `app/dashboard/ponto/bater/actions.ts`

```ts
'use server'

import { headers } from 'next/headers'
import { adminDb } from '@/utils/firebase/admin'
import { ehUserAgentMobile } from '@/utils/ponto/dispositivo'
import { getSessionUser, type SessionUser } from '@/utils/permissions'
import { hojeSaoPaulo } from '@/utils/cobrancas/encargos'
import { validarTokenPonto } from '@/utils/ponto/token'
import { proximaBatida, horaSP } from '@/utils/ponto/calculo'
import { lerLocalEmpresa, verificarLocal } from '@/utils/ponto/geo'
import { getJornadaMin, segredoPonto, serializarRegistro } from '@/utils/ponto/registros'
import {
  COLECAO_PONTO,
  podeBaterPonto,
  INTERVALO_MIN_ENTRE_BATIDAS_MS,
  type Batida,
  type OrigemBatida,
  type RegistroPonto,
} from '@/constants/ponto'

export type BaterPontoResultado =
  | { ok: true; batida: Batida; hora: string }
  | { ok: false; erro: string }

/** Registro do usuário logado para o dia de hoje (null se ainda não bateu). */
export async function getMeuDia(): Promise<RegistroPonto | null> {
  const user = await getSessionUser()
  if (!user) return null
  const data = hojeSaoPaulo()
  const snap = await adminDb.collection(COLECAO_PONTO).doc(`${user.uid}_${data}`).get()
  return snap.exists ? serializarRegistro(snap.id, snap.data()!) : null
}

/** Grava a próxima batida do dia numa transação (ordem fixa, sem duplicar). */
async function registrarProximaBatida(
  user: SessionUser,
  origem: OrigemBatida,
  distanciaM?: number,
): Promise<BaterPontoResultado> {
  try {
    const agora = new Date()
    const data = hojeSaoPaulo(agora)
    const jornadaMin = await getJornadaMin(user.uid)
    const ref = adminDb.collection(COLECAO_PONTO).doc(`${user.uid}_${data}`)

    return await adminDb.runTransaction<BaterPontoResultado>(async (tx) => {
      const snap = await tx.get(ref)
      const existente = snap.exists ? serializarRegistro(snap.id, snap.data()!) : null
      const batidas = existente?.batidas ?? {}

      const proxima = proximaBatida(batidas)
      if (!proxima) return { ok: false, erro: 'Seu ponto de hoje já está completo.' }

      const ultimo = Math.max(0, ...Object.values(batidas).map((v) => new Date(v).getTime()))
      if (ultimo && agora.getTime() - ultimo < INTERVALO_MIN_ENTRE_BATIDAS_MS) {
        return { ok: false, erro: 'Você acabou de bater o ponto. Aguarde alguns minutos para a próxima batida.' }
      }

      const iso = agora.toISOString()
      if (existente) {
        tx.update(ref, {
          [`batidas.${proxima}`]: iso,
          [`origens.${proxima}`]: origem,
          ...(distanciaM !== undefined ? { [`distancias.${proxima}`]: distanciaM } : {}),
        })
      } else {
        tx.set(ref, {
          uid: user.uid,
          email: user.email ?? '',
          nome: user.name ?? user.email ?? 'Usuário',
          data,
          mes: data.slice(0, 7),
          batidas: { [proxima]: iso },
          origens: { [proxima]: origem },
          distancias: distanciaM !== undefined ? { [proxima]: distanciaM } : {},
          jornadaMin,
          edicoes: [],
        })
      }
      return { ok: true, batida: proxima, hora: horaSP(iso) }
    })
  } catch (err) {
    console.error('[registrarProximaBatida]', err)
    return { ok: false, erro: 'Não foi possível registrar o ponto. Tente novamente.' }
  }
}

interface PosicaoInformada {
  lat: number
  lng: number
  precisaoM: number
}

/** Funcionário autorizado + celular + dentro do raio. Usado pelo QR e pelo ponto digital. */
async function conferirCelularNaEmpresa(
  user: SessionUser,
  pos: PosicaoInformada,
): Promise<{ ok: true; distanciaM: number } | { ok: false; erro: string }> {
  if (!podeBaterPonto(user.email)) {
    return { ok: false, erro: 'Seu usuário não está autorizado a bater ponto.' }
  }
  if (!ehUserAgentMobile((await headers()).get('user-agent'))) {
    return { ok: false, erro: 'O ponto só pode ser batido pelo celular.' }
  }
  const local = lerLocalEmpresa(process.env)
  if (!local) {
    return { ok: false, erro: 'Ponto indisponível: a localização da empresa não está configurada.' }
  }
  return verificarLocal(local, { lat: pos?.lat, lng: pos?.lng, precisaoM: pos?.precisaoM })
}

/** Ponto pelo QR code: exige token de QR válido e o celular dentro da empresa. */
export async function baterPonto(token: string, pos: PosicaoInformada): Promise<BaterPontoResultado> {
  const user = await getSessionUser()
  if (!user) return { ok: false, erro: 'Você precisa estar logado para bater o ponto.' }

  let segredo: string
  try {
    segredo = segredoPonto()
  } catch {
    return { ok: false, erro: 'Ponto indisponível: configuração do servidor incompleta.' }
  }
  if (!validarTokenPonto(token, segredo)) {
    return { ok: false, erro: 'QR expirado. Escaneie o QR code da tela novamente.' }
  }

  const local = await conferirCelularNaEmpresa(user, pos)
  if (!local.ok) return { ok: false, erro: local.erro }
  return registrarProximaBatida(user, 'qr', local.distanciaM)
}

/** Ponto digital: sem QR, só a localização do celular dentro da empresa. */
export async function baterPontoDigital(pos: PosicaoInformada): Promise<BaterPontoResultado> {
  const user = await getSessionUser()
  if (!user) return { ok: false, erro: 'Você precisa estar logado para bater o ponto.' }

  const local = await conferirCelularNaEmpresa(user, pos)
  if (!local.ok) return { ok: false, erro: local.erro }
  return registrarProximaBatida(user, 'digital', local.distanciaM)
}

/** Se o ponto digital está configurado no servidor (para a tela mostrar ou esconder o botão). */
export async function pontoDigitalDisponivel(): Promise<boolean> {
  return lerLocalEmpresa(process.env) !== null
}

```

### `app/dashboard/ponto/actions.ts`

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { assertPageAccess } from '@/utils/permissions'
import { hojeSaoPaulo } from '@/utils/cobrancas/encargos'
import { batidasEmOrdem, isoDeDataHoraSP, resumoMes } from '@/utils/ponto/calculo'
import { getJornadaMin, serializarRegistro } from '@/utils/ponto/registros'
import {
  BATIDAS,
  COLECAO_PONTO,
  COLECAO_PONTO_CONFIG,
  JORNADA_MIN_MAXIMA,
  JORNADA_PADRAO_MIN,
  podeBaterPonto,
  type Batida,
  type Batidas,
  type EdicaoPonto,
  type RegistroPonto,
} from '@/constants/ponto'

export interface FuncionarioPonto {
  uid: string
  nome: string
  email: string
  jornadaMin: number
}

export interface TotalFuncionarioMes {
  uid: string
  trabalhadoMin: number
  saldoMin: number
  diasCompletos: number
  diasIncompletos: number
}

export interface FolhaMes {
  mes: string
  funcionarios: FuncionarioPonto[]
  totais: TotalFuncionarioMes[]
  /** Registros do funcionário selecionado no mês. */
  registros: RegistroPonto[]
}

export type AcaoPontoResposta = { ok: true } | { ok: false; erro: string }

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

/** Lista quem tem conta com cargo no sistema, com a jornada de cada um. */
async function listarFuncionarios(): Promise<FuncionarioPonto[]> {
  const [perfis, lista, configs] = await Promise.all([
    adminDb.collection('profiles').get(),
    adminAuth.listUsers(1000),
    adminDb.collection(COLECAO_PONTO_CONFIG).get(),
  ])
  const comCargo = new Set(perfis.docs.filter((d) => d.data().role).map((d) => d.id))
  const jornadas = new Map<string, number>()
  configs.forEach((d) => {
    const v = d.data().jornadaMin
    if (typeof v === 'number' && v > 0) jornadas.set(d.id, v)
  })
  return lista.users
    .filter((u) => comCargo.has(u.uid) && podeBaterPonto(u.email))
    .map((u) => ({
      uid: u.uid,
      nome: u.displayName || u.email || u.uid,
      email: u.email || '',
      jornadaMin: jornadas.get(u.uid) ?? JORNADA_PADRAO_MIN,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Folha do mês: totais de todos e o detalhe dia a dia do funcionário `uid`. */
export async function getFolhaMes(mes: string, uid: string | null): Promise<FolhaMes> {
  await assertPageAccess('ponto')
  if (!MES_RE.test(mes)) throw new Error('Mês inválido.')

  const [funcionarios, snap] = await Promise.all([
    listarFuncionarios(),
    adminDb.collection(COLECAO_PONTO).where('mes', '==', mes).get(),
  ])
  const todos = snap.docs.map((d) => serializarRegistro(d.id, d.data()))

  const porUid = new Map<string, RegistroPonto[]>()
  for (const r of todos) porUid.set(r.uid, [...(porUid.get(r.uid) ?? []), r])

  const totais: TotalFuncionarioMes[] = funcionarios.map((f) => ({
    uid: f.uid,
    ...resumoMes(porUid.get(f.uid) ?? []),
  }))

  const registros = uid ? (porUid.get(uid) ?? []).sort((a, b) => a.data.localeCompare(b.data)) : []
  return { mes, funcionarios, totais, registros }
}

export async function salvarJornada(uid: string, minutos: number): Promise<AcaoPontoResposta> {
  const adm = await assertPageAccess('ponto').catch(() => null)
  if (!adm) return { ok: false, erro: 'Acesso negado.' }
  if (!uid || !Number.isInteger(minutos) || minutos < 30 || minutos > JORNADA_MIN_MAXIMA) {
    return { ok: false, erro: 'Jornada inválida (entre 0h30 e 16h).' }
  }
  try {
    await adminDb.collection(COLECAO_PONTO_CONFIG).doc(uid).set(
      { jornadaMin: minutos, atualizadoEm: new Date().toISOString(), atualizadoPor: adm.email ?? adm.uid },
      { merge: true },
    )
    revalidatePath('/dashboard/ponto')
    return { ok: true }
  } catch (err) {
    console.error('[salvarJornada]', err)
    return { ok: false, erro: 'Não foi possível salvar a jornada.' }
  }
}

/**
 * Lança, corrige ou apaga (hora vazia) uma batida de um funcionário num dia.
 * Exige motivo e registra a edição no histórico do dia.
 */
export async function editarBatida(input: {
  uid: string
  data: string
  campo: Batida
  hora: string // "HH:mm" ou "" para apagar
  motivo: string
}): Promise<AcaoPontoResposta> {
  const adm = await assertPageAccess('ponto').catch(() => null)
  if (!adm) return { ok: false, erro: 'Acesso negado.' }

  const { uid, data, campo } = input
  const motivo = String(input.motivo ?? '').trim().slice(0, 300)
  if (!uid || !DATA_RE.test(data) || !BATIDAS.includes(campo)) return { ok: false, erro: 'Dados inválidos.' }
  if (data > hojeSaoPaulo()) return { ok: false, erro: 'Não é possível lançar ponto em data futura.' }
  if (motivo.length < 3) return { ok: false, erro: 'Informe o motivo da alteração.' }

  const novo = input.hora ? isoDeDataHoraSP(data, input.hora) : null
  if (input.hora && !novo) return { ok: false, erro: 'Horário inválido.' }

  try {
    const usuario = await adminAuth.getUser(uid)
    const jornadaMin = await getJornadaMin(uid)
    const ref = adminDb.collection(COLECAO_PONTO).doc(`${uid}_${data}`)

    const resultado = await adminDb.runTransaction<AcaoPontoResposta>(async (tx) => {
      const snap = await tx.get(ref)
      const atual = snap.exists ? serializarRegistro(snap.id, snap.data()!) : null
      const batidas: Batidas = { ...(atual?.batidas ?? {}) }
      const anterior = batidas[campo] ?? null
      if (novo) batidas[campo] = novo
      else delete batidas[campo]

      if (anterior === novo) return { ok: false, erro: 'Nada foi alterado.' }
      if (!batidasEmOrdem(batidas)) {
        return { ok: false, erro: 'Os horários precisam seguir a ordem: entrada, saída p/ almoço, volta, saída.' }
      }

      const edicao: EdicaoPonto = {
        porUid: adm.uid,
        porEmail: adm.email ?? '',
        em: new Date().toISOString(),
        campo,
        de: anterior,
        para: novo,
        motivo,
      }
      const edicoes = [...(atual?.edicoes ?? []), edicao]
      const origens = { ...(atual?.origens ?? {}) }
      const distancias = { ...(atual?.distancias ?? {}) }
      delete distancias[campo]
      if (novo) origens[campo] = 'manual'
      else delete origens[campo]
      if (atual) {
        tx.update(ref, { batidas, origens, distancias, edicoes })
      } else {
        tx.set(ref, {
          uid,
          email: usuario.email ?? '',
          nome: usuario.displayName || usuario.email || 'Usuário',
          data,
          mes: data.slice(0, 7),
          batidas,
          origens,
          distancias,
          jornadaMin,
          edicoes,
        })
      }
      return { ok: true }
    })
    if (resultado.ok) revalidatePath('/dashboard/ponto')
    return resultado
  } catch (err) {
    console.error('[editarBatida]', err)
    return { ok: false, erro: 'Não foi possível salvar a alteração.' }
  }
}

```

### `app/dashboard/ponto/qr/actions.ts`

```ts
'use server'

import { headers } from 'next/headers'
import { getSessionUser } from '@/utils/permissions'
import { podeBaterPonto } from '@/constants/ponto'
import { ehUserAgentMobile } from '@/utils/ponto/dispositivo'
import { gerarTokenPonto } from '@/utils/ponto/token'
import { segredoPonto } from '@/utils/ponto/registros'

/**
 * Token atual do QR. Só quem bate ponto (PONTO_FUNCIONARIOS_EMAILS) pode exibir
 * o QR no computador; para registrar, ainda é preciso o celular dentro da
 * empresa, então exibir o QR de casa não libera nada.
 */
export async function getTokenQr(): Promise<{ ok: true; token: string } | { ok: false; erro: string }> {
  const user = await getSessionUser()
  if (!user?.role || !podeBaterPonto(user.email)) return { ok: false, erro: 'Acesso negado.' }
  if (ehUserAgentMobile((await headers()).get('user-agent'))) {
    return { ok: false, erro: 'O QR code só pode ser gerado em um computador.' }
  }
  try {
    return { ok: true, token: gerarTokenPonto(segredoPonto()) }
  } catch {
    return { ok: false, erro: 'PONTO_QR_SECRET não configurado no servidor.' }
  }
}

```

### `app/dashboard/ponto/bater/LeitorQr.tsx`

```ts
'use client'

import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

/** Extrai o token de um QR do ponto; null se o QR não for do nosso ponto. */
export function tokenDoQr(texto: string): string | null {
  try {
    const url = new URL(texto)
    if (url.origin !== window.location.origin) return null
    if (url.pathname !== '/dashboard/ponto/bater') return null
    return url.searchParams.get('t')
  } catch {
    return null
  }
}

/**
 * Abre a câmera traseira e lê QR codes. Monte o componente só quando for usar:
 * a câmera liga ao montar e desliga ao desmontar.
 */
export default function LeitorQr({ onToken }: { onToken: (token: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onTokenRef = useRef(onToken)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useEffect(() => {
    let ativo = true
    let stream: MediaStream | null = null
    let raf = 0
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    function varrer() {
      const video = videoRef.current
      if (!ativo || !video || !ctx) return
      if (video.readyState >= 2 && video.videoWidth > 0) {
        // Reduz a imagem: leitura mais rápida e suficiente para um QR de tela.
        const escala = Math.min(1, 640 / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * escala)
        canvas.height = Math.round(video.videoHeight * escala)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
        if (qr?.data) {
          const token = tokenDoQr(qr.data)
          if (token) {
            ativo = false
            onTokenRef.current(token)
            return
          }
          setAviso('Esse QR não é do ponto da empresa.')
        }
      }
      raf = requestAnimationFrame(varrer)
    }

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErro('Este navegador não permite abrir a câmera aqui. Use a câmera do celular para ler o QR.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (!ativo) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        raf = requestAnimationFrame(varrer)
      } catch (e) {
        const nome = (e as DOMException)?.name
        setErro(
          nome === 'NotAllowedError'
            ? 'Permissão da câmera negada. Libere a câmera para este site nas configurações do navegador.'
            : nome === 'NotFoundError'
              ? 'Nenhuma câmera encontrada neste aparelho.'
              : 'Não foi possível abrir a câmera.',
        )
      }
    }

    iniciar()
    return () => {
      ativo = false
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  if (erro) return <p className="py-6 text-center text-sm font-medium text-rose-600">{erro}</p>

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
        <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/80" />
      </div>
      <p className="text-center text-sm text-neutral-600">
        {aviso ?? 'Aponte para o QR code da tela da empresa.'}
      </p>
    </div>
  )
}

```

### `utils/firebase/middleware.ts` (trecho que muda)

```ts
    // Quem escaneou o QR do ponto volta para a batida depois de entrar.
    if (pathname.startsWith('/dashboard/ponto/bater')) {
      url.search = `?redirect=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    }
```

