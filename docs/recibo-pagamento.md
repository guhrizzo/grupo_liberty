# Recibo de pagamento de veículo: guia de implementação

Este documento descreve o **recibo de pagamento de veículo** do projeto **grupo-liberty** (Next.js 16 + Firebase) para que a mesma funcionalidade seja implementada em outro projeto (por exemplo o **liberty-sistema**, que usa Supabase) com comportamento idêntico. Versão de referência: commit `0b15ce0` (19/11/2026).

> Como usar: leia as seções 1 a 4 (o que faz e as regras), copie os arquivos da seção 6 e adapte só o que a seção 5 lista como específico do banco, do armazenamento e da sessão. Tudo em "Código de referência" é a versão Firebase, igual ao que roda hoje.

---

## 1. Visão geral

Em **Contratos > Gerar** há um card "Recibo de pagamento" (`/dashboard/contratos/gerar/recibo`). A pessoa informa quem pagou, qual veículo, quanto e quando, vê uma **simulação** do recibo e gera o **PDF** (A4, uma página). Cada recibo gerado entra num **histórico por mês**, de onde se baixa o PDF de novo ou, sendo administrador, se exclui o registro.

O que a funcionalidade tem:

| Parte | O que faz |
| --- | --- |
| Formulário | Pagador, veículo, pagamento e quem recebeu; tudo com placeholder |
| Busca por placa | Ao completar uma placa válida, preenche marca, modelo, ano, cor, chassi e RENAVAM (Puxa Placa) |
| Simulação | Aba que mostra a folha A4 atualizada a cada tecla, com as lacunas em amarelo |
| PDF | Mesmo conteúdo da simulação, gerado no servidor com `@react-pdf/renderer` |
| Histórico | Lista por mês de pagamento, com total recebido, botão de PDF e (admin) de excluir |
| Guardar no veículo | Opcional: anexa o PDF aos documentos do veículo do estoque |

### Quem pode o quê

| Ação | Quem |
| --- | --- |
| Ver a página, gerar, listar o histórico, baixar o PDF | Quem tem acesso à aba **contratos** (hoje: admin, advogado, vendedor) |
| Excluir um recibo do histórico | Só **admin** (checado no servidor; o botão nem aparece para os outros) |

---

## 2. Regras de negócio (devem ser iguais nos dois sistemas)

### 2.1 Campos e validação (`validarRecibo`)
Mensagem do primeiro problema, na ordem abaixo; o PDF só sai se não houver nenhum.

1. **Pagador:** nome obrigatório; CPF (11 dígitos, validado) **ou** CNPJ (14 dígitos). Telefone, e-mail e endereço são opcionais.
2. **Veículo:** marca, modelo e placa obrigatórios. Ano, cor, chassi e RENAVAM opcionais (só aparecem no recibo se preenchidos).
3. **Quem recebeu:** nome/razão social obrigatório; se houver CNPJ, precisa ter 14 dígitos. Responsável e CPF do responsável (assina o recibo) opcionais. Valor inicial = intermediador padrão (`INTERMEDIADOR_PADRAO`).
4. **Pagamento:**
   - Valor recebido > 0 (formato `1.234,56`).
   - Data do pagamento válida no calendário (`AAAA-MM-DD`). **Não pode ser futura** (checado no servidor, com a data de São Paulo).
   - Valor total do contrato **opcional**; se informado, precisa ser > 0 e **o valor recebido não pode ser maior que ele**.
   - "Referente a" obrigatório (padrão: `pagamento do preço da promessa de compra do veículo acima descrito`).
   - Forma de pagamento opcional (Não informar, PIX, transferência bancária, dinheiro, cartão, boleto).

### 2.2 Selo e saldo
- Com valor total informado: **saldo = total − recebido** (nunca negativo). Saldo 0 → selo **"Pagamento integral"** (verde); saldo > 0 → **"Pagamento parcial"** (âmbar). O painel mostra "Valor total do contrato" e "Saldo restante".
- Sem valor total: sem selo, sem total e sem saldo.

### 2.3 Texto do recibo
Declaração (uma única frase, formato fixo):

> Declaramos ter recebido de **NOME EM MAIÚSCULAS**, CPF|CNPJ nº **000.000.000-00**, na data de **dd/mm/aaaa**, a importância de **R$ 17.000,00 (dezessete mil reais)**[, por **PIX**], referente a **{referência}**. Este recibo dá quitação apenas do valor aqui descrito.

- Valor por extenso em reais e centavos (`reaisPorExtenso`).
- O PDF não afirma forma de pagamento que o usuário não informou.
- Assinatura: uma linha para o **responsável de quem recebeu**, com "CPF nº … · RECEBEDOR".
- Rodapé: `Liberty Car · grupolibertycar.com.br · Jaú/SP`.

### 2.4 Simulação = PDF
Simulação (HTML) e PDF **usam a mesma função** `montarRecibo`, então textos, valores e selos são idênticos. Na simulação, o que falta aparece como `[campo]` destacado em amarelo; no PDF isso nunca ocorre, porque ele só sai depois de validado. O "Emitido em" da simulação é o instante em que a tela abriu; no PDF é o momento da geração (e, ao baixar do histórico, o da emissão original).

### 2.5 Histórico
- Cada recibo gerado grava um registro com os dados completos (`dados`) e colunas de consulta. O **PDF é refeito a partir de `dados`** quando alguém baixa; não se guarda o arquivo.
- O mês do histórico vem da **data do pagamento** (`mes = data.slice(0, 7)`), não do dia da emissão.
- Lista do mês: mais recente primeiro (data do pagamento, depois emissão). Mostra quantidade e **total recebido** do mês.
- Se gravar no histórico falhar, o PDF **ainda é devolvido** e a tela avisa "O recibo foi gerado, mas não entrou no histórico."
- Excluir: só admin, apaga o registro de vez e deixa uma linha no log do servidor (recibo, valor e quem excluiu). **Não** apaga a cópia guardada nos documentos do veículo; o aviso da confirmação diz isso.

### 2.6 Guardar no veículo (opcional)
Com um veículo do estoque escolhido e a caixa marcada, o PDF também vai para os documentos do veículo (Storage + `veiculo_contratos`), na categoria de slug `recibo` (se não existir, fica sem categoria e o nome mostrado é "Recibo de pagamento"). Se o veículo não existir mais, vira um aviso, sem falhar o recibo.

### 2.7 Busca por placa
- Dispara sozinha quando a placa fica completa e válida (`^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$`, Mercosul ou antiga), com **debounce de 600 ms**, uma vez por placa. Não roda com veículo do estoque escolhido; ao escolher um, a placa dele é marcada como "já resolvida".
- Preenche marca, modelo, ano (ano-modelo, 4 dígitos), cor, chassi (17 caracteres) e RENAVAM, **sobrescrevendo** o que estiver digitado nesses campos, mas **só** com o que a consulta devolver (vazio não apaga).
- Se a consulta indicar roubo/furto (qualquer valor diferente de `NAO`), mostra alerta em vez do aviso de sucesso.
- Em caso de erro, libera nova tentativa quando a placa for editada.

---

## 3. Dependências e pré-requisitos

- Pacotes: `@react-pdf/renderer`, `@tabler/icons-react` (ícones), React 19.
- Variável de ambiente: **`PUXA_PLACA_TOKEN`** (Sistema Puxa Placa; cada consulta nova gasta saldo, e o cache de 24 h evita repetir a mesma placa).
- Endpoint interno **`GET /api/consulta-placa?placa=ABC1D23`** (exige login e acesso a alguma aba que consulta placa) devolvendo JSON com ao menos `marca`, `modelo`, `anoModelo`, `cor`, `chassi`, `renavam`, `rouboFurto`. A seção 6.9 traz a implementação de referência (Firestore como cache); se o outro sistema já tiver uma consulta de placa equivalente, basta apontar para ela.
- Imagem **`logo-liberty-car-blue.png`** em `app/public/` (ou `public/`). Sem ela, o PDF sai só com o título "Liberty Car".
- Componentes de UI usados: `Button`, `Input`, `Select`, `SegmentedControl`, `ConfirmDialog`, `useToast`, mais `Bloco` e `Marcar` (blocos de formulário). Adapte aos equivalentes do projeto.
- Permissão: gate da aba `contratos` (`assertPodeGerarContratos` no servidor, `hasPageAccess` na página).

---

## 4. Dados

### 4.1 Firebase (como está hoje)

Coleção **`recibos_pagamento/{id}`** (id automático):

| Campo | Tipo | Observação |
| --- | --- | --- |
| `dados` | map | O formulário normalizado (`ReciboInput`), base para refazer o PDF |
| `emitidoEm` | string | ISO 8601 do momento da geração |
| `mes` | string | `AAAA-MM` do **pagamento** (consulta do mês sem índice composto) |
| `data` | string | `AAAA-MM-DD` do pagamento |
| `pagadorNome`, `pagadorDocumento` | string | Documento só com dígitos |
| `veiculoResumo`, `placa` | string | `"{marca} {modelo}"` e a placa |
| `valor` | number | Valor recebido |
| `valorTotal` | number \| null | Total do contrato, se informado |
| `forma`, `referencia` | string | |
| `veiculoId` | string | Vazio se o veículo foi digitado à mão |
| `geradoPorUid`, `geradoPor` | string | Quem gerou (nome ou e-mail) |

### 4.2 Supabase (para o liberty-sistema)

```sql
create table public.recibos_pagamento (
  id uuid primary key default gen_random_uuid(),
  mes text not null check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),   -- AAAA-MM do pagamento
  data date not null,                                           -- data do pagamento
  emitido_em timestamptz not null default now(),
  pagador_nome text not null,
  pagador_documento text not null,                              -- só dígitos (CPF 11 / CNPJ 14)
  veiculo_resumo text not null,
  placa text not null,
  valor numeric(12,2) not null check (valor > 0),
  valor_total numeric(12,2) check (valor_total is null or valor_total >= valor),
  forma text not null default '',
  referencia text not null,
  veiculo_id text not null default '',
  gerado_por_uid uuid,
  gerado_por text not null default '',
  dados jsonb not null                                          -- ReciboInput normalizado
);
create index recibos_pagamento_mes on public.recibos_pagamento (mes);

-- Acesso só pelo servidor, depois da checagem de permissão (como em ponto_registros).
alter table public.recibos_pagamento enable row level security;
revoke all on public.recibos_pagamento from anon, authenticated;
grant all on public.recibos_pagamento to service_role;
```

---

## 5. O que muda ao levar para o outro sistema (Supabase)

O formulário, a simulação, o PDF, a validação e o texto **não dependem de banco** e podem ser copiados como estão. Mudam só as **ações de servidor** (`actions.ts`, seção 6.5), a sessão e o armazenamento:

