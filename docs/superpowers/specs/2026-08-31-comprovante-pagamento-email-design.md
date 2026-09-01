# E-mail de comprovante de pagamento de parcela

**Data:** 2026-08-31
**Status:** aprovado (design)

## Problema

Quando um pagamento de parcela é registrado em `/dashboard/cobrancas`, o cliente não
recebe nenhuma confirmação. Não há comprovante nem registro formal enviado a ele.

## Objetivo

Ao registrar um pagamento (total ou parcial) de uma parcela, enviar automaticamente ao
cliente um **e-mail de comprovante** com um **recibo em PDF anexo**. Se o cliente não
tiver e-mail cadastrado, abrir um modal pedindo o endereço, salvá-lo na cobrança e enviar.

## Não-objetivos (fora de escopo)

- Botão "reenviar comprovante" no histórico de pagamentos.
- Armazenar o PDF gerado no Firebase Storage.
- Comprovante para o registro de entrada (`valorEntrada`) da cobrança — só parcelas.
- Localização do recibo além de pt-BR / BRL.
- Comprovante para pagamentos criados/editados por outros fluxos que não
  `registrarPagamento`.

## Decisões de design

| Questão | Decisão |
|---|---|
| Gatilho | Todo pagamento registrado via `registrarPagamento` (parcial **e** quitação) |
| Conteúdo | Difere por caso: parcial mostra saldo restante; quitação confirma parcela quitada |
| Formato | E-mail HTML (padrão dos e-mails de lembrete/atraso) + recibo PDF anexo |
| Cliente sem e-mail | Modal pede o e-mail → salva em `cobranca.clienteEmail` → envia |
| Falha de envio | Best-effort: nunca desfaz o pagamento; toast de aviso |
| CC | `libertycar7@gmail.com` (igual aos outros e-mails) |
| Remetente | `Liberty Car <noreply@grupolibertycar.com.br>` (igual aos outros) |

### Assunto do e-mail

- Parcial: `Comprovante de pagamento parcial — Liberty Car`
- Quitação: `Comprovante de quitação da parcela — Liberty Car`

### Abordagem escolhida (A)

O envio acontece **dentro de `registrarPagamento`**, depois de o pagamento estar gravado:

- Se `cobranca.clienteEmail` existe → tenta enviar e retorna o resultado.
- Se não existe → retorna flag `sem-email` + `pagamentoId`; o client abre um modal, o
  usuário digita o e-mail, e uma segunda action (`enviarComprovantePagamento`) salva o
  e-mail na cobrança **e** envia.

Alternativas descartadas: (B) coletar o e-mail dentro do `PagamentoModal` — força ter o
e-mail em mãos antes de registrar o pagamento; (C) sempre enviar de uma action separada
após o pagamento — dois round-trips em todo pagamento.

## Arquitetura

### `utils/email/templates/comprovante-pagamento.ts` (novo)

`renderComprovantePagamentoEmail(data): string` — HTML no mesmo padrão visual de
`utils/email/templates/cobranca-lembrete.ts` (mesma estrutura de tabela, header com
gradiente, badge de status, rodapé). Escapa texto do usuário com `escapeHtml`.

```ts
interface ComprovantePagamentoData {
  clienteNome: string
  veiculoResumo: string
  numeroParcela: number
  numeroParcelas: number
  valorParcela: number       // valor cheio da parcela
  valorPagoAgora: number     // este pagamento
  dataPagamento: string      // YYYY-MM-DD
  valorPagoAcumulado: number // soma de todos os pagamentos da parcela
  valorRestante: number      // 0 quando quitada
  quitada: boolean
  referencia: string         // código curto do recibo (ver abaixo)
}
```

Bloco condicional: `quitada` → badge "PARCELA QUITADA", sem linha de saldo; senão →
badge "PAGAMENTO PARCIAL" + linha "Saldo restante nesta parcela".

### `app/dashboard/cobrancas/pdf/ReciboPagamentoDocument.tsx` (novo)

Documento `@react-pdf/renderer` seguindo o padrão de
`app/dashboard/propostas/pdf/PropostaAutorizacaoDocument.tsx`:

- Reaproveita o helper de carregar asset de `app/public/` como data URL; usa
  `logo-liberty-car-blue.png`. Fontes: tenta registrar as do projeto, com fallback para
  `Helvetica` (mesmo esquema `fontsRegistered`).
