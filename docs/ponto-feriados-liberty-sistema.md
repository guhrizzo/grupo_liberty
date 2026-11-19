# Feriado e troca de feriado na folha de ponto: guia para o liberty-sistema (localiberty)

Este documento leva ao **liberty-sistema** (Next.js + Supabase, `localiberty.com`) a marcação de **feriado** e **troca de feriado** na folha de ponto, que o **grupo-liberty** já usa. A folha única mora no liberty-sistema, então o dado precisa existir aqui; o grupo-liberty só lê e grava pela API de integração (`/api/ponto/integracao`).

> Resumo: o ADM supremo marca um dia de um funcionário como **Feriado** ou **Troca de feriado** (com nome opcional, ex.: "Finados"). Nesse dia a **jornada esperada vira 0h**: não gera saldo negativo, e as horas trabalhadas contam todas como saldo positivo.

---

## 1. Regras (iguais nos dois sistemas)

- **Tipos:** `feriado` e `troca_feriado`. Os dois têm o mesmo efeito no cálculo; a diferença é só o rótulo.
- **Por funcionário e por dia.** Uma marcação por `(uid, data)`; marcar de novo substitui a anterior.
- **Efeito:** jornada esperada do dia = **0 min**. `saldoDia(batidas, 0)` = tempo trabalhado; dia sem batida não conta como incompleto nem gera saldo (já era assim). A jornada **gravada** em `ponto_registros."jornadaMin"` **não muda** (a coluna só aceita 30 a 960): quem consome a folha troca por 0 **na leitura**, quando o dia está marcado.
- **Nome do feriado:** texto livre opcional, até **80 caracteres** (ex.: `Finados`, `Consciência Negra`).
- **Qualquer data do mês pode ser marcada**, inclusive futura (ao contrário das batidas, que não aceitam data futura).
- **Quem marca:** só ADM supremo (o grupo-liberty já exige isso na página; a API confia em quem tem o segredo).
- **Remover:** marcar de novo com `tipo: null` apaga a marcação.
- **Sugestão de nome:** ao marcar uma data de feriado nacional de data fixa, a tela sugere o nome (tabela na seção 6.1). Feriados móveis (Carnaval, Sexta-feira Santa, Corpus Christi) aparecem só como sugestão no campo.

---

## 2. O que já existe e o que falta

| Parte | Situação |
| --- | --- |
| Migration `0065_ponto_dias_especiais.sql` | Escrita (seção 3). **Precisa ser aplicada** no Supabase. |
| API de integração: ação `marcar_dia` e `diasEspeciais` na ação `folha` | Escrita (seção 4), com testes. **Precisa de deploy.** |
| **Telas do próprio liberty-sistema** (folha, PDF, Excel) | **Faltam** (seção 5). Hoje elas ignoram as marcações: o saldo calculado aqui ainda penaliza o feriado. |
| grupo-liberty (tela, cálculo, PDF) | Pronto, depende das duas primeiras linhas. |

Enquanto a migration não for aplicada, a `folha` devolve `diasEspeciais: []` (continua funcionando, sem marcações) e `marcar_dia` responde 500.

---

## 3. Banco (Supabase)

**`supabase/migrations/0065_ponto_dias_especiais.sql`**

```sql
-- Dias marcados como feriado ou troca de feriado, por funcionário. Nesses dias a jornada
-- esperada vira 0h na folha (quem trabalha tem tudo como saldo positivo, e não há saldo
-- negativo). Só o servidor acessa, depois da checagem de permissão (como ponto_registros).
create table public.ponto_dias_especiais (
  uid uuid not null references auth.users(id),
  data date not null,
  mes text not null check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  tipo text not null check (tipo in ('feriado', 'troca_feriado')),
  nome text not null default '' check (char_length(nome) <= 80),   -- ex.: Finados
  "atualizadoEm" timestamptz not null default now(),
  "atualizadoPor" text not null,
  primary key (uid, data)
);
create index ponto_dias_especiais_mes on public.ponto_dias_especiais (mes);

alter table public.ponto_dias_especiais enable row level security;
revoke all on public.ponto_dias_especiais from anon, authenticated;
grant all on public.ponto_dias_especiais to service_role;
```

