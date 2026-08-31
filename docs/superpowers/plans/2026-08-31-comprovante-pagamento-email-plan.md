# Plano de implementação — E-mail de comprovante de pagamento

**Spec:** `docs/superpowers/specs/2026-08-31-comprovante-pagamento-email-design.md`
**Branch:** `feat/comprovante-pagamento-email`
**Data:** 2026-08-31

Ordem dos passos importa: cada um compila sozinho. Código de verdade só a partir do
Passo 1. Verificação de cada passo: `npm run build` (cobre TS + import server-side do
`@react-pdf/renderer`) e, quando indicado, `npm run lint`.

---

## Passo 0 — Preparação (sem código)

1. Ler os guias relevantes em `node_modules/next/dist/docs/` antes de tocar em
   `actions.ts` / componentes: procurar por **server actions**, **route handlers** e
   qualquer aviso de deprecação. Anotar divergências do padrão atual do repo.
2. Confirmar que `registrarPagamento` hoje retorna `CobrancaResponse` e é chamado só de
   `CobrancasClient.tsx` (`grep -rn "registrarPagamento" app/`). Confirmado no spec, mas
   revalidar antes de mudar a assinatura de retorno.
3. Para o teste manual (Passo 6): garantir `RESEND_API_KEY` no `.env.local` e um e-mail
   de destino real. Se não houver chave, o teste do caminho feliz fica pendente — o
   caminho "sem chave" ainda é verificável.

**Verificação:** nenhuma mudança; só leitura.

---

## Passo 1 — Template HTML do e-mail

**Arquivo novo:** `utils/email/templates/comprovante-pagamento.ts`

- Copiar a estrutura de `utils/email/templates/cobranca-lembrete.ts` (helpers
  `formatCurrencyBR`, `formatDateBR`, `escapeHtml`; layout de tabela; header com
  gradiente; rodapé).
- Exportar:

  ```ts
  export interface ComprovantePagamentoData {
    clienteNome: string
    veiculoResumo: string
    numeroParcela: number
    numeroParcelas: number
    valorParcela: number
    valorPagoAgora: number
    dataPagamento: string        // YYYY-MM-DD
    valorPagoAcumulado: number
    valorRestante: number        // 0 quando quitada
    quitada: boolean
    referencia: string
  }

  export function renderComprovantePagamentoEmail(data: ComprovantePagamentoData): string
  ```

- Diferenças de conteúdo:
  - Badge/título: `quitada` → "PARCELA QUITADA" (verde/esmeralda); senão → "PAGAMENTO
    PARCIAL" (âmbar).
  - Bloco de detalhes: sempre mostra Veículo, Parcela `N/total`, "Valor pago"
    (`valorPagoAgora`), "Data do pagamento", "Referência".
  - Se **não** quitada: linha extra "Saldo restante nesta parcela"
    (`formatCurrencyBR(valorRestante)`).
  - Se quitada: linha "Parcela quitada em `formatDateBR(dataPagamento)`".
  - Texto de saudação adaptado (`Recebemos seu pagamento` vs `Sua parcela foi quitada`).
- Assunto **não** vai aqui (fica no sender).

**Verificação:** `npm run build`. Sem uso ainda — só garante que compila.

---

## Passo 2 — Documento PDF do recibo

**Arquivo novo:** `app/dashboard/cobrancas/pdf/ReciboPagamentoDocument.tsx`

- Reaproveitar de `app/dashboard/propostas/pdf/PropostaAutorizacaoDocument.tsx`:
  - helpers `resolvePublicPath`, `toImageDataUrl`;
  - bloco `try` de `Font.register` com flag `fontsRegistered` e fallbacks
    `HEADING_FONT` / `INTER_FONT` (`Helvetica-Bold` / `Helvetica`).
  - Asset: `LOGO_LIBERTY = toImageDataUrl('logo-liberty-car-blue.png')`.
- Props:

  ```ts
  export interface ReciboPagamentoDocumentProps extends ComprovantePagamentoData {
    clienteEmail: string
    emitidoEm: string   // ISO — data/hora de emissão do recibo
  }
  ```

  (importar `ComprovantePagamentoData` do template do Passo 1, ou redeclarar local se
  preferir evitar acoplamento — o spec permite import.)

- Layout (uma `Page` A4, tema claro, simples — não precisa ser tão elaborado quanto o da
  proposta):
  1. Cabeçalho: logo + "RECIBO DE PAGAMENTO".
  2. Linha: "Referência: `<referencia>`" · "Emitido em: `formatDateBR/Time(emitidoEm)`".
  3. Bloco "Cliente": nome, e-mail.
  4. Bloco "Veículo": `veiculoResumo`.
  5. Bloco "Pagamento": Parcela `N/total`; Valor da parcela; **Valor pago agora**
     (destaque); Data do pagamento; Total pago na parcela (`valorPagoAcumulado`);
     Saldo restante (`valorRestante`).
  6. Carimbo/badge: "QUITADA" ou "PARCIAL".
  7. Rodapé: "Documento gerado automaticamente pelo sistema Liberty Car — não requer
     assinatura."