- Conteúdo: cabeçalho "RECIBO DE PAGAMENTO" + logo; nº de referência e data de emissão;
  dados do cliente e do veículo; parcela N/total; **valor pago** (este pagamento); data
  do pagamento; valor acumulado pago / saldo restante; carimbo "QUITADA" ou "PARCIAL";
  nota de rodapé (documento gerado automaticamente).
- Props: as mesmas de `ComprovantePagamentoData` + `clienteEmail` e `emitidoEm`.

Referência do recibo (`referencia`): `pagamentoId.slice(0, 8).toUpperCase()`.

### `utils/email/send-comprovante-pagamento-email.ts` (novo)

`sendComprovantePagamentoEmail(payload): Promise<boolean>` — mesmo contrato dos outros
senders (`utils/email/send-cobranca-lembrete-email.ts`): loga erros, **nunca lança**,
retorna `false` se `RESEND_API_KEY` ausente ou envio falha.

Fluxo:

1. Monta o assunto (parcial vs quitação).
2. `renderComprovantePagamentoEmail(...)` → HTML.
3. `renderToBuffer(createElement(ReciboPagamentoDocument, {...}))` → `Buffer` do PDF.
4. `resend.emails.send({ from, to: clienteEmail, cc: 'libertycar7@gmail.com', subject,
   html, attachments: [{ filename: 'comprovante-<referencia>.pdf', content: <base64> }] })`.
   (Resend aceita `content` como base64 string — `buffer.toString('base64')`.)
5. Retorna `true`/`false`.

`payload` carrega tudo que o template e o PDF precisam (ver `ComprovantePagamentoData` +
`clienteEmail`).

### `app/dashboard/cobrancas/actions.ts` (alterado)

**Tipo de retorno.** `registrarPagamento` passa a devolver, além de `success`/`error`, um
campo opcional:

```ts
type ComprovanteResultado =
  | { status: 'enviado'; email: string }
  | { status: 'falhou'; email: string }
  | { status: 'sem-email'; pagamentoId: string; quitada: boolean; numeroParcela: number }

// campo opcional adicionado a CobrancaResponse (as demais actions simplesmente não o setam):
comprovante?: ComprovanteResultado
```

**`registrarPagamento`** — depois de `pagamentoRef.set(...)` e antes do `return`:

1. Calcula `quitada = restante <= EPSILON`.
2. Monta os dados do comprovante a partir de `parcelaData` + `cobranca` + soma de
   pagamentos (já disponível: `totalPago + valorArredondado`).
3. `clienteEmail = (cobranca?.clienteEmail || '').trim()`.
   - Se vazio → `comprovante = { status: 'sem-email', pagamentoId: pagamentoRef.id,
     quitada, numeroParcela: parcelaData.numeroParcela }`.
   - Senão → `const ok = await sendComprovantePagamentoEmail(...)`;
     `comprovante = ok ? { status: 'enviado', email } : { status: 'falhou', email }`.
4. O bloco de envio é `try/catch` isolado — qualquer exceção vira `status: 'falhou'` e
   **não** afeta o `success` do pagamento.

**Nova action `enviarComprovantePagamento(pagamentoId, email)`:**