Se a `0065` **já tinha sido aplicada antes** de existir a coluna `nome`, rode só isto:

```sql
alter table public.ponto_dias_especiais
  add column if not exists nome text not null default '' check (char_length(nome) <= 80);
```

---

## 4. API de integração (`lib/ponto/integracao.ts`)

Contrato novo em `docs/PONTO.md` (tabela de ações):

| acao | corpo | resposta |
| --- | --- | --- |
| `folha` | `mes` (`AAAA-MM`) | `funcionarios`, `registros` e **`diasEspeciais`**: lista de `{ email, data, tipo, nome }` |
| `marcar_dia` | `email`, `data`, `tipo` (`feriado`, `troca_feriado` ou `null` para remover), `nome` (opcional, até 80), `porEmail` | `ok` |

Erros: `400` dados inválidos (e-mail fora da lista, data inexistente, tipo inválido), `404` funcionário sem conta no Supabase, `500` falha do banco.

### 4.1 Ação `folha` (lê as marcações do mês e não quebra se a migration faltar)

```ts
async function folha(db: DbIntegracao, b: Record<string, unknown>) {
  const mes = b.mes
  if (typeof mes !== 'string' || !MES_RE.test(mes)) return erro(400, 'Mês inválido.')
  const [p, c, r, e] = await Promise.all([
    db.from('profiles').select('id, nome, email'),
    db.from('ponto_config').select('*'),
    db.from('ponto_registros').select('*').eq('mes', mes),
    db.from('ponto_dias_especiais').select('uid, data, tipo, nome').eq('mes', mes),
  ])
  if (p.error || c.error || r.error) return erro(500, 'Não foi possível carregar a folha de ponto.')
  const funcionarios = (p.data as { id: string; nome: string | null; email: string | null }[])
    .filter((f) => podeBaterPonto(f.email))
    .map((f) => ({
      email: (f.email as string).toLowerCase(),
      nome: f.nome || f.email || f.id,
      jornadaMin:
        (c.data as { uid: string; jornadaMin: number }[]).find((v) => v.uid === f.id)?.jornadaMin ??
        JORNADA_PADRAO_MIN,
    }))
    .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'))
  const registros = (r.data as RegistroPonto[]).map(registroBanco)
  // Feriado / troca de feriado. Se a tabela ainda não existe (migration 0065 pendente), a folha
  // continua funcionando, só sem as marcações.
  if (e.error) console.error('[ponto/integracao] folha: dias especiais indisponíveis')
  const emailPorUid = new Map(
    (p.data as { id: string; email: string | null }[]).map((f) => [f.id, (f.email ?? '').toLowerCase()]),
  )
  const diasEspeciais = e.error
    ? []
    : (e.data as { uid: string; data: string; tipo: string; nome: string | null }[])
        .filter((d) => emailPorUid.get(d.uid) && TIPOS_DIA.includes(d.tipo as TipoDia))
        .map((d) => ({ email: emailPorUid.get(d.uid) as string, data: d.data, tipo: d.tipo, nome: d.nome ?? '' }))
  return ok({ mes, funcionarios, registros, diasEspeciais })
}
```

### 4.2 Ação `marcar_dia` (e registro no mapa de ações)

```ts
/** Marcações que zeram a jornada do dia. */
const TIPOS_DIA = ['feriado', 'troca_feriado'] as const
type TipoDia = (typeof TIPOS_DIA)[number]

/** "AAAA-MM-DD" que existe no calendário. */
function dataValida(v: unknown): v is string {
  if (typeof v !== 'string' || !DATA_RE.test(v)) return false
  const [a, m, d] = v.split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d))
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/** Marca um dia do funcionário como feriado ou troca de feriado (com o nome, ex. "Finados"); `tipo: null` remove a marcação. */
async function marcarDia(db: DbIntegracao, b: Record<string, unknown>) {
  const email = normalizarEmail(b.email)
  const por = normalizarEmail(b.porEmail)
  const tipo = b.tipo
  if (!email || !podeBaterPonto(email) || !por || !dataValida(b.data)) return erro(400, 'Dados inválidos.')
  if (tipo !== null && !TIPOS_DIA.includes(tipo as TipoDia)) return erro(400, 'Tipo de dia inválido.')
  const perfil = await perfilPorEmail(db, email)
  if (!perfil) return erro(404, 'Funcionário sem conta no liberty-sistema.')
  const data = b.data
  const nome = typeof b.nome === 'string' ? b.nome.trim().slice(0, 80) : ''
  if (tipo === null) {
    const { error } = await db.from('ponto_dias_especiais').delete().eq('uid', perfil.id).eq('data', data)
    return error ? erro(500, 'Não foi possível salvar a marcação do dia.') : ok()
  }
  const { error } = await db.from('ponto_dias_especiais').upsert(
    { uid: perfil.id, data, mes: data.slice(0, 7), tipo, nome, atualizadoEm: new Date().toISOString(), atualizadoPor: por },
    { onConflict: 'uid,data' },
  )
  return error ? erro(500, 'Não foi possível salvar a marcação do dia.') : ok()
}
```

