# Registro de ponto — versão Supabase

Complemento de [ponto-sincronizacao.md](ponto-sincronizacao.md). Aquele guia descreve o ponto do **grupo-liberty (Firebase/Firestore)**. Este mostra o que muda para implementar o **mesmo comportamento** em um projeto que usa **Supabase (Postgres + Supabase Auth)**.

> Written for: o desenvolvedor (ou o Claude) do projeto Supabase. Leia primeiro o guia principal; aqui só estão as diferenças de armazenamento, sessão e transação.

---

## 1. O que muda e o que não muda

**Copie sem alterar** (não dependem de banco; os testes `utils/ponto/*.test.ts` valem iguais):

| Arquivo | Conteúdo |
| --- | --- |
| `constants/ponto.ts` | constantes, tipos, lista `PONTO_FUNCIONARIOS_EMAILS`, `podeBaterPonto` |
| `utils/ponto/token.ts` | token HMAC do QR |
| `utils/ponto/calculo.ts` | horas, saldo, resumo do mês, fuso |
| `utils/ponto/geo.ts` | haversine e verificação do raio |
| `utils/ponto/dispositivo.ts` e `useDispositivoMobile.ts` | celular x computador |
| `app/dashboard/ponto/bater/LeitorQr.tsx` | câmera + `jsqr` |
| Telas (`page.tsx`, `FolhaClient.tsx`, `BaterPontoClient.tsx`, `QrClient.tsx`, `pdf/…`) | só trocam os imports para as actions da versão Supabase |

**Reescreva para Supabase** (este documento traz o código): `registros.ts`, `bater/actions.ts`, `qr/actions.ts`, `ponto/actions.ts` (folha), mais o SQL da seção 3.

### Mapa Firebase → Supabase

| Firebase (grupo-liberty) | Supabase |
| --- | --- |
| `adminDb` / `adminAuth` | `supabaseAdmin` (service role, só no servidor) |
| uid (string do Firebase) | `auth.users.id` (uuid, usado como string) |
| `ponto_registros/{uid}_{AAAA-MM-DD}` | tabela `ponto_registros`, coluna `id` = `"<uuid>_<AAAA-MM-DD>"` (mesmo formato de id) |
| `ponto_config/{uid}` | tabela `ponto_config` (`user_id` primária) |
| campos camelCase (`jornadaMin`) | colunas snake_case (`jornada_min`); `serializarRegistro` converte para o mesmo `RegistroPonto` |
| `batidas`, `origens`, `distancias`, `edicoes` (map/array) | colunas `jsonb` com **o mesmo formato** (batidas = ISO 8601 UTC) |
| `where('mes','==',mes)` | `data >= 'AAAA-MM-01' and data < 'primeiro dia do mês seguinte'` |
| `runTransaction` | funções Postgres (RPC) `ponto_registrar_batida` e `ponto_editar_batida` com `select … for update` |
| `adminAuth.listUsers` | `supabaseAdmin.auth.admin.listUsers` (nome em `user_metadata.full_name` ou `name`) |
| `getSessionUser` (cookie de sessão + `profiles.role`) | `@supabase/ssr` (`auth.getUser`) + tabela `profiles(id, role)` |

---

## 2. Variáveis de ambiente

As do guia principal (`PONTO_QR_SECRET`, `PONTO_EMPRESA_LAT`, `PONTO_EMPRESA_LNG`, `PONTO_RAIO_M`) mais as do Supabase, que o projeto já deve ter:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (**só servidor**; nunca com prefixo `NEXT_PUBLIC_`)

Dependências: as do guia principal mais `@supabase/supabase-js` e `@supabase/ssr`.

---

## 3. Banco de dados (rode no SQL Editor do Supabase)

> Este SQL **não foi executado** em um Postgres real por quem escreveu o guia (não havia banco disponível). Rode primeiro num projeto de teste/branch e confira os dois fluxos (bater e corrigir) antes de ir para produção. Já o TypeScript abaixo foi compilado contra o projeto sem erros.