| Firebase (referência) | Supabase / liberty-sistema |
| --- | --- |
| `adminDb.collection('recibos_pagamento').add({…})` | `supabaseAdmin.from('recibos_pagamento').insert({ … })` (nomes de coluna em snake_case, conforme 4.2) |
| `.where('mes', '==', mes).get()` | `.select('*').eq('mes', mes).order('data', { ascending: false })` |
| `.doc(id).get()` / `.delete()` | `.select('*').eq('id', id).maybeSingle()` / `.delete().eq('id', id)` |
| `assertPodeGerarContratos()` / `user.role === 'admin'` | O gate de permissão equivalente do liberty-sistema para contratos e o papel de administrador dele |
| `hojeSaoPaulo()` (`utils/cobrancas/encargos`) | Qualquer função que devolva `AAAA-MM-DD` em `America/Sao_Paulo` (o liberty-sistema já tem `hojeSaoPaulo` em `lib/ponto/`) |
| "Guardar no veículo": Storage + `veiculo_contratos` | Use o armazenamento e a tabela de documentos do veículo do outro sistema; se não houver, **remova** a caixa "Guardar o recibo nos documentos do veículo" e o bloco correspondente da ação |
| `id` do histórico (string do Firestore, `[A-Za-z0-9]`) | `uuid`: troque a validação `/^[A-Za-z0-9]{1,40}$/` por uma de UUID |

Atenção ao converter: o valor chega como texto (`1.234,56`) e vira número com `numeroDe`; `valorTotal` vira `null` quando vazio; `pagador_documento` e CPF do responsável ficam **só com dígitos**.

---

## 6. Código de referência

Os caminhos abaixo são do grupo-liberty. As partes específicas de Firebase estão em `actions.ts` (6.5) e na rota de placa (6.9).

### 6.1 Auxiliares usados pelo recibo

**`app/dashboard/contratos/gerar/texto.ts (trecho: valor por extenso, brl e lacuna)`**

```ts
// Apoio ao texto dos contratos gerados: números, valores e datas por extenso, e
// lacunas ("[campo]") para o que o formulário ainda não preencheu — a prévia
// destaca essas lacunas, e o PDF só sai com o formulário completo (validado antes).


const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function ate999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const r = n % 100
  const partes: string[] = []
  if (c) partes.push(CENTENAS[c])
  if (r) {
    if (r < 20) partes.push(UNIDADES[r])
    else partes.push(DEZENAS[Math.floor(r / 10)] + (r % 10 ? ` e ${UNIDADES[r % 10]}` : ''))
  }
  return partes.join(' e ')
}

export function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero'
  const milhoes = Math.floor(n / 1_000_000)
  const milhares = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000
  const blocos: { texto: string; valor: number }[] = []
  if (milhoes) blocos.push({ texto: milhoes === 1 ? 'um milhão' : `${ate999(milhoes)} milhões`, valor: 1000000 })
  if (milhares) blocos.push({ texto: milhares === 1 ? 'mil' : `${ate999(milhares)} mil`, valor: milhares * 1000 })
  if (resto) blocos.push({ texto: ate999(resto), valor: resto })
  // "e" antes do último bloco quando ele é < 100 ou múltiplo de 100.
  const ultimo = blocos[blocos.length - 1]
  const usaE = blocos.length > 1 && (ultimo.valor % 1000 < 100 || ultimo.valor % 100 === 0)
  const textos = blocos.map((b) => b.texto)
  if (!usaE) return textos.join(' ')
  const fim = textos.pop() as string
  return `${textos.join(' ')} e ${fim}`
}

/** 1234.5 → "mil duzentos e trinta e quatro reais e cinquenta centavos". */
export function reaisPorExtenso(valor: number): string {
  const cents = Math.round(valor * 100)
  const reais = Math.floor(cents / 100)
  const centavos = cents % 100
  const partes: string[] = []
  if (reais > 0 || centavos === 0) partes.push(`${inteiroPorExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`)
  if (centavos > 0) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  return partes.join(' e ')
}

export function brl(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

/** Lacuna a preencher: aparece como "[rótulo]" no texto. */
export const lacuna = (rotulo: string) => `[${rotulo}]`
```

**`app/dashboard/contratos/gerar/types.ts (trecho: intermediador padrão, numeroDe, dataIsoValida)`**

```ts
export interface IntermediadorInput {
  razaoSocial: string
  cnpj: string
  endereco: string
  /** Sócio administrador que assina pelo intermediador. */
  nome: string
  nacionalidade: string
  estadoCivil: string
  cpf: string
  email: string
}

/** Valores de partida da promessa parcelada (editáveis no formulário). */
export const INTERMEDIADOR_PADRAO: IntermediadorInput = {
  razaoSocial: '55.116.497 OTAVIO MORETTO',
  cnpj: '55116497000108',
  endereco: 'Av. Doutor Quinzinho, 995, Sala 4, Jardim Jorge Atalla, Jaú/SP',
  nome: 'OTÁVIO MORETTO',
  nacionalidade: 'brasileiro',
  estadoCivil: 'casado',
  cpf: '52052536817',
  email: 'otaviomoretto01@gmail.com',
}

/** Converte "R$ 1.234,56" / "1234,56" / "1234.56" em número. NaN se vazio/ inválido. */
export function numeroDe(raw: string): number {
  const s = String(raw ?? '').replace(/R\$/gi, '').replace(/\s/g, '')
  if (!s) return NaN
  const normal = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  return Number(normal)
}

/** "AAAA-MM-DD" que existe no calendário. */
export function dataIsoValida(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return false
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])
}
```

**`utils/masks.ts`**

```ts
// Máscaras de input. Recebem o valor cru digitado e devolvem a versão formatada.
// Não validam; só formatam o que o usuário digitou. Validação fica por conta do form.

/** Remove tudo que não for dígito. */
export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}

/** Aplica a máscara progressivamente conforme o usuário digita. */
export function maskCPFCNPJ(raw: string): string {
  const d = onlyDigits(raw).slice(0, 14)
  if (d.length <= 11) {
    // CPF: 000.000.000-00
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }
  // CNPJ: 00.000.000/0001-00
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

/** Telefone BR: (00) 0000-0000 ou (00) 00000-0000. */
export function maskPhone(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return d
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

export function maskPlate(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7)

  // Se o 5º caractere (índice 4) for uma letra, tratamos como Mercosul (ex: ABC1D23)
  if (cleaned.length >= 5 && /[A-Z]/.test(cleaned[4])) {
    return cleaned
  }

  // Se o 4º caractere (índice 3) for dígito e o 5º não for letra, formatamos com hífen (ex: ABC-1234)
  if (cleaned.length >= 4 && /\d/.test(cleaned[3])) {
    return cleaned.replace(/^([A-Z]{3})(\d{1,4})/, '$1-$2')
  }

  return cleaned
}

/** Renavam: 11 dígitos, exibe como 000000000-00. */
export function maskRenavam(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  return d.replace(/^(\d{9})(\d)/, '$1-$2')
}

/** Moeda BR: 1.234.567,89 (entrada como string de dígitos). */
export function maskMoney(raw: string): string {
  const d = onlyDigits(raw).slice(0, 15)
  if (!d) return ''
  const cents = d.padStart(3, '0')
  const reais = cents.slice(0, -2).replace(/^0+(?=\d)/, '') || '0'
  const centsPart = cents.slice(-2)
  const reaisFmt = reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${reaisFmt},${centsPart}`
}