No mapa `ACOES`, acrescente `marcar_dia: marcarDia`.

### 4.3 Testes (`lib/ponto/integracao.test.ts`)

O `fakeDb` do teste precisa de espiões para `upsert` e `delete` (e `eq`, `select`, `limit` continuam encadeando):

```ts
const upsert = vi.fn()
const apagar = vi.fn()
// dentro do from(): trocar o upsert simples por
q.upsert = (...args: unknown[]) => { upsert(...args); return q }
q.delete = () => { apagar(); return q }
// e devolver { db: { from, rpc }, insert, rpc, from, upsert, apagar }
```

```ts
describe('marcar_dia', () => {
  const base = { acao: 'marcar_dia', email: EMAIL, porEmail: 'adm@liberty.com', data: '2026-11-20', tipo: 'feriado', nome: '  Consciência Negra  ' }
  it('grava feriado ou troca de feriado com uid, mês e quem marcou', async () => {
    const { db, upsert } = fakeDb(perfis)
    expect((await executarIntegracao(db, base)).status).toBe(200)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'uid-1', data: '2026-11-20', mes: '2026-11', tipo: 'feriado', nome: 'Consciência Negra', atualizadoPor: 'adm@liberty.com' }),
      { onConflict: 'uid,data' },
    )
    expect((await executarIntegracao(db, { ...base, tipo: 'troca_feriado' })).status).toBe(200)
  })
  it('o nome é opcional e limitado a 80 caracteres', async () => {
    const { db, upsert } = fakeDb(perfis)
    await executarIntegracao(db, { ...base, nome: undefined })
    expect(upsert).toHaveBeenLastCalledWith(expect.objectContaining({ nome: '' }), { onConflict: 'uid,data' })
    await executarIntegracao(db, { ...base, nome: 'x'.repeat(200) })
    expect((upsert.mock.calls.at(-1)?.[0] as { nome: string }).nome).toHaveLength(80)
  })
  it('remove a marcação com tipo nulo', async () => {
    const { db, upsert, apagar } = fakeDb(perfis)
    expect((await executarIntegracao(db, { ...base, tipo: null })).status).toBe(200)
    expect(apagar).toHaveBeenCalledTimes(1)
    expect(upsert).not.toHaveBeenCalled()
  })
  it('rejeita tipo inválido, data inexistente, e-mail fora da lista e autor ausente', async () => {
    const { db, upsert } = fakeDb(perfis)
    expect((await executarIntegracao(db, { ...base, tipo: 'folga' })).status).toBe(400)
    expect((await executarIntegracao(db, { ...base, data: '2026-02-30' })).status).toBe(400)
    expect((await executarIntegracao(db, { ...base, email: 'outro@x.com' })).status).toBe(400)
    expect((await executarIntegracao(db, { ...base, porEmail: undefined })).status).toBe(400)
    expect(upsert).not.toHaveBeenCalled()
  })
  it('404 se o funcionário não tem conta no Supabase', async () => {
    const { db } = fakeDb({ profiles: { data: [] } })
    expect((await executarIntegracao(db, base)).status).toBe(404)
  })
  it('500 se o banco falhar (ex.: migration pendente)', async () => {
    const { db } = fakeDb({ ...perfis, ponto_dias_especiais: { error: { message: 'relation does not exist' } } })
    expect((await executarIntegracao(db, base)).status).toBe(500)
  })
})

describe('folha: dias especiais', () => {
  const tabelas = {
    profiles: { data: [{ id: 'uid-1', nome: 'Gustavo', email: EMAIL }] },
    ponto_config: { data: [] },
    ponto_registros: { data: [] },
  }
  it('devolve as marcações do mês com o e-mail do funcionário', async () => {
    const { db } = fakeDb({ ...tabelas, ponto_dias_especiais: { data: [{ uid: 'uid-1', data: '2026-11-20', tipo: 'feriado', nome: 'Consciência Negra' }, { uid: 'sumiu', data: '2026-11-21', tipo: 'feriado', nome: '' }] } })
    const r = await executarIntegracao(db, { acao: 'folha', mes: '2026-11' })
    expect(r.status).toBe(200)
    expect(r.json.diasEspeciais).toEqual([{ email: EMAIL, data: '2026-11-20', tipo: 'feriado', nome: 'Consciência Negra' }])
  })
  it('a folha continua funcionando se a tabela ainda não existe', async () => {
    const { db } = fakeDb({ ...tabelas, ponto_dias_especiais: { error: { message: 'relation does not exist' } } })
    const r = await executarIntegracao(db, { acao: 'folha', mes: '2026-11' })
    expect(r.status).toBe(200)
    expect(r.json.diasEspeciais).toEqual([])
  })
})
```