```sql
-- =====================================================================
-- Tabelas
-- =====================================================================
create table if not exists public.ponto_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  jornada_min integer not null default 480 check (jornada_min between 30 and 960),
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

create table if not exists public.ponto_registros (
  id text primary key,                         -- "<user_id>_<AAAA-MM-DD>"
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null default '',
  nome text not null default '',
  data date not null,                          -- dia em America/Sao_Paulo
  batidas jsonb not null default '{}'::jsonb,  -- { entrada, saida_almoco, volta_almoco, saida } = ISO 8601 UTC
  origens jsonb not null default '{}'::jsonb,  -- { <batida>: 'qr' | 'digital' | 'manual' }
  distancias jsonb not null default '{}'::jsonb, -- { <batida>: metros até a empresa }
  jornada_min integer not null default 480,    -- jornada copiada na criação do dia
  edicoes jsonb not null default '[]'::jsonb,  -- [{ porUid, porEmail, em, campo, de, para, motivo }]
  unique (user_id, data)
);

create index if not exists ponto_registros_data_idx on public.ponto_registros (data);

-- RLS ligado e SEM policies: ninguém acessa pelo navegador (anon/authenticated).
-- Todo acesso passa pelo servidor com a service role, que ignora o RLS.
alter table public.ponto_config enable row level security;
alter table public.ponto_registros enable row level security;

-- =====================================================================
-- Registrar a próxima batida (transação; ordem fixa; intervalo mínimo)
-- =====================================================================
create or replace function public.ponto_registrar_batida(
  p_user_id uuid,
  p_email text,
  p_nome text,
  p_data date,
  p_origem text,
  p_distancia integer,
  p_jornada_min integer,
  p_agora text,                         -- ISO 8601 UTC, gerado pelo servidor da aplicação
  p_intervalo_ms integer default 120000
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := p_user_id::text || '_' || to_char(p_data, 'YYYY-MM-DD');
  v_reg public.ponto_registros;
  v_ordem text[] := array['entrada', 'saida_almoco', 'volta_almoco', 'saida'];
  v_item text;
  v_proxima text;
  v_ultimo timestamptz;
begin
  insert into public.ponto_registros (id, user_id, email, nome, data, jornada_min)
  values (v_id, p_user_id, p_email, p_nome, p_data, p_jornada_min)
  on conflict (id) do nothing;

  -- trava a linha: duas batidas simultâneas do mesmo funcionário se serializam
  select * into v_reg from public.ponto_registros where id = v_id for update;

  foreach v_item in array v_ordem loop
    if not (v_reg.batidas ? v_item) then
      v_proxima := v_item;
      exit;
    end if;
  end loop;

  if v_proxima is null then
    return jsonb_build_object('ok', false, 'erro', 'Seu ponto de hoje já está completo.');
  end if;

  select max(value::timestamptz) into v_ultimo from jsonb_each_text(v_reg.batidas);
  if v_ultimo is not null
     and extract(epoch from (p_agora::timestamptz - v_ultimo)) * 1000 < p_intervalo_ms then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Você acabou de bater o ponto. Aguarde alguns minutos para a próxima batida.'
    );
  end if;

  update public.ponto_registros set
    batidas = batidas || jsonb_build_object(v_proxima, p_agora),
    origens = origens || jsonb_build_object(v_proxima, p_origem),
    distancias = case
      when p_distancia is null then distancias
      else distancias || jsonb_build_object(v_proxima, p_distancia)
    end
  where id = v_id;

  return jsonb_build_object('ok', true, 'batida', v_proxima, 'iso', p_agora);
end
$$;

-- =====================================================================
-- Lançar/corrigir/apagar uma batida (ADM supremo). p_novo = ISO UTC ou null (apaga)
-- =====================================================================
create or replace function public.ponto_editar_batida(
  p_user_id uuid,
  p_email text,
  p_nome text,
  p_data date,
  p_campo text,
  p_novo text,
  p_motivo text,
  p_por_uid text,
  p_por_email text,
  p_jornada_min integer,
  p_agora text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := p_user_id::text || '_' || to_char(p_data, 'YYYY-MM-DD');
  v_reg public.ponto_registros;
  v_ordem text[] := array['entrada', 'saida_almoco', 'volta_almoco', 'saida'];
  v_item text;
  v_batidas jsonb;
  v_anterior text;
  v_atual timestamptz;
  v_ult timestamptz := null;
begin
  if not (p_campo = any (v_ordem)) then
    return jsonb_build_object('ok', false, 'erro', 'Dados inválidos.');
  end if;

  insert into public.ponto_registros (id, user_id, email, nome, data, jornada_min)
  values (v_id, p_user_id, p_email, p_nome, p_data, p_jornada_min)
  on conflict (id) do nothing;

  select * into v_reg from public.ponto_registros where id = v_id for update;

  v_anterior := v_reg.batidas ->> p_campo;
  v_batidas := v_reg.batidas;
  if p_novo is null then
    v_batidas := v_batidas - p_campo;
  else
    v_batidas := v_batidas || jsonb_build_object(p_campo, p_novo);
  end if;

  if v_anterior is not distinct from p_novo then
    delete from public.ponto_registros where id = v_id and batidas = '{}'::jsonb and edicoes = '[]'::jsonb;
    return jsonb_build_object('ok', false, 'erro', 'Nada foi alterado.');
  end if;

  -- as batidas presentes precisam estar em ordem cronológica
  foreach v_item in array v_ordem loop
    if v_batidas ? v_item then
      v_atual := (v_batidas ->> v_item)::timestamptz;
      if v_ult is not null and v_atual < v_ult then
        delete from public.ponto_registros where id = v_id and batidas = '{}'::jsonb and edicoes = '[]'::jsonb;
        return jsonb_build_object(
          'ok', false,
          'erro', 'Os horários precisam seguir a ordem: entrada, saída p/ almoço, volta, saída.'
        );
      end if;
      v_ult := v_atual;
    end if;
  end loop;

  update public.ponto_registros set
    batidas = v_batidas,
    origens = case
      when p_novo is null then origens - p_campo
      else origens || jsonb_build_object(p_campo, 'manual')
    end,
    distancias = distancias - p_campo,
    edicoes = edicoes || jsonb_build_array(jsonb_build_object(
      'porUid', p_por_uid,
      'porEmail', p_por_email,
      'em', p_agora,
      'campo', p_campo,
      'de', v_anterior,
      'para', p_novo,
      'motivo', p_motivo
    ))
  where id = v_id;

  return jsonb_build_object('ok', true);
end
$$;

-- =====================================================================
-- Só o servidor (service role) executa as funções
-- =====================================================================
revoke all on function public.ponto_registrar_batida(uuid, text, text, date, text, integer, integer, text, integer)
  from public, anon, authenticated;
revoke all on function public.ponto_editar_batida(uuid, text, text, date, text, text, text, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.ponto_registrar_batida(uuid, text, text, date, text, integer, integer, text, integer)
  to service_role;
grant execute on function public.ponto_editar_batida(uuid, text, text, date, text, text, text, text, text, integer, text)
  to service_role;
```