- Formatação monetária/data: helpers locais `Intl` (o módulo roda server-side; não
  importar de `utils/format` se ele trouxer `'use client'` — verificar; hoje `utils/format`
  é neutro, então pode importar `formatCurrency`/`formatDate` dele).

**Verificação:** `npm run build`. Opcional: criar um script scratch temporário que faça
`renderToBuffer(createElement(ReciboPagamentoDocument, {...dadosFake}))` e escreva
`scratch/recibo.pdf` para conferir o visual; **remover** o script antes do commit.

---

## Passo 3 — Sender do e-mail

**Arquivo novo:** `utils/email/send-comprovante-pagamento-email.ts`

- Mesmo cabeçalho dos outros senders:

  ```ts
  import { Resend } from 'resend'
  import { renderToBuffer } from '@react-pdf/renderer'
  import { createElement } from 'react'
  import { renderComprovantePagamentoEmail, type ComprovantePagamentoData } from './templates/comprovante-pagamento'
  import ReciboPagamentoDocument from '@/app/dashboard/cobrancas/pdf/ReciboPagamentoDocument'

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const FROM_EMAIL = 'Liberty Car <noreply@grupolibertycar.com.br>'
  const CC_EMAIL = 'libertycar7@gmail.com'
  ```

- API:

  ```ts
  export interface ComprovantePagamentoEmailPayload extends ComprovantePagamentoData {
    clienteEmail: string
  }

  export async function sendComprovantePagamentoEmail(
    payload: ComprovantePagamentoEmailPayload,
  ): Promise<boolean>
  ```

- Corpo:
  1. `if (!RESEND_API_KEY) { console.warn('[Resend] RESEND_API_KEY não configurada. Comprovante não enviado.'); return false }`
  2. `if (!payload.clienteEmail) { console.warn(...); return false }`
  3. `const subject = payload.quitada ? 'Comprovante de quitação da parcela — Liberty Car' : 'Comprovante de pagamento parcial — Liberty Car'`
  4. `const html = renderComprovantePagamentoEmail(payload)`
  5. `const pdfBuffer = await renderToBuffer(createElement(ReciboPagamentoDocument, { ...payload, emitidoEm: new Date().toISOString() }) as any)`
  6. `resend.emails.send({ from: FROM_EMAIL, to: payload.clienteEmail, cc: CC_EMAIL, subject, html, attachments: [{ filename: \`comprovante-${payload.referencia}.pdf\`, content: pdfBuffer.toString('base64') }] })`
  7. `try/catch` externo → loga `[Resend] Exceção ...` e retorna `false`. Erro do
     `resend` (`{ error }`) → loga e retorna `false`. Sucesso → `console.log('[Resend] Comprovante enviado para ...')` e `true`.

**Verificação:** `npm run build`. Sem uso ainda.

---

## Passo 4 — Server actions

**Arquivo alterado:** `app/dashboard/cobrancas/actions.ts`

### 4a. Tipos

- Adicionar, junto dos outros tipos exportados:

  ```ts
  export type ComprovanteResultado =
    | { status: 'enviado'; email: string }
    | { status: 'falhou'; email: string }
    | { status: 'sem-email'; pagamentoId: string; quitada: boolean; numeroParcela: number }

  export type CobrancaResponse = {
    success?: string
    error?: string
    comprovante?: ComprovanteResultado
  }
  ```

  (estender o `CobrancaResponse` atual — as outras actions não setam `comprovante`.)

- Import: `import { sendComprovantePagamentoEmail } from '@/utils/email/send-comprovante-pagamento-email'`

### 4b. `registrarPagamento`

Localizar o trecho após `await pagamentoRef.set({...})` e antes do
`revalidatePath('/dashboard/cobrancas')`.

- Já existem em escopo: `parcelaData`, `cobranca` (pode ser `undefined`),
  `valorArredondado`, `totalPago`, `saldo`. `restante = round2(saldo - valorArredondado)`.