---

## 5. Telas do próprio liberty-sistema

> Os trechos desta seção são **esboços adaptados** ao código atual do liberty-sistema (`actions.ts` compacto com `dbPonto()`, PDF em `jsPDF`, Excel em `xlsx`, tela com CSS modules). Eu não os compilei aí: ajuste nomes e estilos ao ler os arquivos reais.

### 5.1 Constantes (`lib/ponto/constants.ts`)

```ts
/** Marcações que zeram a jornada esperada do dia (por funcionário). */
export const TIPOS_DIA_ESPECIAL = ['feriado', 'troca_feriado'] as const
export type TipoDiaEspecial = (typeof TIPOS_DIA_ESPECIAL)[number]
export const TIPO_DIA_LABEL: Record<TipoDiaEspecial, string> = {
  feriado: 'Feriado',
  troca_feriado: 'Troca de feriado',
}

/** Feriados nacionais de data fixa ("MM-DD" → nome): sugeridos ao marcar um dia. */
export const FERIADOS_NACIONAIS_FIXOS: Record<string, string> = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Senhora Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Consciência Negra',
  '12-25': 'Natal',
}

/** Sugestões do campo de nome: os fixos mais feriados móveis e comuns. */
export const FERIADOS_SUGESTOES = [
  ...Object.values(FERIADOS_NACIONAIS_FIXOS),
  'Carnaval',
  'Sexta-feira Santa',
  'Corpus Christi',
  'Aniversário da cidade',
  'Véspera de Natal',
  'Véspera de Ano Novo',
]
```

### 5.2 Leitura da folha com a jornada zerada (`app/dashboard/ponto/actions.ts`)

Em `getFolhaMes`, leia as marcações do mês junto com as outras consultas e **zere a jornada dos registros marcados antes de calcular os totais**. Assim os totais, a tela, o PDF e o Excel já saem certos.

```ts
const [p, c, r, e] = await Promise.all([
  db.from('profiles').select('id, nome, email, role'),
  db.from('ponto_config').select('*'),
  db.from('ponto_registros').select('*').eq('mes', mes),
  db.from('ponto_dias_especiais').select('uid, data, tipo, nome').eq('mes', mes),
])
if (p.error || c.error || r.error) throw new Error('Não foi possível carregar a folha de ponto.')
// e.error (migration pendente) => sem marcações, a folha segue funcionando
const diasEspeciais = e.error ? [] : (e.data as { uid: string; data: string; tipo: TipoDiaEspecial; nome: string | null }[]).map(d => ({ ...d, nome: d.nome ?? '' }))
const especial = new Set(diasEspeciais.map(d => `${d.uid}|${d.data}`))
// Feriado / troca de feriado: jornada esperada 0h (a coluna do banco não muda).
const todos = r.data.map(registro).map(x => (especial.has(`${x.uid}|${x.data}`) ? { ...x, jornadaMin: 0 } : x))
// ... resto igual; no retorno, inclua diasEspeciais
return { mes, funcionarios, totais, registros: todos.filter(x => x.uid === uid).sort(/* ... */), todos, diasEspeciais }
```