Pontos de atenção do SQL:
- O horário da batida é o `p_agora` que o **servidor da aplicação** gera (`new Date().toISOString()`); o banco só grava. É o mesmo comportamento do Firestore.
- `data` é do tipo `date`: o PostgREST devolve `"AAAA-MM-DD"`, exatamente o que `RegistroPonto.data` espera.
- Se a tabela `profiles` do projeto tiver outro nome/colunas, ajuste `sessao.ts`.

---

## 4. Diferenças de comportamento a conferir

1. **Folha:** o Firestore filtrava por `mes`; aqui o filtro é por intervalo de `data`. O resultado é o mesmo.
2. **Funcionários da folha:** continuam sendo só os de `PONTO_FUNCIONARIOS_EMAILS` (cruzados com `auth.users`); o nome vem de `user_metadata.full_name`/`name`. Se o projeto guarda o nome em outro lugar (ex.: `profiles.nome`), ajuste `listarFuncionarios` e `getSessionUser`.
3. **Exportar Excel/PDF:** as rotas `api/ponto/pdf` e `api/ponto/xlsx` chamam `getFolhaMes` (já pronto). Na rota do Excel, troque a consulta direta do Firestore por:
   ```ts
   const { data: linhas } = await supabaseAdmin
     .from('ponto_registros').select('*')
     .gte('data', `${mes}-01`).lt('data', proximoMes)
   const registros = (linhas ?? []).map((l) => serializarRegistro(l as LinhaPonto))
   ```