- Calcular:

  ```ts
  const quitada = restante <= EPSILON
  const valorPagoAcumulado = round2(totalPago + valorArredondado)
  const valorRestante = Math.max(restante, 0)
  const clienteEmail = ((cobranca?.clienteEmail as string | null) || '').trim()

  const dadosComprovante = {
    clienteNome: cobranca?.clienteNome ?? 'Cliente',
    veiculoResumo: cobranca?.veiculoResumo ?? '',
    numeroParcela: parcelaData.numeroParcela,
    numeroParcelas: cobranca?.numeroParcelas ?? parcelaData.numeroParcela,
    valorParcela: parcelaData.valorParcela,
    valorPagoAgora: valorArredondado,
    dataPagamento: data,
    valorPagoAcumulado,
    valorRestante,
    quitada,
    referencia: pagamentoRef.id.slice(0, 8).toUpperCase(),
  }

  let comprovante: ComprovanteResultado
  if (!clienteEmail) {
    comprovante = { status: 'sem-email', pagamentoId: pagamentoRef.id, quitada, numeroParcela: parcelaData.numeroParcela }
  } else {
    try {
      const ok = await sendComprovantePagamentoEmail({ ...dadosComprovante, clienteEmail })
      comprovante = ok ? { status: 'enviado', email: clienteEmail } : { status: 'falhou', email: clienteEmail }
    } catch (e) {
      console.error('[registrarPagamento] falha ao enviar comprovante:', e)
      comprovante = { status: 'falhou', email: clienteEmail }
    }
  }
  ```

- Incluir `comprovante` nos dois `return` de sucesso (quitada e parcial).

### 4c. `enviarComprovantePagamento`

Nova action exportada, no fim do arquivo:

```ts
export async function enviarComprovantePagamento(
  pagamentoId: string,
  email: string,
): Promise<CobrancaResponse>
```

1. `try { await assertAuthorized() } catch (err) { return { error: ... } }`
2. `const emailTrim = (email || '').trim()`; validar
   `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` → senão `{ error: 'E-mail inválido.' }`.
3. `pagamentoDoc` de `cobranca_pagamentos/{pagamentoId}` → não existe →
   `{ error: 'Pagamento não encontrado.' }`.
4. `parcelaDoc` de `cobranca_parcelas/{pagamento.parcelaId}` → idem.
5. `cobrancaRef = cobrancas/{pagamento.cobrancaId}`; `cobrancaDoc` → idem.
6. `await cobrancaRef.update({ clienteEmail: emailTrim })`.
7. Recalcular a soma dos pagamentos da parcela:
   `pagamentosSnap = where('parcelaId','==',pagamento.parcelaId).get()`;
   `valorPagoAcumulado = round2(soma)`;
   `valorRestante = Math.max(round2(parcela.valorParcela - valorPagoAcumulado), 0)`;
   `quitada = valorRestante <= EPSILON`.
8. `const ok = await sendComprovantePagamentoEmail({ clienteNome: cobranca.clienteNome, veiculoResumo: cobranca.veiculoResumo, numeroParcela: parcela.numeroParcela, numeroParcelas: cobranca.numeroParcelas, valorParcela: parcela.valorParcela, valorPagoAgora: pagamento.valor, dataPagamento: pagamento.data, valorPagoAcumulado, valorRestante, quitada, referencia: pagamentoId.slice(0,8).toUpperCase(), clienteEmail: emailTrim })`
9. `revalidatePath('/dashboard/cobrancas')`
10. `return ok ? { success: \`Comprovante enviado para ${emailTrim}.\` } : { error: 'E-mail salvo, mas o envio falhou. Verifique o RESEND_API_KEY.' }`

**Verificação:** `npm run build` + `npm run lint`.

---

## Passo 5 — Wiring no client

**Arquivo alterado:** `app/dashboard/cobrancas/CobrancasClient.tsx`

### 5a. Imports e estado

- Import: adicionar `enviarComprovantePagamento` à lista importada de `./actions`; tipo
  `ComprovanteResultado` se necessário.
- Estado novo no componente `CobrancasClient`:

  ```ts
  const [comprovanteEmailData, setComprovanteEmailData] =
    useState<{ pagamentoId: string; quitada: boolean; numeroParcela: number } | null>(null)
  const [loadingComprovanteEmail, setLoadingComprovanteEmail] = useState(false)
  ```

### 5b. `handleSubmitPagamento`

Após `registrarPagamento` sem `result.error`:

```ts
const c = result.comprovante
if (c?.status === 'enviado') {
  toast.success(`${result.success ?? 'Pagamento registrado!'} Comprovante enviado para ${c.email}.`)
} else if (c?.status === 'falhou') {
  toast.success(result.success ?? 'Pagamento registrado!')
  toast.error('O comprovante não pôde ser enviado agora. O pagamento foi registrado normalmente.', 'Comprovante')
} else if (c?.status === 'sem-email') {
  toast.success(result.success ?? 'Pagamento registrado!')
  setComprovanteEmailData({ pagamentoId: c.pagamentoId, quitada: c.quitada, numeroParcela: c.numeroParcela })
} else {
  toast.success(result.success || 'Pagamento registrado!')
}
setPagamentoParcela(null)
router.refresh()
```