/** Converte valor formatado por maskMoney em número (0 se vazio/inválido). */
export function parseMoney(formatted: string): number {
  const cleaned = formatted.replace(/\./g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

/**
 * Formata um número (ou string numérica) em string de moeda pronta para o input
 * monetário. Diferente de `maskMoney`, esta função recebe um VALOR e produz a
 * representação pt-BR — útil para popular inputs ao editar.
 *
 * @example moneyFromNumber(122)   // "R$ 122,00"
 * @example moneyFromNumber(1.5)   // "R$ 1,50"
 * @example moneyFromNumber(0)     // ""
 */
export function moneyFromNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return ''
  // maskMoney espera string de dígitos em centavos (últimos 2 = centavos).
  // Multiplicamos por 100, arredondamos e passamos como string de dígitos puros.
  const centavos = Math.round(n * 100)
  return maskMoney(String(centavos))
}

/** Tabela de máscaras. */
export const MASKS = {
  cpfCnpj: maskCPFCNPJ,
  phone: maskPhone,
  plate: maskPlate,
  renavam: maskRenavam,
  money: maskMoney,
} as const

export type MaskName = keyof typeof MASKS
```

**`utils/validadorCpf.ts`**

```ts
/**
 * Validação matemática oficial de CPF.
 * Retorna true se for válido, false caso contrário.
 */
export function validarCPF(cpf: string): boolean {
  const cleanCpf = cpf.replace(/\D/g, '')

  if (cleanCpf.length !== 11) return false

  // Elimina CPFs conhecidos inválidos
  if (/^(\d)\1{10}$/.test(cleanCpf)) return false

  // Valida 1º dígito
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (10 - i)
  }
  let rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(cleanCpf.charAt(9))) return false

  // Valida 2º dígito
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (11 - i)
  }
  rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(cleanCpf.charAt(10))) return false

  return true
}
```

**`app/dashboard/contratos/gerar/baixar-pdf.ts`**

```ts
/** Baixa no navegador um PDF recebido em base64. */
export function baixarPdf(base64: string, nome: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
```


### 6.2 Tipos e validação

**`app/dashboard/contratos/gerar/recibo/types.ts`**

```ts
// Recibo de pagamento de veículo: tipos e regras. Ficam aqui (não em actions.ts)
// porque arquivos 'use server' só podem exportar funções async.

import { onlyDigits } from '@/utils/masks'
import { validarCPF } from '@/utils/validadorCpf'
import { INTERMEDIADOR_PADRAO, dataIsoValida, numeroDe } from '../types'

export const FORMAS_RECIBO = [
  { value: '', label: 'Não informar' },
  { value: 'PIX', label: 'PIX' },
  { value: 'transferência bancária', label: 'Transferência bancária' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartão', label: 'Cartão' },
  { value: 'boleto', label: 'Boleto' },
] as const

export const REFERENCIA_PADRAO = 'pagamento do preço da promessa de compra do veículo acima descrito'

export interface ReciboPagador {
  nome: string
  /** CPF (11) ou CNPJ (14), só dígitos. */
  documento: string
  endereco: string
  telefone: string
  email: string
}

export interface ReciboVeiculo {
  /** Veículo do estoque (guarda o recibo nos documentos dele); vazio = digitado à mão. */
  veiculoId: string
  marca: string
  modelo: string
  ano: string
  cor: string
  placa: string
  chassi: string
  renavam: string
}

export interface ReciboRecebedor {
  nome: string
  cnpj: string
  endereco: string
  responsavel: string
  responsavelCpf: string
}

export interface ReciboPagamento {
  /** "1.234,56" */
  valor: string
  /** AAAA-MM-DD */
  data: string
  forma: string
  /** Preço total do contrato (opcional): habilita "pagamento parcial" e o saldo. */
  valorTotal: string
  referencia: string
}

export interface ReciboInput {
  pagador: ReciboPagador
  veiculo: ReciboVeiculo
  recebedor: ReciboRecebedor
  pagamento: ReciboPagamento
  guardarNoVeiculo: boolean
}

export const reciboVazio = (): ReciboInput => ({
  pagador: { nome: '', documento: '', endereco: '', telefone: '', email: '' },
  veiculo: { veiculoId: '', marca: '', modelo: '', ano: '', cor: '', placa: '', chassi: '', renavam: '' },
  recebedor: {
    nome: INTERMEDIADOR_PADRAO.razaoSocial,
    cnpj: INTERMEDIADOR_PADRAO.cnpj,
    endereco: INTERMEDIADOR_PADRAO.endereco,
    responsavel: INTERMEDIADOR_PADRAO.nome,
    responsavelCpf: INTERMEDIADOR_PADRAO.cpf,
  },
  pagamento: { valor: '', data: '', forma: '', valorTotal: '', referencia: REFERENCIA_PADRAO },
  guardarNoVeiculo: true,
})

/** Recibo já gerado, como aparece no histórico (coleção `recibos_pagamento`). */
export interface ReciboRegistro {
  id: string
  /** ISO do momento em que o recibo foi emitido. */
  emitidoEm: string
  /** AAAA-MM-DD, data do pagamento. */
  data: string
  pagadorNome: string
  /** CPF ou CNPJ, só dígitos. */
  pagadorDocumento: string
  veiculoResumo: string
  placa: string
  valor: number
  valorTotal: number | null
  forma: string
  referencia: string
  geradoPor: string
}

export type ListarRecibosResponse = { recibos: ReciboRegistro[] } | { error: string }

export type BaixarReciboResponse = { fileName: string; pdfBase64: string } | { error: string }

export type GerarReciboResponse =
  | { error: string }
  | { success: string; fileName: string; pdfBase64: string; guardadoNoVeiculo: boolean; avisos: string[] }

/** Mensagem do primeiro problema do formulário, ou null. */
export function validarRecibo(i: ReciboInput): string | null {
  const p = i.pagador
  if (!p.nome.trim()) return 'Informe o nome do pagador.'
  const doc = onlyDigits(p.documento)
  if (doc.length === 11) {
    if (!validarCPF(doc)) return 'CPF do pagador inválido.'
  } else if (doc.length !== 14) {
    return 'Informe o CPF (11 dígitos) ou CNPJ (14 dígitos) do pagador.'
  }

  const v = i.veiculo
  if (!v.marca.trim()) return 'Informe a marca do veículo.'
  if (!v.modelo.trim()) return 'Informe o modelo do veículo.'
  if (!v.placa.trim()) return 'Informe a placa.'

  const r = i.recebedor
  if (!r.nome.trim()) return 'Informe o nome ou a razão social de quem recebeu.'
  if (r.cnpj && onlyDigits(r.cnpj).length !== 14) return 'O CNPJ de quem recebeu precisa ter 14 dígitos.'

  const g = i.pagamento
  const valor = numeroDe(g.valor)
  if (!(valor > 0)) return 'Informe o valor recebido.'
  if (!dataIsoValida(g.data)) return 'Informe a data do pagamento.'
  if (g.valorTotal.trim()) {
    const total = numeroDe(g.valorTotal)
    if (!(total > 0)) return 'Valor total do contrato inválido.'
    if (valor > total + 0.001) return 'O valor recebido é maior que o valor total do contrato.'
  }
  if (!g.referencia.trim()) return 'Informe a que se refere o pagamento.'
  return null
}
```


### 6.3 Conteúdo do recibo (compartilhado entre PDF e simulação)

**`app/dashboard/contratos/gerar/recibo/montar.ts`**

```ts
// Conteúdo do recibo (textos e valores já formatados), usado pelo PDF (ReciboDocument)
// e pela simulação na tela (ReciboPreview): os dois mostram exatamente o mesmo.
// `[campo]` = lacuna ainda não preenchida (a simulação destaca; o PDF só sai validado).

import { maskCPFCNPJ, onlyDigits } from '@/utils/masks'
import { brl, lacuna, reaisPorExtenso } from '../texto'
import { dataIsoValida, numeroDe } from '../types'
import type { ReciboInput } from './types'

export interface ReciboMontado {
  badge: { texto: string; tom: 'parcial' | 'integral' } | null
  pagador: { nome: string; documento: string; endereco: string; contato: string }
  recebedor: { nome: string; documento: string; endereco: string }
  veiculo: { linha: string; docs: string; placa: string }
  referencia: string
  data: string
  forma: string
  valorRecebido: string
  total: string | null
  saldo: string | null
  declaracao: string
  assinatura: { nome: string; detalhe: string }
  emitidoEm: string
}

/** "2026-11-19" → "19/11/2026" (sem passar por Date, que deslocaria o dia em servidor UTC). */
const dataCurta = (iso: string) => iso.split('-').reverse().join('/')

const emitidoEmTexto = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)

export function montarRecibo(input: ReciboInput, agora: Date): ReciboMontado {
  const { pagador: p, veiculo: v, recebedor: r, pagamento: g } = input

  const valor = numeroDe(g.valor)
  const valorOk = valor > 0
  const total = g.valorTotal.trim() ? numeroDe(g.valorTotal) : null
  const totalOk = total !== null && total > 0
  const saldo = totalOk && valorOk ? Math.max(0, Math.round((total - valor) * 100) / 100) : null

  const doc = onlyDigits(p.documento)
  const rotuloDoc = doc.length === 14 ? 'CNPJ' : 'CPF'
  const nome = p.nome.trim() ? p.nome.trim().toUpperCase() : lacuna('nome do pagador')
  const docTexto = doc ? maskCPFCNPJ(doc) : lacuna('CPF ou CNPJ')
  const data = dataIsoValida(g.data) ? dataCurta(g.data) : lacuna('data')
  const forma = g.forma.trim()
  const referencia = g.referencia.trim() || lacuna('referência')
  const valorTexto = valorOk ? brl(valor) : lacuna('valor')
  const valorExtenso = valorOk ? `${brl(valor)} (${reaisPorExtenso(valor)})` : lacuna('valor')

  const marcaModelo = `${v.marca.trim() || lacuna('marca')} ${v.modelo.trim() || lacuna('modelo')}`
  const veiculoLinha = [marcaModelo, v.ano.trim(), v.cor.trim()].filter(Boolean).join(' · ') + ` · Placa ${v.placa.trim() || lacuna('placa')}`
  const veiculoDocs = [v.chassi.trim() && `Chassi ${v.chassi.trim()}`, v.renavam.trim() && `RENAVAM ${v.renavam.trim()}`].filter(Boolean).join(' · ')

  const contato = [p.telefone.trim(), p.email.trim()].filter(Boolean).join(' · ')
  const respCpf = onlyDigits(r.responsavelCpf)

  return {
    badge:
      totalOk && valorOk
        ? saldo === 0
          ? { texto: 'Pagamento integral', tom: 'integral' }
          : { texto: 'Pagamento parcial', tom: 'parcial' }
        : null,
    pagador: { nome, documento: `${rotuloDoc} nº ${docTexto}`, endereco: p.endereco.trim(), contato },
    recebedor: {
      nome: r.nome.trim() || lacuna('quem recebeu'),
      documento: onlyDigits(r.cnpj) ? `CNPJ nº ${maskCPFCNPJ(r.cnpj)}` : '',
      endereco: r.endereco.trim(),
    },
    veiculo: { linha: veiculoLinha, docs: veiculoDocs, placa: v.placa.trim() || lacuna('placa') },
    referencia,
    data,
    forma,
    valorRecebido: valorTexto,
    total: totalOk ? brl(total as number) : null,
    saldo: saldo !== null ? brl(saldo) : null,
    declaracao: `Declaramos ter recebido de ${nome}, ${rotuloDoc} nº ${docTexto}, na data de ${data}, a importância de ${valorExtenso}${forma ? `, por ${forma}` : ''}, referente a ${referencia}. Este recibo dá quitação apenas do valor aqui descrito.`,
    assinatura: {
      nome: r.responsavel.trim() || r.nome.trim() || lacuna('responsável'),
      detalhe: `${respCpf ? `CPF nº ${maskCPFCNPJ(respCpf)} · ` : ''}RECEBEDOR`,
    },
    emitidoEm: emitidoEmTexto(agora),
  }
}
```


### 6.4 PDF e simulação

**`app/dashboard/contratos/gerar/recibo/ReciboDocument.tsx`**

```tsx
import fs from 'node:fs'
import path from 'node:path'
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { montarRecibo } from './montar'
import type { ReciboInput } from './types'

// Recibo de pagamento de veículo (PDF). Mesmo visual do recibo de parcela
// (cobrancas/pdf/ReciboPagamentoDocument): logo, Helvetica e painel de valores.

const LOGO = (() => {
  for (const base of [path.join(process.cwd(), 'app', 'public'), path.join(process.cwd(), 'public')]) {
    try {
      const f = path.join(base, 'logo-liberty-car-blue.png')
      if (fs.existsSync(f)) return `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`
    } catch {
      // sem o arquivo, o recibo sai só com o título.
    }
  }
  return ''
})()

const C = {
  ink: '#09090b',
  muted: '#71717a',
  faint: '#a1a1aa',
  line: '#e4e4e7',
  panel: '#fafafa',
  amber: '#b45309',
  amberBg: '#fffbeb',
  green: '#047857',
  greenBg: '#ecfdf5',
}

const s = StyleSheet.create({
  page: { paddingVertical: 44, paddingHorizontal: 48, fontFamily: 'Helvetica', fontSize: 10, color: C.ink, lineHeight: 1.5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  logo: { width: 120 },
  headerRight: { alignItems: 'flex-end' },
  titulo: { fontFamily: 'Helvetica-Bold', fontSize: 16, letterSpacing: 1, textTransform: 'uppercase' },
  meta: { fontSize: 9, color: C.muted, marginTop: 4 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingVertical: 5, paddingHorizontal: 14, marginBottom: 18 },
  badgeText: { fontFamily: 'Helvetica-Bold', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' },
  label: { fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: C.faint, marginBottom: 3 },
  bloco: { marginBottom: 14 },
  valor: { fontSize: 11 },
  apoio: { color: C.muted },
  painel: { borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: C.panel, padding: 16, marginBottom: 16 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  linhaFim: { flexDirection: 'row', justifyContent: 'space-between' },
  rotulo: { color: C.muted },
  rotuloTexto: { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold', marginLeft: 16 },
  negrito: { fontFamily: 'Helvetica-Bold' },
  grande: { fontFamily: 'Helvetica-Bold', fontSize: 13 },
  divisor: { borderTopWidth: 1, borderTopColor: C.line, marginVertical: 9 },
  declaracao: { fontSize: 10.5, textAlign: 'justify', marginBottom: 6 },
  assinatura: { marginTop: 40, alignItems: 'center' },
  assinaturaLinha: { width: 260, borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 4, alignItems: 'center' },
  rodape: { marginTop: 'auto', paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line, fontSize: 8, color: C.faint, textAlign: 'center' },
})

export default function ReciboDocument({ input, agora }: { input: ReciboInput; agora: Date }) {
  const m = montarRecibo(input, agora)
  const cor = m.badge?.tom === 'integral' ? C.green : m.badge ? C.amber : C.ink

  return (
    <Document title={`Recibo de pagamento — ${input.pagador.nome}`} author="Liberty Car" subject={`Veículo ${input.veiculo.placa}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {LOGO ? <Image src={LOGO} style={s.logo} /> : <Text style={s.titulo}>Liberty Car</Text>}
          <View style={s.headerRight}>
            <Text style={s.titulo}>Recibo de pagamento</Text>
            <Text style={s.meta}>Veículo: {m.veiculo.placa}</Text>
            <Text style={s.meta}>Emitido em: {m.emitidoEm}</Text>
          </View>
        </View>

        {m.badge && (
          <View style={[s.badge, { borderColor: cor, backgroundColor: m.badge.tom === 'integral' ? C.greenBg : C.amberBg }]}>
            <Text style={[s.badgeText, { color: cor }]}>{m.badge.texto}</Text>
          </View>
        )}

        <View style={s.bloco}>
          <Text style={s.label}>Pagador</Text>
          <Text style={s.valor}>{m.pagador.nome}</Text>
          <Text style={s.apoio}>{m.pagador.documento}</Text>
          {m.pagador.endereco ? <Text style={s.apoio}>{m.pagador.endereco}</Text> : null}
          {m.pagador.contato ? <Text style={s.apoio}>{m.pagador.contato}</Text> : null}
        </View>

        <View style={s.bloco}>
          <Text style={s.label}>Recebedor</Text>
          <Text style={s.valor}>{m.recebedor.nome}</Text>
          {m.recebedor.documento ? <Text style={s.apoio}>{m.recebedor.documento}</Text> : null}
          {m.recebedor.endereco ? <Text style={s.apoio}>{m.recebedor.endereco}</Text> : null}
        </View>

        <View style={s.bloco}>
          <Text style={s.label}>Veículo</Text>
          <Text style={s.valor}>{m.veiculo.linha}</Text>
          {m.veiculo.docs ? <Text style={s.apoio}>{m.veiculo.docs}</Text> : null}
        </View>

        <View style={s.painel}>
          <View style={s.linha}>
            <Text style={s.rotulo}>Referente a</Text>
            <Text style={s.rotuloTexto}>{m.referencia}</Text>
          </View>
          <View style={s.linha}>
            <Text style={s.rotulo}>Data do pagamento</Text>
            <Text style={s.negrito}>{m.data}</Text>
          </View>
          {m.forma ? (
            <View style={s.linha}>
              <Text style={s.rotulo}>Forma de pagamento</Text>
              <Text style={s.negrito}>{m.forma}</Text>
            </View>
          ) : null}
          <View style={s.divisor} />
          <View style={m.total === null ? s.linhaFim : s.linha}>
            <Text style={s.rotulo}>Valor recebido</Text>
            <Text style={[s.grande, { color: cor }]}>{m.valorRecebido}</Text>
          </View>
          {m.total !== null && m.saldo !== null ? (
            <>
              <View style={s.linha}>
                <Text style={s.rotulo}>Valor total do contrato</Text>
                <Text style={s.negrito}>{m.total}</Text>
              </View>
              <View style={s.linhaFim}>
                <Text style={s.rotulo}>Saldo restante</Text>
                <Text style={s.negrito}>{m.saldo}</Text>
              </View>
            </>
          ) : null}
        </View>

        <Text style={s.declaracao}>{m.declaracao}</Text>

        <View style={s.assinatura}>
          <View style={s.assinaturaLinha}>
            <Text style={s.negrito}>{m.assinatura.nome}</Text>
            <Text style={s.apoio}>{m.assinatura.detalhe}</Text>
          </View>
        </View>

        <Text style={s.rodape}>Liberty Car · grupolibertycar.com.br · Jaú/SP</Text>
      </Page>
    </Document>
  )
}
```

**`app/dashboard/contratos/gerar/recibo/ReciboPreview.tsx`**

```tsx
'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import LOGO_LIBERTY from '@/app/public/logo-liberty-car-blue.png'
import { montarRecibo } from './montar'
import type { ReciboInput } from './types'

// Simulação do recibo em folha A4, atualizada a cada tecla. Usa as mesmas medidas e o
// mesmo conteúdo do PDF (montarRecibo), então o que aparece aqui é o que será gerado.
// `[campo]` = lacuna ainda não preenchida (destacada).

const LARGURA = 794 // A4 a 96 dpi (px)
const ALTURA = 1123

// Folha de papel: sempre branca com texto escuro, também no tema escuro. Cores fixas (inline):
// o tema escuro repinta as classes de cor e sumiria sobre este fundo.
const C = { ink: '#09090b', muted: '#71717a', faint: '#a1a1aa', line: '#e4e4e7', panel: '#fafafa', amber: '#b45309', amberBg: '#fffbeb', green: '#047857', greenBg: '#ecfdf5' }

function Lacunas({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\[[^\]]*\])/g).map((parte, idx) =>
        /^\[[^\]]*\]$/.test(parte) ? (
          <mark key={idx} className="rounded-sm px-0.5 font-medium" style={{ backgroundColor: '#fde68a', color: '#451a03' }}>
            {parte}
          </mark>
        ) : (
          parte
        ),
      )}
    </>
  )
}

const rotulo: React.CSSProperties = { fontWeight: 700, fontSize: '8pt', letterSpacing: '1px', textTransform: 'uppercase', color: C.faint, marginBottom: '3pt' }

function Linha({ nome, children, ultima }: { nome: string; children: React.ReactNode; ultima?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16pt', marginBottom: ultima ? 0 : '7pt' }}>
      <span style={{ color: C.muted }}>{nome}</span>
      <span style={{ fontWeight: 700, textAlign: 'right' }}>{children}</span>
    </div>
  )
}

export default function ReciboPreview({ input }: { input: ReciboInput }) {
  // Instante da simulação: fixo enquanto a tela está aberta (o PDF usa o momento da geração).
  const agora = useMemo(() => new Date(), [])
  const m = montarRecibo(input, agora)
  const cor = m.badge?.tom === 'integral' ? C.green : m.badge ? C.amber : C.ink

  const [escala, setEscala] = useState(1)
  const raiz = useRef<HTMLDivElement>(null)
  // Encolhe a folha quando a área é mais estreita que um A4.
  useLayoutEffect(() => {
    const el = raiz.current
    if (!el) return
    const ajustar = () => setEscala(Math.min(1, el.clientWidth / LARGURA))
    ajustar()
    const obs = new ResizeObserver(ajustar)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={raiz} aria-label="Simulação do recibo" className="w-full">
      <div className="mx-auto" style={{ width: LARGURA * escala, height: ALTURA * escala }}>
        <div
          className="overflow-hidden rounded-sm shadow-md"
          style={{
            width: LARGURA,
            height: ALTURA,
            padding: '44pt 48pt',
            transform: `scale(${escala})`,
            transformOrigin: 'top left',
            backgroundColor: '#fff',
            color: C.ink,
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: '10pt',
            lineHeight: 1.5,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Cabeçalho */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22pt' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_LIBERTY.src} alt="Liberty Car" draggable={false} style={{ width: '120pt' }} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: '16pt', letterSpacing: '1px', textTransform: 'uppercase' }}>Recibo de pagamento</div>
              <div style={{ fontSize: '9pt', color: C.muted, marginTop: '4pt' }}>
                Veículo: <Lacunas texto={m.veiculo.placa} />
              </div>
              <div style={{ fontSize: '9pt', color: C.muted }}>Emitido em: {m.emitidoEm}</div>
            </div>
          </div>

          {m.badge && (
            <div
              style={{
                alignSelf: 'flex-start',
                borderRadius: 999,
                border: `1px solid ${cor}`,
                backgroundColor: m.badge.tom === 'integral' ? C.greenBg : C.amberBg,
                color: cor,
                padding: '5pt 14pt',
                marginBottom: '18pt',
                fontWeight: 700,
                fontSize: '9pt',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
              }}
            >
              {m.badge.texto}
            </div>
          )}

          <div style={{ marginBottom: '14pt' }}>
            <div style={rotulo}>Pagador</div>
            <div style={{ fontSize: '11pt' }}>
              <Lacunas texto={m.pagador.nome} />
            </div>
            <div style={{ color: C.muted }}>
              <Lacunas texto={m.pagador.documento} />
            </div>
            {m.pagador.endereco && <div style={{ color: C.muted }}>{m.pagador.endereco}</div>}
            {m.pagador.contato && <div style={{ color: C.muted }}>{m.pagador.contato}</div>}
          </div>

          <div style={{ marginBottom: '14pt' }}>
            <div style={rotulo}>Recebedor</div>
            <div style={{ fontSize: '11pt' }}>
              <Lacunas texto={m.recebedor.nome} />
            </div>
            {m.recebedor.documento && <div style={{ color: C.muted }}>{m.recebedor.documento}</div>}
            {m.recebedor.endereco && <div style={{ color: C.muted }}>{m.recebedor.endereco}</div>}
          </div>

          <div style={{ marginBottom: '14pt' }}>
            <div style={rotulo}>Veículo</div>
            <div style={{ fontSize: '11pt' }}>
              <Lacunas texto={m.veiculo.linha} />
            </div>
            {m.veiculo.docs && <div style={{ color: C.muted }}>{m.veiculo.docs}</div>}
          </div>

          <div style={{ border: `1px solid ${C.line}`, borderRadius: '10pt', backgroundColor: C.panel, padding: '16pt', marginBottom: '16pt' }}>
            <Linha nome="Referente a">
              <Lacunas texto={m.referencia} />
            </Linha>
            <Linha nome="Data do pagamento">
              <Lacunas texto={m.data} />
            </Linha>
            {m.forma && <Linha nome="Forma de pagamento">{m.forma}</Linha>}
            <div style={{ borderTop: `1px solid ${C.line}`, margin: '9pt 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: m.total === null ? 0 : '7pt' }}>
              <span style={{ color: C.muted }}>Valor recebido</span>
              <span style={{ fontWeight: 700, fontSize: '13pt', color: cor }}>
                <Lacunas texto={m.valorRecebido} />
              </span>
            </div>
            {m.total !== null && m.saldo !== null && (
              <>
                <Linha nome="Valor total do contrato">{m.total}</Linha>
                <Linha nome="Saldo restante" ultima>
                  {m.saldo}
                </Linha>
              </>
            )}
          </div>

          <p style={{ fontSize: '10.5pt', textAlign: 'justify', margin: '0 0 6pt' }}>
            <Lacunas texto={m.declaracao} />
          </p>

          <div style={{ marginTop: '40pt', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '260pt', borderTop: `1px solid ${C.ink}`, paddingTop: '4pt', textAlign: 'center' }}>
              <div style={{ fontWeight: 700 }}>
                <Lacunas texto={m.assinatura.nome} />
              </div>
              <div style={{ color: C.muted }}>{m.assinatura.detalhe}</div>
            </div>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '14pt', borderTop: `1px solid ${C.line}`, fontSize: '8pt', color: C.faint, textAlign: 'center' }}>
            Liberty Car · grupolibertycar.com.br · Jaú/SP
          </div>
        </div>
      </div>
    </div>
  )
}
```


### 6.5 Ações de servidor (versão Firebase: adapte conforme a seção 5)

**`app/dashboard/contratos/gerar/recibo/actions.ts`**

```ts
'use server'

// Recibo de pagamento de veículo: valida o formulário, monta o PDF e, se o veículo
// é do estoque, guarda o recibo nos documentos dele (`veiculo_contratos`).

import { revalidatePath } from 'next/cache'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { adminDb, adminStorage } from '@/utils/firebase/admin'
import { assertPodeGerarContratos } from '@/utils/permissions'
import { hojeSaoPaulo } from '@/utils/cobrancas/encargos'
import { onlyDigits } from '@/utils/masks'
import ReciboDocument from './ReciboDocument'
import { numeroDe } from '../types'
import {
  validarRecibo,
  type BaixarReciboResponse,
  type GerarReciboResponse,
  type ListarRecibosResponse,
  type ReciboInput,
  type ReciboRegistro,
} from './types'

const COLECAO = 'recibos_pagamento'

function txt(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

function normalizar(raw: unknown): ReciboInput {
  const r = obj(raw)
  const p = obj(r.pagador)
  const v = obj(r.veiculo)
  const e = obj(r.recebedor)
  const g = obj(r.pagamento)
  const data = txt(g.data, 10)
  return {
    pagador: {
      nome: txt(p.nome, 120),
      documento: onlyDigits(txt(p.documento, 20)).slice(0, 14),
      endereco: txt(p.endereco, 250),
      telefone: txt(p.telefone, 25),
      email: txt(p.email, 120).toLowerCase(),
    },
    veiculo: {
      veiculoId: /^[A-Za-z0-9_-]{1,100}$/.test(txt(v.veiculoId, 100)) ? txt(v.veiculoId, 100) : '',
      marca: txt(v.marca, 60),
      modelo: txt(v.modelo, 80),
      ano: txt(v.ano, 10),
      cor: txt(v.cor, 30),
      placa: txt(v.placa, 10).toUpperCase(),
      chassi: txt(v.chassi, 25).toUpperCase(),
      renavam: txt(v.renavam, 15),
    },
    recebedor: {
      nome: txt(e.nome, 120),
      cnpj: onlyDigits(txt(e.cnpj, 20)).slice(0, 14),
      endereco: txt(e.endereco, 250),
      responsavel: txt(e.responsavel, 120),
      responsavelCpf: onlyDigits(txt(e.responsavelCpf, 20)).slice(0, 11),
    },
    pagamento: {
      valor: txt(g.valor, 20),
      data: /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : '',
      forma: txt(g.forma, 40),
      valorTotal: txt(g.valorTotal, 20),
      referencia: txt(g.referencia, 200),
    },
    guardarNoVeiculo: r.guardarNoVeiculo !== false,
  }
}

function nomeArquivo(cliente: string): string {
  const base = cliente
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 50)
  return `recibo_pagamento_${base || 'cliente'}.pdf`
}

export async function gerarReciboAction(raw: unknown): Promise<GerarReciboResponse> {
  let user: Awaited<ReturnType<typeof assertPodeGerarContratos>>
  try {
    user = await assertPodeGerarContratos()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  const input = normalizar(raw)
  const erro = validarRecibo(input)
  if (erro) return { error: erro }
  if (input.pagamento.data > hojeSaoPaulo()) return { error: 'A data do pagamento não pode ser futura.' }

  const agora = new Date()
  let buffer: Buffer
  try {
    buffer = await renderToBuffer(createElement(ReciboDocument, { input, agora }) as never)
  } catch (err) {
    console.error('[gerarReciboAction] pdf', err)
    return { error: 'Erro ao gerar o PDF do recibo.' }
  }
  const fileName = nomeArquivo(input.pagador.nome)

  const avisos: string[] = []
  let guardadoNoVeiculo = false
  const veiculoId = input.veiculo.veiculoId
  if (veiculoId && input.guardarNoVeiculo) {
    try {
      if (!(await adminDb.collection('veiculos').doc(veiculoId).get()).exists) {
        avisos.push('Veículo não encontrado: o recibo não foi guardado no veículo.')
      } else {
        const cat = await adminDb.collection('contrato_categorias').where('slug', '==', 'recibo').limit(1).get()
        const ref = adminDb.collection('veiculo_contratos').doc()
        const storagePath = `veiculos/${veiculoId}/contratos/${ref.id}.pdf`
        await adminStorage.bucket().file(storagePath).save(buffer, {
          contentType: 'application/pdf',
          metadata: { metadata: { uploadedBy: user.uid } },
        })
        await ref.set({
          id: ref.id,
          veiculoId,
          fileName,
          descricao: `Recibo gerado pelo painel — ${input.pagador.nome}`,
          storagePath,
          contentType: 'application/pdf',
          size: buffer.length,
          uploadedByUid: user.uid,
          uploadedByEmail: user.email ?? null,
          uploadedAt: agora.toISOString(),
          enviarJuridico: false,
          categoriaId: cat.empty ? null : cat.docs[0].id,
          categoriaNome: cat.empty ? 'Recibo de pagamento' : String(cat.docs[0].data().nome ?? 'Recibo de pagamento'),
        })
        guardadoNoVeiculo = true
        revalidatePath(`/veiculos/${veiculoId}`)
        revalidatePath('/dashboard/contratos')
      }
    } catch (err) {
      console.error('[gerarReciboAction] veiculo', err)
      avisos.push('Não foi possível guardar o recibo no veículo.')
    }
  }

  // Histórico mensal: guarda os dados do recibo (o PDF é refeito a partir deles).
  try {
    const total = input.pagamento.valorTotal.trim() ? numeroDe(input.pagamento.valorTotal) : null
    await adminDb.collection(COLECAO).add({
      dados: input,
      emitidoEm: agora.toISOString(),
      mes: input.pagamento.data.slice(0, 7),
      data: input.pagamento.data,
      pagadorNome: input.pagador.nome,
      pagadorDocumento: input.pagador.documento,
      veiculoResumo: `${input.veiculo.marca} ${input.veiculo.modelo}`.trim(),
      placa: input.veiculo.placa,
      valor: numeroDe(input.pagamento.valor),
      valorTotal: total,
      forma: input.pagamento.forma,
      referencia: input.pagamento.referencia,
      veiculoId: input.veiculo.veiculoId,
      geradoPorUid: user.uid,
      geradoPor: user.name || user.email || user.uid,
    })
  } catch (err) {
    console.error('[gerarReciboAction] historico', err)
    avisos.push('O recibo foi gerado, mas não entrou no histórico.')
  }

  return { success: 'Recibo gerado.', fileName, pdfBase64: buffer.toString('base64'), guardadoNoVeiculo, avisos }
}

/** Recibos do mês (pela data do pagamento), do mais recente para o mais antigo. */
export async function listarRecibosAction(mes: string): Promise<ListarRecibosResponse> {
  try {
    await assertPodeGerarContratos()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return { error: 'Mês inválido.' }
  try {
    const snap = await adminDb.collection(COLECAO).where('mes', '==', mes).get()
    const recibos: ReciboRegistro[] = snap.docs
      .map((d) => {
        const x = d.data()
        return {
          id: d.id,
          emitidoEm: String(x.emitidoEm ?? ''),
          data: String(x.data ?? ''),
          pagadorNome: String(x.pagadorNome ?? ''),
          pagadorDocumento: String(x.pagadorDocumento ?? ''),
          veiculoResumo: String(x.veiculoResumo ?? ''),
          placa: String(x.placa ?? ''),
          valor: Number(x.valor ?? 0),
          valorTotal: typeof x.valorTotal === 'number' ? x.valorTotal : null,
          forma: String(x.forma ?? ''),
          referencia: String(x.referencia ?? ''),
          geradoPor: String(x.geradoPor ?? ''),
        }
      })
      .sort((a, b) => b.data.localeCompare(a.data) || b.emitidoEm.localeCompare(a.emitidoEm))
    return { recibos }
  } catch (err) {
    console.error('[listarRecibosAction]', err)
    return { error: 'Não foi possível carregar o histórico.' }
  }
}

/** Refaz o PDF de um recibo do histórico, com a data de emissão original. */
export async function baixarReciboAction(id: string): Promise<BaixarReciboResponse> {
  try {
    await assertPodeGerarContratos()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }
  if (!/^[A-Za-z0-9]{1,40}$/.test(id)) return { error: 'Recibo inválido.' }
  try {
    const snap = await adminDb.collection(COLECAO).doc(id).get()
    if (!snap.exists) return { error: 'Recibo não encontrado.' }
    const x = snap.data()!
    const input = normalizar(x.dados)
    const emitido = new Date(String(x.emitidoEm))
    const buffer = await renderToBuffer(
      createElement(ReciboDocument, { input, agora: Number.isNaN(emitido.getTime()) ? new Date() : emitido }) as never,
    )
    return { fileName: nomeArquivo(input.pagador.nome), pdfBase64: buffer.toString('base64') }
  } catch (err) {
    console.error('[baixarReciboAction]', err)
    return { error: 'Não foi possível gerar o PDF do recibo.' }
  }
}

/** Exclui um recibo do histórico. Só administradores: é registro de dinheiro recebido. */
export async function excluirReciboAction(id: string): Promise<{ success: string } | { error: string }> {
  let user: Awaited<ReturnType<typeof assertPodeGerarContratos>>
  try {
    user = await assertPodeGerarContratos()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }
  if (user.role !== 'admin') return { error: 'Apenas administradores podem excluir recibos.' }
  if (!/^[A-Za-z0-9]{1,40}$/.test(id)) return { error: 'Recibo inválido.' }
  try {
    const ref = adminDb.collection(COLECAO).doc(id)
    const snap = await ref.get()
    if (!snap.exists) return { error: 'Recibo não encontrado (talvez já excluído).' }
    const x = snap.data()!
    await ref.delete()
    console.info('[excluirReciboAction]', id, x.pagadorNome, x.valor, 'por', user.email ?? user.uid)
    return { success: 'Recibo excluído do histórico.' }
  } catch (err) {
    console.error('[excluirReciboAction]', err)
    return { error: 'Não foi possível excluir o recibo.' }
  }
}
```


### 6.6 Busca por placa (hook)

**`app/dashboard/contratos/gerar/useBuscaPlaca.ts`**

```ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/app/components/ui'

// Busca por placa (Sistema Puxa Placa) compartilhada pelos formulários de contrato e de
// recibo. Mesmo endpoint do cadastro de veículo. Assim que a placa fica completa e
// válida, consulta sozinha (debounce de 600 ms). O resultado fica 24 h em cache no
// servidor, então repetir a mesma placa no dia não gasta saldo.

const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
const limpar = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '')

export interface DadosPlaca {
  marca?: string
  modelo?: string
  anoModelo?: string | number
  cor?: string
  chassi?: string
  renavam?: string
  rouboFurto?: string
}

/**
 * @param placa  placa digitada (com ou sem máscara)
 * @param ativo  false desliga a busca (ex.: veículo do estoque escolhido: os dados dele valem)
 * @param onDados recebe os dados encontrados para o formulário preencher os campos
 */
export function useBuscaPlaca(placa: string, ativo: boolean, onDados: (d: DadosPlaca) => void) {
  const toast = useToast()
  const [buscando, setBuscando] = useState(false)
  const jaBuscadaRef = useRef('')
  const onDadosRef = useRef(onDados)
  useEffect(() => {
    onDadosRef.current = onDados
  })

  const buscar = useCallback(
    async (p: string) => {
      setBuscando(true)
      try {
        const res = await fetch(`/api/consulta-placa?placa=${p}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.message || err.error || 'Não encontramos registro para a placa informada.')
        }
        const data = (await res.json()) as DadosPlaca
        onDadosRef.current(data)
        if (data.rouboFurto && data.rouboFurto !== 'NAO') {
          toast.error(`Status retornado: ${data.rouboFurto}. Confira antes de seguir.`, 'Ocorrência de roubo/furto')
        } else {
          toast.success('Marca, modelo, ano, cor, chassi e RENAVAM preenchidos. Confira os dados.', 'Placa encontrada')
        }
      } catch (err) {
        // Permite tentar de novo quando a placa for editada.
        jaBuscadaRef.current = ''
        toast.error(err instanceof Error ? err.message : 'Erro ao consultar a placa.', 'Falha na busca')
      } finally {
        setBuscando(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    if (!ativo) return
    const p = limpar(placa)
    if (!PLACA_REGEX.test(p)) {
      jaBuscadaRef.current = ''
      return
    }
    if (jaBuscadaRef.current === p) return
    const id = window.setTimeout(() => {
      jaBuscadaRef.current = p
      void buscar(p)
    }, 600)
    return () => window.clearTimeout(id)
  }, [placa, ativo, buscar])

  /** Marca a placa como já resolvida (não consulta), ex.: ao escolher um veículo do estoque. */
  const marcarJaBuscada = useCallback((p: string) => {
    jaBuscadaRef.current = limpar(p)
  }, [])

  return { buscando, marcarJaBuscada }
}
```


### 6.7 Página, formulário e histórico

**`app/dashboard/contratos/gerar/recibo/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import { paraVeiculoContrato } from '../veiculos-para-contrato'
import ReciboPageClient from './ReciboPageClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Recibo de pagamento | Liberty Car',
  description: 'Gere o recibo do pagamento recebido por um veículo, com os dados do cliente e do veículo.',
}

export default async function ReciboPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'contratos')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const veiculos = (await getVehicles()).map(paraVeiculoContrato)
  return <ReciboPageClient veiculos={veiculos} podeExcluir={user.role === 'admin'} />
}
```

**`app/dashboard/contratos/gerar/recibo/ReciboPageClient.tsx`**

```tsx
'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { IconArrowLeft, IconFileDownload, IconReceipt } from '@tabler/icons-react'
import { Button, Input, SegmentedControl, Select, useToast } from '@/app/components/ui'
import { maskCPFCNPJ, maskMoney, maskPhone, maskPlate, maskRenavam, onlyDigits } from '@/utils/masks'
import { listarClientesContratoAction } from '../actions'
import { baixarPdf } from '../baixar-pdf'
import { Bloco, Marcar } from '../campos'
import { useBuscaPlaca } from '../useBuscaPlaca'
import { numeroDe, type ClienteContrato, type VeiculoParaContrato } from '../types'
import { gerarReciboAction } from './actions'
import HistoricoRecibos from './HistoricoRecibos'
import ReciboPreview from './ReciboPreview'
import { FORMAS_RECIBO, reciboVazio, validarRecibo, type ReciboInput } from './types'

type Aba = 'dados' | 'simulacao'

const ABAS: { value: Aba; label: string }[] = [
  { value: 'dados', label: 'Preencher dados' },
  { value: 'simulacao', label: 'Simulação' },
]

const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ReciboPageClient({ veiculos, podeExcluir }: { veiculos: VeiculoParaContrato[]; podeExcluir: boolean }) {
  const toast = useToast()
  const [isPending, startTransition] = useTransition()
  const [r, setR] = useState<ReciboInput>(reciboVazio)
  const [clientes, setClientes] = useState<ClienteContrato[]>([])
  const [recarregarHistorico, setRecarregarHistorico] = useState(0)
  const [aba, setAba] = useState<Aba>('dados')

  const { pagador: p, veiculo: v, recebedor: e, pagamento: g } = r
  const setP = (campo: keyof ReciboInput['pagador'], valor: string) => setR((a) => ({ ...a, pagador: { ...a.pagador, [campo]: valor } }))
  const setV = (campo: keyof ReciboInput['veiculo'], valor: string) => setR((a) => ({ ...a, veiculo: { ...a.veiculo, [campo]: valor } }))
  const setE = (campo: keyof ReciboInput['recebedor'], valor: string) => setR((a) => ({ ...a, recebedor: { ...a.recebedor, [campo]: valor } }))
  const setG = (campo: keyof ReciboInput['pagamento'], valor: string) => setR((a) => ({ ...a, pagamento: { ...a.pagamento, [campo]: valor } }))

  // Busca por placa (hook compartilhado com o contrato): ao completar a placa, preenche marca,
  // modelo, ano, cor, chassi e RENAVAM. Não roda com veículo do estoque escolhido.
  const { buscando: buscandoPlaca, marcarJaBuscada } = useBuscaPlaca(v.placa, !v.veiculoId, (d) => {
    setR((a) => ({
      ...a,
      veiculo: {
        ...a.veiculo,
        marca: d.marca || a.veiculo.marca,
        modelo: d.modelo || a.veiculo.modelo,
        ano: d.anoModelo ? onlyDigits(String(d.anoModelo)).slice(0, 4) : a.veiculo.ano,
        cor: d.cor || a.veiculo.cor,
        chassi: d.chassi ? String(d.chassi).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17) : a.veiculo.chassi,
        renavam: d.renavam ? maskRenavam(String(d.renavam)) : a.veiculo.renavam,
      },
    }))
  })

  // Data do pagamento padrão = hoje (fuso do navegador). Fica para depois da montagem
  // para não divergir na hidratação quando o servidor está em outro fuso.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const d = new Date()
      const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      setR((a) => (a.pagamento.data ? a : { ...a, pagamento: { ...a.pagamento, data: hoje } }))
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    let vivo = true
    listarClientesContratoAction().then((x) => vivo && setClientes(x))
    return () => {
      vivo = false
    }
  }, [])

  const pendencia = useMemo(() => validarRecibo(r), [r])
  const valor = numeroDe(g.valor) || 0
  const total = g.valorTotal.trim() ? numeroDe(g.valorTotal) : NaN
  const saldo = Number.isFinite(total) ? Math.max(0, total - valor) : null

  function escolherCliente(id: string) {
    const c = clientes.find((x) => x.id === id)?.contratante
    if (!c) return
    setR((a) => ({
      ...a,
      pagador: { nome: c.nome, documento: onlyDigits(c.cpf), endereco: c.endereco, telefone: maskPhone(c.telefone), email: c.email },
    }))
  }

  function escolherVeiculo(id: string) {
    const x = veiculos.find((q) => q.id === id)
    if (!x) {
      setR((a) => ({ ...a, veiculo: { ...a.veiculo, veiculoId: '' } }))
      return
    }
    // Já temos os dados do estoque: não consulta essa placa de novo se o veículo for desmarcado.
    marcarJaBuscada(x.placa)
    setR((a) => ({
      ...a,
      veiculo: { ...a.veiculo, veiculoId: x.id, marca: x.marca, modelo: x.modelo, ano: x.ano, placa: x.placa, renavam: x.renavam },
    }))
  }

  function gerar() {
    if (pendencia) {
      toast.error(pendencia, 'Faltam dados')
      return
    }
    startTransition(async () => {
      const res = await gerarReciboAction(r)
      if ('error' in res) {
        toast.error(res.error, 'Não foi possível gerar')
        return
      }
      baixarPdf(res.pdfBase64, res.fileName)
      setRecarregarHistorico((n) => n + 1)
      toast.success(res.guardadoNoVeiculo ? 'Recibo gerado e guardado no veículo.' : 'Recibo gerado.')
      res.avisos.forEach((a) => toast.error(a))
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-liberty/10 text-liberty">
            <IconReceipt size={22} stroke={2} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-neutral-950 md:text-3xl">Recibo de pagamento</h1>
            <p className="mt-0.5 text-xs text-neutral-500 md:text-sm">
              {pendencia ? (
                <>
                  Preencha os dados do pagamento recebido. <span className="font-semibold text-amber-700">Falta: {pendencia}</span>
                </>
              ) : (
                <span className="font-semibold text-emerald-700">Tudo preenchido. Gere o PDF.</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard/contratos/gerar"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition-ui hover:bg-neutral-50 md:px-4"
          >
            <IconArrowLeft size={14} stroke={2.5} />
            <span className="hidden sm:inline">Voltar para modelos</span>
          </Link>
          <Button variant="liberty" leftIcon={<IconFileDownload size={16} />} onClick={gerar} loading={isPending} loadingLabel="Gerando..." disabled={!!pendencia} title={pendencia ?? undefined}>
            Gerar PDF
          </Button>
        </div>
      </div>

      {/* Fixo no topo ao rolar (mesmo esquema da página de contrato). */}
      <div className="sticky -top-8 z-20 -mx-4 bg-slate-50/90 px-4 py-2 backdrop-blur md:-mx-8 md:px-8 adobe-dark:bg-[var(--color-adobe-bg-0)]/90">
        <SegmentedControl options={ABAS} value={aba} onChange={setAba} ariaLabel="Seção do recibo" />
      </div>

      {aba === 'simulacao' && (
        <section aria-label="Simulação do recibo" className="mx-auto w-full max-w-4xl space-y-3">
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900 adobe-dark:border-sky-400/30 adobe-dark:bg-sky-500/10 adobe-dark:text-sky-100">
            <span className="font-semibold">Simulação:</span> o recibo ainda não foi gerado nem entrou no histórico.{' '}
            {pendencia ? (
              <>
                Os campos em amarelo estão vazios.{' '}
                <span className="font-semibold text-amber-800 adobe-dark:text-amber-300">Falta: {pendencia}</span>
              </>
            ) : (
              <span className="font-semibold text-emerald-800 adobe-dark:text-emerald-300">Está tudo certo: use &quot;Gerar PDF&quot; para emitir.</span>
            )}
          </p>
          <div className="rounded-xl border border-neutral-200 bg-neutral-100 p-3 md:p-5 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-3">
            <ReciboPreview input={r} />
          </div>
        </section>
      )}

      <div className={`mx-auto w-full max-w-3xl ${aba === 'dados' ? '' : 'hidden'}`}>
        <form
          onSubmit={(ev) => {
            ev.preventDefault()
            gerar()
          }}
          className="space-y-4"
        >
          <Bloco titulo="Pagador (cliente)">
            {clientes.length > 0 && (
              <Select
                id="rc-cliente-salvo"
                label="Cliente salvo (preenche os dados)"
                value=""
                onChange={(ev) => escolherCliente(ev.target.value)}
                options={[
                  { value: '', label: 'Selecione...' },
                  ...clientes.map((x) => ({ value: x.id, label: `${x.contratante.nome} — ${maskCPFCNPJ(x.contratante.cpf)}` })),
                ]}
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="rc-nome" label="Nome completo" placeholder="Nome completo" value={p.nome} onChange={(ev) => setP('nome', ev.target.value)} autoComplete="off" />
              <Input id="rc-doc" label="CPF ou CNPJ" placeholder="000.000.000-00" value={maskCPFCNPJ(p.documento)} onChange={(ev) => setP('documento', onlyDigits(ev.target.value).slice(0, 14))} inputMode="numeric" autoComplete="off" />
              <Input id="rc-tel" label="Telefone (opcional)" placeholder="(00) 00000-0000" value={p.telefone} onChange={(ev) => setP('telefone', maskPhone(ev.target.value))} inputMode="tel" autoComplete="off" />
              <Input id="rc-email" label="E-mail (opcional)" type="email" placeholder="cliente@email.com" value={p.email} onChange={(ev) => setP('email', ev.target.value)} autoComplete="off" />
            </div>
            <Input id="rc-endereco" label="Endereço (opcional)" placeholder="Rua, número, bairro, cidade/UF" value={p.endereco} onChange={(ev) => setP('endereco', ev.target.value)} autoComplete="off" />
          </Bloco>

          <Bloco titulo="Veículo">
            <Select
              id="rc-veiculo"
              label="Veículo do estoque (preenche os dados e guarda o recibo nele)"
              value={v.veiculoId}
              onChange={(ev) => escolherVeiculo(ev.target.value)}
              options={[{ value: '', label: 'Nenhum (digitar à mão)' }, ...veiculos.map((x) => ({ value: x.id, label: x.rotulo }))]}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="rc-marca" label="Marca" placeholder="Ex.: Volkswagen" value={v.marca} onChange={(ev) => setV('marca', ev.target.value)} autoComplete="off" />
              <Input id="rc-modelo" label="Modelo" placeholder="Ex.: Polo 1.0 MPI" value={v.modelo} onChange={(ev) => setV('modelo', ev.target.value)} autoComplete="off" />
              <Input id="rc-ano" label="Ano (opcional)" placeholder="AAAA" value={v.ano} onChange={(ev) => setV('ano', onlyDigits(ev.target.value).slice(0, 4))} inputMode="numeric" autoComplete="off" />
              <Input id="rc-cor" label="Cor (opcional)" placeholder="Ex.: Branca" value={v.cor} onChange={(ev) => setV('cor', ev.target.value)} autoComplete="off" />
              <Input id="rc-placa" label="Placa" placeholder="AAA0A00" value={v.placa} onChange={(ev) => setV('placa', maskPlate(ev.target.value))} hint={buscandoPlaca ? 'Buscando dados da placa…' : 'Ao completar a placa, preenche marca, modelo, ano, cor, chassi e RENAVAM.'} autoComplete="off" />
              <Input id="rc-chassi" label="Chassi (opcional)" placeholder="17 caracteres" value={v.chassi} onChange={(ev) => setV('chassi', ev.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17))} autoComplete="off" />
              <Input id="rc-renavam" label="RENAVAM (opcional)" placeholder="00000000000" value={v.renavam} onChange={(ev) => setV('renavam', maskRenavam(ev.target.value))} inputMode="numeric" autoComplete="off" />
            </div>
            {v.veiculoId && (
              <Marcar id="rc-guardar" checked={r.guardarNoVeiculo} onChange={(c) => setR((a) => ({ ...a, guardarNoVeiculo: c }))}>
                Guardar o recibo nos documentos do veículo
              </Marcar>
            )}
          </Bloco>

          <Bloco titulo="Pagamento recebido">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="rc-valor" label="Valor recebido (R$)" placeholder="R$ 0,00" value={g.valor} onChange={(ev) => setG('valor', maskMoney(ev.target.value))} inputMode="numeric" autoComplete="off" />
              <Input id="rc-data" label="Data do pagamento" type="date" value={g.data} onChange={(ev) => setG('data', ev.target.value)} />
              <Select id="rc-forma" label="Forma de pagamento" value={g.forma} onChange={(ev) => setG('forma', ev.target.value)} options={FORMAS_RECIBO.map((f) => ({ value: f.value, label: f.label }))} />
              <Input id="rc-total" label="Valor total do contrato (opcional)" placeholder="R$ 0,00" value={g.valorTotal} onChange={(ev) => setG('valorTotal', maskMoney(ev.target.value))} inputMode="numeric" autoComplete="off" hint="Preencha para mostrar o saldo restante e marcar pagamento parcial." />
            </div>
            <Input id="rc-ref" label="Referente a" placeholder="Ex.: sinal da compra do veículo" value={g.referencia} onChange={(ev) => setG('referencia', ev.target.value)} autoComplete="off" />
            {saldo !== null && valor > 0 && (
              <p className="text-xs text-neutral-500">
                Recebido {reais(valor)} de {reais(total)}: saldo restante {reais(saldo)}.
              </p>
            )}
          </Bloco>

          <Bloco titulo="Quem recebeu">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="rc-r-nome" label="Nome ou razão social" placeholder="Razão social" value={e.nome} onChange={(ev) => setE('nome', ev.target.value)} autoComplete="off" />
              <Input id="rc-r-cnpj" label="CNPJ" placeholder="00.000.000/0000-00" value={maskCPFCNPJ(e.cnpj)} onChange={(ev) => setE('cnpj', onlyDigits(ev.target.value).slice(0, 14))} inputMode="numeric" autoComplete="off" />
              <Input id="rc-r-resp" label="Responsável (assina o recibo)" placeholder="Nome completo" value={e.responsavel} onChange={(ev) => setE('responsavel', ev.target.value)} autoComplete="off" />
              <Input id="rc-r-cpf" label="CPF do responsável" placeholder="000.000.000-00" value={maskCPFCNPJ(e.responsavelCpf)} onChange={(ev) => setE('responsavelCpf', onlyDigits(ev.target.value).slice(0, 11))} inputMode="numeric" autoComplete="off" />
            </div>
            <Input id="rc-r-end" label="Endereço" placeholder="Rua, número, bairro, cidade/UF" value={e.endereco} onChange={(ev) => setE('endereco', ev.target.value)} autoComplete="off" />
          </Bloco>
        </form>

        <div className="mt-4">
          <HistoricoRecibos recarregar={recarregarHistorico} podeExcluir={podeExcluir} />
        </div>
      </div>
    </div>
  )
}
```

**`app/dashboard/contratos/gerar/recibo/HistoricoRecibos.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconFileDownload, IconTrash } from '@tabler/icons-react'
import { Button, ConfirmDialog, Input, useToast } from '@/app/components/ui'
import { maskCPFCNPJ } from '@/utils/masks'
import { baixarPdf } from '../baixar-pdf'
import { baixarReciboAction, excluirReciboAction, listarRecibosAction } from './actions'
import type { ReciboRegistro } from './types'

const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
/** "2026-11-19" → "19/11/2026" */
const dataCurta = (iso: string) => iso.split('-').reverse().join('/')

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
function rotuloMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return a && m ? `${MESES[m - 1]} de ${a}` : ''
}
function deslocar(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Histórico de recibos gerados, por mês de pagamento. `recarregar` muda quando um novo recibo é gerado. */
export default function HistoricoRecibos({ recarregar, podeExcluir }: { recarregar: number; podeExcluir: boolean }) {
  const toast = useToast()
  const [mes, setMes] = useState('')
  const [recibos, setRecibos] = useState<ReciboRegistro[] | null>(null)
  const [baixando, setBaixando] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<ReciboRegistro | null>(null)
  const [apagando, setApagando] = useState(false)
  const [versao, setVersao] = useState(0)

  // Mês inicial = o atual (fuso do navegador), depois da montagem para não divergir na hidratação.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const d = new Date()
      setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!mes) return
    let vivo = true
    listarRecibosAction(mes).then((res) => {
      if (!vivo) return
      if ('error' in res) {
        toast.error(res.error, 'Histórico')
        setRecibos([])
      } else {
        setRecibos(res.recibos)
      }
    })
    return () => {
      vivo = false
    }
  }, [mes, recarregar, versao, toast])

  async function baixar(id: string) {
    setBaixando(id)
    const res = await baixarReciboAction(id)
    setBaixando(null)
    if ('error' in res) {
      toast.error(res.error, 'Não foi possível baixar')
      return
    }
    baixarPdf(res.pdfBase64, res.fileName)
  }

  async function excluir() {
    if (!excluindo) return
    setApagando(true)
    const res = await excluirReciboAction(excluindo.id)
    setApagando(false)
    if ('error' in res) {
      toast.error(res.error, 'Não foi possível excluir')
      return
    }
    toast.success(res.success)
    setExcluindo(null)
    setVersao((n) => n + 1)
  }

  const total = (recibos ?? []).reduce((s, r) => s + r.valor, 0)

  return (
    <section aria-label="Histórico de recibos" className="space-y-3 rounded-xl border border-neutral-200 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">Histórico de recibos</p>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" aria-label="Mês anterior" disabled={!mes} onClick={() => mes && setMes(deslocar(mes, -1))}>
            <IconChevronLeft size={16} />
          </Button>
          <Input id="rc-hist-mes" aria-label="Mês do histórico" type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
          <Button variant="ghost" aria-label="Próximo mês" disabled={!mes} onClick={() => mes && setMes(deslocar(mes, 1))}>
            <IconChevronRight size={16} />
          </Button>
        </div>
      </div>

      {recibos === null ? (
        <p className="text-sm text-neutral-500">Carregando…</p>
      ) : recibos.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum recibo em {rotuloMes(mes)}.</p>
      ) : (
        <>
          <p className="text-xs text-neutral-500">
            {recibos.length} {recibos.length === 1 ? 'recibo' : 'recibos'} em {rotuloMes(mes)} · total recebido{' '}
            <span className="font-bold text-neutral-900">{reais(total)}</span>
          </p>
          <ul className="divide-y divide-neutral-100">
            {recibos.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-neutral-900">{r.pagadorNome}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {dataCurta(r.data)} · {r.veiculoResumo} {r.placa && `(${r.placa})`}
                    {r.forma ? ` · ${r.forma}` : ''}
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    {maskCPFCNPJ(r.pagadorDocumento)}
                    {r.valorTotal !== null ? (r.valorTotal > r.valor ? ` · parcial de ${reais(r.valorTotal)}` : ' · integral') : ''}
                    {r.geradoPor ? ` · por ${r.geradoPor}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-bold text-neutral-900">{reais(r.valor)}</span>
                  <Button variant="ghost" leftIcon={<IconFileDownload size={14} />} loading={baixando === r.id} loadingLabel="Gerando..." onClick={() => baixar(r.id)}>
                    PDF
                  </Button>
                  {podeExcluir && (
                    <Button variant="ghost" aria-label={`Excluir recibo de ${r.pagadorNome}`} title="Excluir recibo" onClick={() => setExcluindo(r)}>
                      <IconTrash size={16} />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={!!excluindo}
        onClose={() => !apagando && setExcluindo(null)}
        onConfirm={excluir}
        title="Excluir recibo?"
        tone="danger"
        confirmLabel="Excluir"
        loading={apagando}
        description={
          excluindo && (
            <>
              Recibo de <strong>{excluindo.pagadorNome}</strong> de {reais(excluindo.valor)} ({dataCurta(excluindo.data)}) será removido do
              histórico. Não dá para desfazer. Se ele foi guardado nos documentos do veículo, essa cópia continua lá.
            </>
          )
        }
      />
    </section>
  )
}
```


### 6.8 Entrada no menu de modelos

No grupo-liberty, o card fica em `app/dashboard/contratos/gerar/EscolherModeloClient.tsx`, depois da lista de modelos: um `Link` para `/dashboard/contratos/gerar/recibo` com o ícone `IconReceipt`, o título "Recibo de pagamento" e a descrição "Recibo do valor recebido por um veículo, com os dados do cliente, do veículo e do pagamento (total e saldo opcionais)." A rota `recibo` é um segmento **estático** ao lado do dinâmico `[modelo]`, então o Next a resolve antes dele.

### 6.9 Rota da consulta de placa (referência)

**`utils/veiculos/consulta-placa.ts (cache em Firestore `_cache_placa`, TTL 24 h)`**

```ts
import 'server-only'
import { adminDb } from '@/utils/firebase/admin'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface PuxaPlacaResult {
  placa: string
  marca: string
  modelo: string
  marcaModelo: string
  anoFabricacao: string
  anoModelo: string
  cor: string
  combustivel: string
  municipio: string
  uf: string
  especie: string
  tipo: string
  rouboFurto: string
  chassi: string
  renavam: string
  valorFipe: number
  codigoFipe: string
  referenciaFipe: string
  historicoPrecFipe: { valor: string; mesReferencia: string }[]
  logo?: string
  cachedAt?: string
  fromCache?: boolean
}

export type ConsultaPlacaResultado =
  | { ok: true; data: PuxaPlacaResult & { fromCache: boolean; cachedAt?: string } }
  | { ok: false; status: number; error: string; code?: 'token_missing' }

const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 horas

/**
 * Consulta dados de um veículo por placa (Sistema Puxa Placa), cache-first no
 * Firestore (`_cache_placa`, TTL 24h). Sem checagem de autenticação — quem
 * chama decide o gate (rota interna exige admin/vendedor; a rota pública usa
 * rate-limit em vez de login).
 *
 * Extraído de `app/api/consulta-placa/route.ts` para ser reaproveitado pela
 * rota pública de `/anuncie-seu-veiculo`, sem duplicar a lógica de cache e
 * normalização da resposta.
 */
export async function consultarPlaca(placaRaw: string): Promise<ConsultaPlacaResultado> {
  const placa = placaRaw.toUpperCase().replace(/[^A-Z0-9]/g, '')

  if (!PLACA_REGEX.test(placa)) {
    return {
      ok: false,
      status: 400,
      error: 'Formato de placa inválido. Use Mercosul (ABC1D23) ou antiga (ABC1234).',
    }
  }

  // 1. Verificar cache no Firestore
  const cacheRef = adminDb.collection('_cache_placa').doc(placa)
  try {
    const cached = await cacheRef.get()
    if (cached.exists) {
      const data = cached.data() as PuxaPlacaResult & { _cachedAt: number }
      const age = Date.now() - (data._cachedAt ?? 0)
      if (age < CACHE_TTL_MS) {
        const { _cachedAt, ...result } = data
        return {
          ok: true,
          data: { ...result, fromCache: true, cachedAt: new Date(_cachedAt).toISOString() },
        }
      }
    }
  } catch (err) {
    console.warn('[consulta-placa] Erro ao ler cache:', err)
    // Continua para a API externa
  }

  // 2. Verificar token da API
  const token = process.env.PUXA_PLACA_TOKEN
  if (!token) {
    return {
      ok: false,
      status: 503,
      error: 'Token do Puxa Placa não configurado.',
      code: 'token_missing',
    }
  }

  // 3. Chamar a API do Puxa Placa
  try {
    const apiRes = await fetch(`https://api.puxaplaca.app/v2/consulta/${placa}`, {
      headers: {
        token,
        Accept: 'application/json',
      },
      // Não usar cache do Next.js — o cache está no Firestore
      cache: 'no-store',
    })

    if (apiRes.status === 401) {
      return { ok: false, status: 502, error: 'Token do Puxa Placa inválido ou saldo insuficiente.' }
    }

    if (apiRes.status === 404) {
      return { ok: false, status: 404, error: 'Veículo não encontrado para a placa informada.' }
    }

    if (apiRes.status === 406) {
      return { ok: false, status: 400, error: 'Placa com formato inválido.' }
    }

    if (!apiRes.ok) {
      return { ok: false, status: 502, error: `Erro na API externa (status ${apiRes.status}).` }
    }

    const raw = await apiRes.json()

    // 4. Normalizar resposta
    const basico = raw.basico?.dados ?? {}
    const fipeList: any[] = raw.fipe?.dados ?? []
    const fipe = fipeList[0] ?? {}

    // Converter "R$ 85.000,00" → número
    const parseFipeValor = (s: string): number => {
      if (!s) return 0
      return parseFloat(s.replace(/[^0-9,]/g, '').replace(',', '.')) || 0
    }

    const result: PuxaPlacaResult = {
      placa,
      marca: basico.marca ?? '',
      modelo: basico.modelo ?? '',
      marcaModelo: basico.marcamodelo ?? '',
      anoFabricacao: String(basico.ano ?? ''),
      anoModelo: String(basico.anoModelo ?? basico.ano ?? ''),
      cor: basico.cor ?? '',
      combustivel: basico.combustivel ?? '',
      municipio: basico.municipio ?? '',
      uf: basico.uf ?? '',
      especie: basico.especie ?? '',
      tipo: basico.tipo ?? '',
      rouboFurto: basico.rouboFurto ?? raw.rouboFurto?.dados?.rouboFurto ?? 'NAO',
      chassi: raw.chassi?.dados?.chassi ?? '',
      renavam: raw.renavam?.dados?.renavam ?? '',
      valorFipe: parseFipeValor(fipe.valor),
      codigoFipe: fipe.codigo_fipe ?? '',
      referenciaFipe: fipe.mes_referencia ?? '',
      historicoPrecFipe: (fipe.historico ?? []).map((h: any) => ({
        valor: h.valor ?? '',
        mesReferencia: h.mes_referencia ?? '',
      })),
      logo: basico.logo ?? '',
    }

    // 5. Salvar no cache do Firestore
    try {
      await cacheRef.set({ ...result, _cachedAt: Date.now() })
    } catch (err) {
      console.warn('[consulta-placa] Erro ao salvar cache:', err)
    }

    return { ok: true, data: { ...result, fromCache: false } }
  } catch (err) {
    console.error('[consulta-placa] Erro na requisição externa:', err)
    return { ok: false, status: 500, error: 'Falha na comunicação com o Sistema Puxa Placa.' }
  }
}
```

**`app/api/consulta-placa/route.ts (login + gate por aba; inclua `contratos` na lista de abas permitidas)`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { consultarPlaca } from '@/utils/veiculos/consulta-placa'
import { temAcessoPagina, type PermissionKey } from '@/constants/permissoes'

// ─── Config ──────────────────────────────────────────────────────────────────

// Usada no cadastro de veículo, na nova proposta, na Consulta FIPE e na geração de
// contratos: quem tem acesso a qualquer uma dessas abas pode consultar.
const ABAS_PERMITIDAS: PermissionKey[] = ['veiculos', 'propostas', 'consulta_fipe', 'contratos']

// ─── Handler ─────────────────────────────────────────────────────────────────
// A lógica de consulta (cache + Sistema Puxa Placa) mora em
// utils/veiculos/consulta-placa.ts, reaproveitada pela rota pública de
// /anuncie-seu-veiculo. Aqui só ficam a autenticação e o gate por aba.

export async function GET(request: NextRequest) {
  // 1. Autenticação + autorização por aba
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  if (!sessionCookie) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    const profileDoc = await adminDb.collection('profiles').doc(decoded.uid).get()
    const { role, permissions } = profileDoc.data() ?? {}

    if (!ABAS_PERMITIDAS.some((aba) => temAcessoPagina(role, permissions, aba))) {
      return NextResponse.json(
        { error: 'Acesso negado. Você não tem permissão para consultar placas.' },
        { status: 403 },
      )
    }
  } catch {
    return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  }

  // 2. Validar placa
  const searchParams = request.nextUrl.searchParams
  const placaRaw = searchParams.get('placa')

  if (!placaRaw) {
    return NextResponse.json({ error: 'Placa não informada.' }, { status: 400 })
  }

  // 3. Consultar (cache + Puxa Placa)
  const resultado = await consultarPlaca(placaRaw)

  if (!resultado.ok) {
    return NextResponse.json(
      resultado.code === 'token_missing'
        ? { error: 'token_missing', message: resultado.error }
        : { error: resultado.error },
      { status: resultado.status },
    )
  }

  return NextResponse.json(resultado.data)
}
```


---

## 7. Checklist de verificação (depois de implementar)

1. Gerar um recibo com valor, data, cliente e veículo → o PDF baixa com **uma página**, valor por extenso e linha de assinatura.
2. Informar valor total **maior** que o recebido → selo "Pagamento parcial" e saldo correto; total **igual** → "Pagamento integral" e saldo R$ 0,00; sem total → sem selo.
3. Valor recebido **maior** que o total → recusa com mensagem; data **futura** → recusa; CPF inválido → recusa.
4. Aba **Simulação** com o formulário vazio mostra `[campos]` em amarelo; completa, mostra o mesmo texto do PDF.
5. Digitar uma placa válida → preenche marca, modelo, ano, cor, chassi e RENAVAM; com veículo do estoque escolhido **não** consulta.
6. O recibo gerado aparece no **histórico do mês do pagamento**, com o total do mês; o botão "PDF" refaz o arquivo com a data de emissão original.
7. Excluir: o botão só aparece para admin; usuário não admin chamando a ação direto recebe "Apenas administradores podem excluir recibos."
8. (Se mantido) "Guardar no veículo" cria o documento no veículo e ele **continua lá** depois de excluir o recibo do histórico.