4. **Redirecionamento ao login:** o middleware/proxy do projeto, ao barrar `/dashboard/ponto/bater` sem sessão, deve mandar para o login com `?redirect=<caminho + query>` (para o funcionário voltar à batida com o token). Use o helper de "caminho interno seguro" do projeto para evitar open redirect.
5. **Permissão da folha:** `exigirAdmSupremo` usa `ehAdmSupremo(email)` de `constants/permissoes`. Se o projeto não tiver esse arquivo, crie com a lista de e-mails dos ADMs supremos.

---

## 5. Sincronização entre os dois projetos

- **Comportamento:** igual, pelas regras do guia principal (seção 2) e pelos arquivos "copie sem alterar". Qualquer mudança de regra deve ir aos dois projetos.
- **Dados:** Firebase e Supabase são bancos separados, **não há sincronização automática** de registros entre eles. Se os dois projetos pertencem a empresas/equipes diferentes, não precisa. Se for a mesma equipe e você quer um único histórico, o caminho é escolher **um** banco como fonte (e fazer o outro projeto ler/gravar nele) ou criar uma rotina de cópia; isso é uma decisão à parte.
- **QR:** se quiser que um QR gerado em um projeto valha no outro, use o mesmo `PONTO_QR_SECRET` nos dois; senão, segredos diferentes.
- **Mantenha este arquivo e o principal atualizados** quando mudar SQL, regras ou código, e anote o commit de referência do grupo-liberty.

### Checklist (Supabase)
- [ ] SQL da seção 3 executado num ambiente de teste e validado
- [ ] Tabelas com RLS ligado e funções liberadas só para `service_role`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` no servidor (não exposta ao cliente)
- [ ] Arquivos "copie sem alterar" copiados; testes `vitest` passando
- [ ] Arquivos da seção 6 criados e adaptados (sessão, tabela de perfis, nome do usuário)
- [ ] Variáveis `PONTO_*` criadas na Vercel e redeploy feito
- [ ] Redirecionamento `?redirect=` para `/dashboard/ponto/bater`
- [ ] Teste real: QR no computador, bater no celular dentro/fora da empresa, folha, correção, Excel e PDF
- [ ] Apagar os registros de teste

---

## 6. Código de referência (Supabase)

Estes arquivos foram compilados (`tsc`) contra o projeto grupo-liberty com `@supabase/supabase-js` e `@supabase/ssr`. Importam de `@/constants/ponto`, `@/utils/ponto/*`, `@/utils/cobrancas/encargos` (`hojeSaoPaulo`) e `@/constants/permissoes` (`ehAdmSupremo`); ajuste os caminhos ao seu projeto. As telas importam as actions daqui no lugar das do Firebase.

### `utils/ponto/supabase-admin.ts`

```ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Cliente com a service role: ignora o RLS e só roda no servidor (equivale ao
 * Firebase Admin). NUNCA importe em componente de cliente.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
```

### `utils/ponto/sessao.ts`

```ts
import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from './supabase-admin'

export interface SessionUser {
  uid: string
  email: string | null
  name: string | null
  role: string | null
}

/**
 * Usuário logado (Supabase Auth) + cargo da tabela `profiles(id, role)`.
 * Se o seu projeto já tem uma função de sessão equivalente, use a dele e
 * devolva este mesmo formato.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {}, // leitura apenas; o refresh de sessão fica no proxy/middleware
      },
    },
  )
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null

  const meta = data.user.user_metadata as { full_name?: string; name?: string } | undefined
  const { data: perfil } = await supabaseAdmin.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  return {
    uid: data.user.id,
    email: data.user.email ?? null,
    name: meta?.full_name ?? meta?.name ?? null,
    role: (perfil?.role as string | undefined) ?? null,
  }
}
```

### `utils/ponto/registros.ts`

```ts
import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import {
  BATIDAS,
  JORNADA_PADRAO_MIN,
  type Batida,
  type Batidas,
  type EdicaoPonto,
  type OrigemBatida,
  type RegistroPonto,
} from '@/constants/ponto'

/** Linha da tabela `ponto_registros` (colunas em snake_case). */
export interface LinhaPonto {
  id: string
  user_id: string
  email: string | null
  nome: string | null
  data: string
  batidas: Record<string, unknown> | null
  origens: Record<string, unknown> | null
  distancias: Record<string, unknown> | null
  jornada_min: number | null
  edicoes: EdicaoPonto[] | null
}