(manter o `finally { setLoadingPagamento(false) }`.)

### 5c. `handleEnviarComprovanteEmail`

```ts
const handleEnviarComprovanteEmail = useCallback(async (email: string) => {
  if (!comprovanteEmailData) return
  setLoadingComprovanteEmail(true)
  try {
    const result = await enviarComprovantePagamento(comprovanteEmailData.pagamentoId, email)
    if (result.error) { toast.error(result.error); return }
    toast.success(result.success || 'Comprovante enviado!')
    setComprovanteEmailData(null)
    router.refresh()
  } finally {
    setLoadingComprovanteEmail(false)
  }
}, [comprovanteEmailData, router, toast])
```

### 5d. Componente `ComprovantePagamentoEmailModal`

No fim do arquivo, junto dos outros modais. Base: copiar a casca de `PagamentoModal`
(`createPortal`, overlay, header com ícone `IconMail`, footer com Cancelar/confirmar).

- Props: `{ quitada: boolean; numeroParcela: number; loading: boolean; onClose: () => void; onSubmit: (email: string) => void }`.
- Estado: `email`, `errorMsg`.
- Texto explicativo: "O cliente não tem e-mail cadastrado. Informe um e-mail para enviar
  o comprovante da parcela `<numeroParcela>`. Ele ficará salvo no cadastro do cliente."
- Validar regex no submit; erro → `setErrorMsg`, não fecha.
- Botão primário: "Enviar comprovante".
- Botão secundário: "Agora não" → `onClose`.

### 5e. Render

Perto do `{pagamentoParcela && <PagamentoModal .../>}`:

```tsx
{comprovanteEmailData && (
  <ComprovantePagamentoEmailModal
    quitada={comprovanteEmailData.quitada}
    numeroParcela={comprovanteEmailData.numeroParcela}
    loading={loadingComprovanteEmail}
    onClose={() => { if (!loadingComprovanteEmail) setComprovanteEmailData(null) }}
    onSubmit={handleEnviarComprovanteEmail}
  />
)}
```

**Verificação:** `npm run build` + `npm run lint`.

---

## Passo 6 — Verificação manual

Dev server (`preview_start` com o dev server do projeto). Usar as ferramentas de browser
para dirigir a UI e ler console/network.

Cenários (do spec):

1. **Cobrança com `clienteEmail`, pagamento parcial:** registrar pagamento < saldo →
   toast "Comprovante enviado para …"; conferir inbox: assunto "parcial", HTML com saldo
   restante, PDF anexo com carimbo PARCIAL. CC em `libertycar7@gmail.com`.
2. **Mesma cobrança, quitação:** pagar o restante → toast; e-mail "quitação", PDF
   carimbo QUITADA, sem linha de saldo.
3. **Cobrança sem `clienteEmail`:** registrar pagamento → `ComprovantePagamentoEmailModal`
   abre → digitar e-mail válido → toast de sucesso → recarregar / abrir "Editar cobrança"
   e confirmar que `clienteEmail` foi salvo.
4. **E-mail inválido no modal** → erro inline, modal não fecha.
5. **Sem `RESEND_API_KEY`** (remover do `.env.local` e reiniciar): registrar pagamento →
   pagamento salvo + toast de aviso "comprovante não pôde ser enviado".

Registrar evidências (screenshot do toast, print do e-mail/PDF se possível).

---

## Passo 7 — Fechamento

1. `npm run lint` e `npm run build` limpos.
2. Remover qualquer script/arquivo scratch.
3. Commit único (ou 2-3 lógicos) na branch `feat/comprovante-pagamento-email`:
   - `feat(cobrancas): e-mail de comprovante de pagamento com recibo PDF`
   - corpo curto + `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
4. Não fazer merge na `master` sem o "ok" do usuário (mesmo fluxo dos specs).

---

## Riscos / pontos de atenção

- **`renderToBuffer` server-side:** já usado no repo (`app/api/**/pdf/route.ts`), mas é a
  primeira vez fora de um route handler. Se `@react-pdf/renderer` reclamar de ambiente,
  cair para gerar o PDF num route handler interno chamado pelo sender — decidir no Passo 3
  se aparecer erro no build/execução.
- **Tempo de resposta de `registrarPagamento`:** passa a incluir render de PDF + envio.
  Aceito no spec. Se ficar lento no teste manual, anotar para iteração futura (fila /
  não-bloqueante) — não resolver agora.
- **`cobranca` `undefined`:** `registrarPagamento` já busca `cobrancaDoc` e usa `?.` —
  manter os fallbacks; o comprovante nunca deve derrubar o pagamento.
- **Assets do PDF ausentes em produção:** o helper `resolvePublicPath` tenta vários
  caminhos e o documento tem fallback de fonte; logo ausente só remove a imagem, não
  quebra.