Nova server action (mesmo estilo das outras: `exigirSupremo()` e `dbPonto()`):

```ts
export async function marcarDiaEspecial(input: { uid: string; data: string; tipo: TipoDiaEspecial | null; nome?: string }) {
  const adm = await exigirSupremo()
  if (!input.uid || !/^\d{4}-\d{2}-\d{2}$/.test(input.data)) return { ok: false as const, erro: 'Dados inválidos.' }
  if (input.tipo !== null && !TIPOS_DIA_ESPECIAL.includes(input.tipo)) return { ok: false as const, erro: 'Tipo de dia inválido.' }
  const db = dbPonto()
  const { error } = input.tipo === null
    ? await db.from('ponto_dias_especiais').delete().eq('uid', input.uid).eq('data', input.data)
    : await db.from('ponto_dias_especiais').upsert(
        { uid: input.uid, data: input.data, mes: input.data.slice(0, 7), tipo: input.tipo, nome: (input.nome ?? '').trim().slice(0, 80), atualizadoEm: new Date().toISOString(), atualizadoPor: adm.email },
        { onConflict: 'uid,data' },
      )
  if (error) return { ok: false as const, erro: 'Não foi possível salvar a marcação do dia.' }
  revalidatePath('/dashboard/ponto')
  return { ok: true as const }
}
```

### 5.3 Tela (`app/dashboard/ponto/FolhaClient.tsx`)

- Na linha de cada dia, ao lado de `data.slice(8)`, mostre a etiqueta quando houver marcação: `Feriado · Finados` (ou só `Feriado`) e um botão pequeno (ícone de calendário) que abre um diálogo.
- Diálogo **"Tipo do dia"** (use o `Dialogo` que a tela já tem): três opções em radio (**Dia normal**, **Feriado**, **Troca de feriado**) e, quando uma das duas últimas está selecionada, um campo **"Nome do feriado (opcional)"** com `placeholder="Ex.: Finados"`, `maxLength={80}` e `<datalist>` com `FERIADOS_SUGESTOES`.
- Ao escolher Feriado/Troca com o campo vazio, preencha o nome com `FERIADOS_NACIONAIS_FIXOS[data.slice(5)]` se existir (dá para editar).
- Salvar chama `marcarDiaEspecial({ uid, data, tipo: tipo || null, nome })` e recarrega a folha.
- A coluna "Saldo" já vem certa porque `registros` chega com `jornadaMin: 0` nesses dias.

### 5.4 PDF (`app/api/ponto/pdf/route.ts`, jsPDF)

Hoje cada dia imprime `dd`, quatro horários, horas e saldo. Para o dia marcado:

- Sem batida: imprima o rótulo (`Feriado · Finados`) no lugar dos quatro horários (por exemplo em `x = 32`, em azul), em vez de quatro traços.
- Com batida: imprima os horários normalmente e acrescente o nome (ou `Feriado`/`Troca`) ao lado do dia, em fonte menor (corte em ~19 caracteres).
- Inclua o dia marcado mesmo que seja domingo ou não tenha registro.
- Legenda no rodapé: `Feriado e troca de feriado: jornada do dia zerada (sem saldo negativo; horas trabalhadas contam como saldo positivo).`

### 5.5 Excel (`app/api/ponto/xlsx/route.ts`)

Na aba **Batidas**, acrescente as colunas `TipoDia` (`Feriado`, `Troca de feriado` ou vazio) e `NomeFeriado`, e **uma linha por dia marcado sem registro** (com as batidas vazias), para o feriado aparecer na planilha mesmo que ninguém tenha trabalhado. A coluna `Jornada` já sai 0h nos dias marcados porque `todos` vem com a jornada zerada.

---

## 6. Referência: como ficou no grupo-liberty

Só para consulta (React + Tailwind + `@react-pdf/renderer`). A tela de lá é o `FolhaClient.tsx` com o diálogo "Tipo do dia"; o PDF usa estes trechos para listar os dias e as linhas:

```tsx
const especialPorData = new Map(diasEspeciais.map((d) => [d.data, d]))
  const dias = diasDoMes(mes).filter((d) => diaSemana(d) !== 0 || porData.has(d) || especialPorData.has(d))
  const domingosOcultos = diasDoMes(mes).some((d) => diaSemana(d) === 0 && !porData.has(d) && !especialPorData.has(d))
  const temEspecial = dias.some((d) => especialPorData.has(d))
  const temManual = registros.some((reg) => BATIDAS.some((b) => reg.batidas[b] && reg.origens?.[b] === 'manual'))

  
```

```tsx
{dias.map((data, idx) => {
            const reg = porData.get(data)
            const domingo = diaSemana(data) === 0
            const trab = reg ? minutosTrabalhados(reg.batidas) : null
            const saldo = reg ? saldoDia(reg.batidas, reg.jornadaMin) : null
            const temBatida = !!reg && BATIDAS.some((b) => reg.batidas[b])
            const incompleto = temBatida && trab === null
            const especial = especialPorData.get(data)
            const tipo = especial?.tipo
            const fundo = tipo ? C.especial : domingo ? C.fimSemana : idx % 2 === 1 ? C.zebra : undefined
            return (
              <View
                key={data}
                style={idx === dias.length - 1 ? [styles.linha, styles.linhaUltima, { backgroundColor: fundo }] : [styles.linha, { backgroundColor: fundo }]}
                wrap={false}
              >
                <Text style={[styles.cDia, { color: domingo && !tipo ? C.muted : C.ink }]}>
                  {rotulo(data)}
                  {tipo && temBatida ? <Text style={{ fontSize: 6.5, color: C.azul, fontFamily: 'Helvetica-Bold' }}>{`  ${abreviar(especial?.nome || (tipo === 'feriado' ? 'Feriado' : 'Troca de feriado'), 19)}`}</Text> : null}
                </Text>
                {tipo && !temBatida ? (
                  // Feriado / troca de feriado sem batida: o rótulo ocupa as colunas de horário.
                  <Text style={styles.cEspecial}>{especial?.nome ? `${TIPO_DIA_LABEL[tipo]} · ${especial.nome}` : TIPO_DIA_LABEL[tipo]}</Text>
                ) : (
                  BATIDAS.map((b) => {
                    const iso = reg?.batidas[b]
                    return (
                      <Text key={b} style={[styles.cHora, iso ? {} : styles.vazio]}>
                        {iso ? `${horaSP(iso)}${reg?.origens?.[b] === 'manual' ? '*' : ''}` : '—'}
                      </Text>
                    )
                  })
                )}
                <Text style={[styles.cTotal, trab !== null ? { fontFamily: 'Helvetica-Bold' } : incompleto ? { color: C.amber, fontFamily: 'Helvetica-Bold' } : styles.vazio]}>
                  {trab !== null ? formatarMinutos(trab) : incompleto ? 'incompleto' : '—'}
                </Text>
                <Text style={[styles.cSaldo, saldo !== null ? { color: tomSaldo(saldo), fontFamily: 'Helvetica-Bold' } : styles.vazio]}>
                  {saldo !== null ? formatarMinutos(saldo, true) : '—'}
                </Text>
              </View>
            )
          })}
        
```

---

## 7. Ordem de deploy e checklist

1. Aplicar a migration `0065` no Supabase.
2. Deploy do liberty-sistema (API nova). Conferir: `POST /api/ponto/integracao` com `{"acao":"folha","mes":"2026-11"}` devolve `diasEspeciais` (vazio no início).
3. Deploy do grupo-liberty (ou já estando no ar, funciona assim que a API responder).
4. No grupo-liberty, marcar um dia como Feriado com nome: a marcação aparece e o saldo desse dia deixa de ser negativo.
5. Conferir **no liberty-sistema** (depois de implementar a seção 5): a mesma marcação aparece na folha, no PDF e no Excel, com o mesmo saldo.
6. Remover a marcação (Dia normal) e ver o saldo voltar ao cálculo normal.
7. Testes: `npx vitest run lib/ponto` deve passar (incluem `marcar_dia` e `folha` com `diasEspeciais`).