/** Segredo que assina o QR. Lança se não estiver configurado. */
export function segredoPonto(): string {
  const s = process.env.PONTO_QR_SECRET
  if (!s || s.length < 16) throw new Error('PONTO_QR_SECRET não configurado no servidor.')
  return s
}

/** Linha do banco → o mesmo objeto `RegistroPonto` que o resto do código usa. */
export function serializarRegistro(l: LinhaPonto): RegistroPonto {
  const batidas: Batidas = {}
  const origens: RegistroPonto['origens'] = {}
  const distancias: RegistroPonto['distancias'] = {}
  for (const b of BATIDAS) {
    const v = l.batidas?.[b]
    if (typeof v === 'string') batidas[b as Batida] = v
    const o = l.origens?.[b]
    if (o === 'qr' || o === 'digital' || o === 'manual') origens[b as Batida] = o as OrigemBatida
    const d = l.distancias?.[b]
    if (typeof d === 'number') distancias[b as Batida] = d
  }
  return {
    id: l.id,
    uid: l.user_id,
    email: l.email ?? '',
    nome: l.nome ?? '',
    data: l.data,
    batidas,
    origens,
    distancias,
    jornadaMin: typeof l.jornada_min === 'number' ? l.jornada_min : JORNADA_PADRAO_MIN,
    edicoes: Array.isArray(l.edicoes) ? l.edicoes : [],
  }
}

export async function getJornadaMin(uid: string): Promise<number> {
  const { data } = await supabaseAdmin.from('ponto_config').select('jornada_min').eq('user_id', uid).maybeSingle()
  const v = data?.jornada_min
  return typeof v === 'number' && v > 0 ? v : JORNADA_PADRAO_MIN
}
```

### `app/dashboard/ponto/bater/actions.ts`

```ts
'use server'

import { headers } from 'next/headers'
import { supabaseAdmin } from './supabase-admin'
import { getSessionUser, type SessionUser } from './sessao'
import { hojeSaoPaulo } from '@/utils/cobrancas/encargos'
import { validarTokenPonto } from '@/utils/ponto/token'
import { horaSP } from '@/utils/ponto/calculo'
import { ehUserAgentMobile } from '@/utils/ponto/dispositivo'
import { lerLocalEmpresa, verificarLocal } from '@/utils/ponto/geo'
import { getJornadaMin, segredoPonto, serializarRegistro, type LinhaPonto } from './registros'
import {
  INTERVALO_MIN_ENTRE_BATIDAS_MS,
  podeBaterPonto,
  type Batida,
  type OrigemBatida,
  type RegistroPonto,
} from '@/constants/ponto'

export type BaterPontoResultado =
  | { ok: true; batida: Batida; hora: string }
  | { ok: false; erro: string }

interface PosicaoInformada {
  lat: number
  lng: number
  precisaoM: number
}

/** Registro do usuário logado para o dia de hoje (null se ainda não bateu). */
export async function getMeuDia(): Promise<RegistroPonto | null> {
  const user = await getSessionUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('ponto_registros')
    .select('*')
    .eq('id', `${user.uid}_${hojeSaoPaulo()}`)
    .maybeSingle()
  return data ? serializarRegistro(data as LinhaPonto) : null
}