1. `assertAuthorized()`.
2. Valida `email` com o mesmo regex já usado (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`).
3. Carrega o pagamento; dele, a parcela; dela/dele, a cobrança. Qualquer um ausente →
   `{ error }`.
4. `adminDb.collection('cobrancas').doc(cobrancaId).update({ clienteEmail: email })`.
5. Recalcula soma de pagamentos da parcela → `valorPagoAcumulado`, `valorRestante`,
   `quitada`.
6. `sendComprovantePagamentoEmail(...)`.
7. `revalidatePath('/dashboard/cobrancas')`.
8. Retorna `{ success: 'Comprovante enviado para <email>.' }` ou
   `{ error: 'E-mail salvo, mas o envio falhou. Verifique o RESEND_API_KEY.' }`
   (o e-mail já foi salvo no passo 4 de qualquer forma).

### `app/dashboard/cobrancas/CobrancasClient.tsx` (alterado)

**`handleSubmitPagamento`** — após `registrarPagamento` sem erro, inspeciona
`result.comprovante`:

| `status` | Ação |
|---|---|
| `enviado` | toast success: `"<success> Comprovante enviado para <email>."` |
| `falhou` | toast success do pagamento + toast de aviso: `"Pagamento registrado, mas o comprovante não pôde ser enviado."` |
| `sem-email` | guarda `{ pagamentoId, quitada, numeroParcela }` em estado e abre o `ComprovantePagamentoEmailModal` (não fecha o fluxo com erro) |
| ausente | comportamento atual |

Fecha o `PagamentoModal` e dá `router.refresh()` como hoje; o novo modal, se aberto,
fica por cima.

**Novo componente `ComprovantePagamentoEmailModal`** (no mesmo arquivo, padrão dos outros
modais — `createPortal`, estilo de `PagamentoModal`):

- Um input de e-mail (`type="email"`, autofocus), texto explicando que o comprovante será
  enviado para lá e que o e-mail ficará salvo no cadastro do cliente.
- Validação client-side (regex).
- Submit → `enviarComprovantePagamento(pagamentoId, email)`; sucesso → toast +
  `router.refresh()` + fecha; erro → mostra no modal, não fecha.
- "Agora não" / X → fecha sem enviar (pagamento já está registrado).

## Fluxo de dados

```
PagamentoModal → registrarPagamento(parcelaId, valor, data)
   ├─ grava cobranca_pagamentos + transacao   (inalterado)
   ├─ calcula quitada
   ├─ clienteEmail presente
   │     └─ sendComprovantePagamentoEmail → { enviado | falhou }
   └─ clienteEmail ausente
         └─ { sem-email, pagamentoId, quitada, numeroParcela }
                    │
   client abre ComprovantePagamentoEmailModal
                    │
   enviarComprovantePagamento(pagamentoId, email)
      ├─ cobrancas/{id}.clienteEmail = email
      ├─ recalcula acumulado/restante/quitada
      └─ sendComprovantePagamentoEmail
```

`sendComprovantePagamentoEmail` internamente: `renderComprovantePagamentoEmail` (HTML) +
`renderToBuffer(ReciboPagamentoDocument)` (PDF) → `resend.emails.send` com anexo + CC.

## Tratamento de erros / bordas

| Situação | Comportamento |
|---|---|
| `RESEND_API_KEY` ausente | sender retorna `false` → `status: 'falhou'` → toast de aviso; pagamento salvo |
| Exceção ao gerar PDF ou enviar | `try/catch` no sender e no bloco de `registrarPagamento` → `status: 'falhou'` |
| E-mail digitado no modal é inválido | validação client + na action → modal permanece aberto com erro |
| Pagamento apagado antes de o modal ser enviado | `enviarComprovantePagamento` não acha o pagamento → `{ error }` no modal |
| Usuário fecha o modal sem enviar | Nada é enviado; e-mail não é salvo; pagamento permanece registrado |
| Pagamento parcial seguido da quitação | Dois e-mails: um "parcial" (com saldo), um "quitação" |
| `cobranca` sem `veiculoResumo`/campos | Usa os mesmos fallbacks já presentes em `registrarPagamento` |
| Envio demora | `registrarPagamento` já aguarda o `await` do envio hoje planejado; aceitável (mesma ordem de grandeza dos outros envios). Se virar problema, mover para não-bloqueante numa iteração futura. |

## Convenções

- O sender e o template ficam em `utils/email/`, junto dos existentes, e seguem o mesmo
  contrato (retorna `boolean`, nunca lança, loga com prefixo `[Resend]`).
- Nenhuma mudança no schema de `cobranca_pagamentos` ou `cobranca_parcelas`.
- O único efeito colateral persistente novo é gravar `clienteEmail` na cobrança quando
  informado no modal.

## Teste

O projeto não tem runner de testes. Verificação:

1. `npm run lint` e `npm run build` passam.
2. Manual, no dev server, com `RESEND_API_KEY` configurada e um e-mail de teste:
   - Cobrança **com** `clienteEmail`: registrar pagamento parcial → conferir e-mail
     "parcial" + PDF com saldo restante; registrar o restante → conferir e-mail
     "quitação" + PDF com carimbo QUITADA. CC recebido em `libertycar7@gmail.com`.
   - Cobrança **sem** `clienteEmail`: registrar pagamento → modal abre → digitar e-mail
     → comprovante chega → confirmar que `cobranca.clienteEmail` foi persistido
     (recarregar a página / editar cobrança).
   - E-mail inválido no modal → erro, modal não fecha.
   - Sem `RESEND_API_KEY` → pagamento registra normalmente + toast de aviso.
3. `npm run build` cobre a geração do PDF server-side (import de `@react-pdf/renderer`).