/** Grava a próxima batida pelo RPC `ponto_registrar_batida` (transação no Postgres). */
async function registrarProximaBatida(
  user: SessionUser,
  origem: OrigemBatida,
  distanciaM: number,
): Promise<BaterPontoResultado> {
  try {
    const agora = new Date()
    const { data, error } = await supabaseAdmin.rpc('ponto_registrar_batida', {
      p_user_id: user.uid,
      p_email: user.email ?? '',
      p_nome: user.name ?? user.email ?? 'Usuário',
      p_data: hojeSaoPaulo(agora),
      p_origem: origem,
      p_distancia: distanciaM,
      p_jornada_min: await getJornadaMin(user.uid),
      p_agora: agora.toISOString(),
      p_intervalo_ms: INTERVALO_MIN_ENTRE_BATIDAS_MS,
    })
    if (error) throw error
    const r = data as { ok: boolean; erro?: string; batida?: Batida; iso?: string }
    if (!r.ok) return { ok: false, erro: r.erro ?? 'Não foi possível registrar o ponto.' }
    return { ok: true, batida: r.batida!, hora: horaSP(r.iso!) }
  } catch (err) {
    console.error('[registrarProximaBatida]', err)
    return { ok: false, erro: 'Não foi possível registrar o ponto. Tente novamente.' }
  }
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

/** Se o ponto digital está configurado no servidor (a tela mostra ou esconde o botão). */
export async function pontoDigitalDisponivel(): Promise<boolean> {
  return lerLocalEmpresa(process.env) !== null
}
```

### `app/dashboard/ponto/qr/actions.ts`

```ts
'use server'

import { headers } from 'next/headers'
import { getSessionUser } from './sessao'
import { podeBaterPonto } from '@/constants/ponto'
import { ehUserAgentMobile } from '@/utils/ponto/dispositivo'
import { gerarTokenPonto } from '@/utils/ponto/token'
import { segredoPonto } from './registros'

/** Token atual do QR. Só quem bate ponto e só em computador. */
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

### `app/dashboard/ponto/actions.ts`

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from './supabase-admin'
import { getSessionUser, type SessionUser } from './sessao'
import { hojeSaoPaulo } from '@/utils/cobrancas/encargos'
import { isoDeDataHoraSP, resumoMes } from '@/utils/ponto/calculo'
import { getJornadaMin, serializarRegistro, type LinhaPonto } from './registros'
import {
  BATIDAS,
  JORNADA_MIN_MAXIMA,
  JORNADA_PADRAO_MIN,
  podeBaterPonto,
  type Batida,
  type RegistroPonto,
} from '@/constants/ponto'
import { ehAdmSupremo } from '@/constants/permissoes'

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

/** Só o ADM supremo acessa a folha. */
async function exigirAdmSupremo(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')
  if (!ehAdmSupremo(user.email)) throw new Error('Acesso negado.')
  return user
}

/** Primeiro dia do mês seguinte (YYYY-MM-01), para filtrar `data >= mes-01 and data < proximo`. */
function inicioDoProximoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`
}

/** Quem bate ponto (lista PONTO_FUNCIONARIOS_EMAILS), com a jornada de cada um. */
async function listarFuncionarios(): Promise<FuncionarioPonto[]> {
  const [{ data: lista }, { data: configs }] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabaseAdmin.from('ponto_config').select('user_id, jornada_min'),
  ])
  const jornadas = new Map<string, number>()
  for (const c of configs ?? []) if (c.jornada_min > 0) jornadas.set(c.user_id as string, c.jornada_min as number)

  return (lista?.users ?? [])
    .filter((u) => podeBaterPonto(u.email))
    .map((u) => {
      const meta = u.user_metadata as { full_name?: string; name?: string } | undefined
      return {
        uid: u.id,
        nome: meta?.full_name ?? meta?.name ?? u.email ?? u.id,
        email: u.email ?? '',
        jornadaMin: jornadas.get(u.id) ?? JORNADA_PADRAO_MIN,
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Folha do mês: totais de todos e o detalhe dia a dia do funcionário `uid`. */
export async function getFolhaMes(mes: string, uid: string | null): Promise<FolhaMes> {
  await exigirAdmSupremo()
  if (!MES_RE.test(mes)) throw new Error('Mês inválido.')

  const [funcionarios, { data: linhas, error }] = await Promise.all([
    listarFuncionarios(),
    supabaseAdmin
      .from('ponto_registros')
      .select('*')
      .gte('data', `${mes}-01`)
      .lt('data', inicioDoProximoMes(mes)),
  ])
  if (error) throw error

  const todos = (linhas ?? []).map((l) => serializarRegistro(l as LinhaPonto))
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
  const adm = await exigirAdmSupremo().catch(() => null)
  if (!adm) return { ok: false, erro: 'Acesso negado.' }
  if (!uid || !Number.isInteger(minutos) || minutos < 30 || minutos > JORNADA_MIN_MAXIMA) {
    return { ok: false, erro: 'Jornada inválida (entre 0h30 e 16h).' }
  }
  const { error } = await supabaseAdmin.from('ponto_config').upsert({
    user_id: uid,
    jornada_min: minutos,
    atualizado_em: new Date().toISOString(),
    atualizado_por: adm.email ?? adm.uid,
  })
  if (error) {
    console.error('[salvarJornada]', error)
    return { ok: false, erro: 'Não foi possível salvar a jornada.' }
  }
  revalidatePath('/dashboard/ponto')
  return { ok: true }
}

/**
 * Lança, corrige ou apaga (hora vazia) uma batida de um funcionário num dia,
 * pelo RPC `ponto_editar_batida` (transação no Postgres). Exige motivo.
 */
export async function editarBatida(input: {
  uid: string
  data: string
  campo: Batida
  hora: string // "HH:mm" ou "" para apagar
  motivo: string
}): Promise<AcaoPontoResposta> {
  const adm = await exigirAdmSupremo().catch(() => null)
  if (!adm) return { ok: false, erro: 'Acesso negado.' }

  const { uid, data, campo } = input
  const motivo = String(input.motivo ?? '').trim().slice(0, 300)
  if (!uid || !DATA_RE.test(data) || !BATIDAS.includes(campo)) return { ok: false, erro: 'Dados inválidos.' }
  if (data > hojeSaoPaulo()) return { ok: false, erro: 'Não é possível lançar ponto em data futura.' }
  if (motivo.length < 3) return { ok: false, erro: 'Informe o motivo da alteração.' }

  const novo = input.hora ? isoDeDataHoraSP(data, input.hora) : null
  if (input.hora && !novo) return { ok: false, erro: 'Horário inválido.' }

  try {
    const { data: usuario, error: erroUsuario } = await supabaseAdmin.auth.admin.getUserById(uid)
    if (erroUsuario || !usuario.user) return { ok: false, erro: 'Funcionário não encontrado.' }
    const meta = usuario.user.user_metadata as { full_name?: string; name?: string } | undefined

    const { data: r, error } = await supabaseAdmin.rpc('ponto_editar_batida', {
      p_user_id: uid,
      p_email: usuario.user.email ?? '',
      p_nome: meta?.full_name ?? meta?.name ?? usuario.user.email ?? 'Usuário',
      p_data: data,
      p_campo: campo,
      p_novo: novo,
      p_motivo: motivo,
      p_por_uid: adm.uid,
      p_por_email: adm.email ?? '',
      p_jornada_min: await getJornadaMin(uid),
      p_agora: new Date().toISOString(),
    })
    if (error) throw error
    const res = r as { ok: boolean; erro?: string }
    if (!res.ok) return { ok: false, erro: res.erro ?? 'Não foi possível salvar a alteração.' }
    revalidatePath('/dashboard/ponto')
    return { ok: true }
  } catch (err) {
    console.error('[editarBatida]', err)
    return { ok: false, erro: 'Não foi possível salvar a alteração.' }
  }
}
```

