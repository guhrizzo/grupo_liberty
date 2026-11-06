import "server-only";

// Rastreamento Autocarsat (portal.autocarsat.com.br) — SOMENTE LEITURA.
//
// Não existe API pública documentada: este cliente usa os mesmos endpoints
// que o próprio portal chama no navegador (mapeados no app.js do portal):
//   POST /auth                  { username, password, app: "PORTAL" } → cookie `token`
//   GET  /api/posicoes          todas as últimas posições
//   GET  /api/posicoes/{uuid}/one
//   GET  /api/veiculos/combo/all
// A sessão é um cookie (HttpOnly, renovado a cada chamada, ~24h) e responde
// 401 quando expira. Como é API interna, pode mudar sem aviso — o ideal é
// pedir ao Autocarsat uma credencial de integração oficial.
//
// NÃO implementar aqui o bloqueio (POST /api/veiculos/block/{uuid}): é ação
// física num veículo real e só deve existir com confirmação explícita.
//
// Credenciais: AUTOCARSAT_USER e AUTOCARSAT_PASS (só servidor, nunca
// NEXT_PUBLIC_). AUTOCARSAT_URL é opcional.

const BASE = (process.env.AUTOCARSAT_URL ?? "https://portal.autocarsat.com.br").replace(/\/$/, "");

export type AutocarsatResult<T> = { ok: true; data: T } | { ok: false; error: string };

// Sessão em memória (por instância do servidor). Cai no login de novo em 401.
let cookieSessao: string | null = null;

function extrairToken(res: Response): string | null {
  const cookies =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const c of cookies) {
    const m = /^token=([^;]+)/.exec(c);
    if (m) return `token=${m[1]}`;
  }
  return null;
}

async function login(): Promise<AutocarsatResult<string>> {
  const username = process.env.AUTOCARSAT_USER;
  const password = process.env.AUTOCARSAT_PASS;
  if (!username || !password) {
    return { ok: false, error: "AUTOCARSAT_USER/AUTOCARSAT_PASS não configurados." };
  }

  try {
    // 1) O servidor cria a sessão no primeiro acesso.
    const inicial = await fetch(`${BASE}/login-local`, { redirect: "manual", cache: "no-store" });
    const cookie = extrairToken(inicial);
    if (!cookie) return { ok: false, error: "Autocarsat não devolveu cookie de sessão." };

    // 2) /auth marca essa sessão como autenticada.
    const res = await fetch(`${BASE}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Cookie: cookie },
      body: JSON.stringify({ username, password, app: "PORTAL" }),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `Login no Autocarsat falhou (HTTP ${res.status}).` };

    cookieSessao = extrairToken(res) ?? cookie;
    return { ok: true, data: cookieSessao };
  } catch {
    return { ok: false, error: "Não foi possível falar com o Autocarsat." };
  }
}

async function get<T>(caminho: string, tentarDeNovo = true): Promise<AutocarsatResult<T>> {
  if (!cookieSessao) {
    const l = await login();
    if (!l.ok) return l;
  }
  try {
    const res = await fetch(`${BASE}${caminho}`, {
      headers: { Accept: "application/json", Cookie: cookieSessao as string },
      cache: "no-store",
    });
    if (res.status === 401 && tentarDeNovo) {
      cookieSessao = null;
      return get<T>(caminho, false);
    }
    if (!res.ok) return { ok: false, error: `Autocarsat respondeu HTTP ${res.status}.` };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: "Não foi possível falar com o Autocarsat." };
  }
}

// GET /api/posicoes devolve um array simples, um item por veículo. Campos
// confirmados numa resposta real (outros existem: telemetria, outputs, etc.).
export interface PosicaoAutocarsat {
  uuid: string;
  placa: string;
  modelo: string;
  tipo: string;
  latitude: number;
  longitude: number;
  speed: number;
  ignition: "ON" | "OFF" | string;
  localization: string; // endereço aproximado
  date_time_event: string; // data/hora do último evento
  gps_valido: boolean;
  num_sat: number;
  sinal_cel: number;
  hodometro: string;
  horimetro: string;
  ancorado: boolean;
  [campo: string]: unknown;
}

export function listarPosicoes() {
  return get<PosicaoAutocarsat[]>("/api/posicoes");
}

export function posicaoDoVeiculo(uuid: string) {
  return get<PosicaoAutocarsat>(`/api/posicoes/${encodeURIComponent(uuid)}/one`);
}

export function listarVeiculos() {
  return get<unknown>("/api/veiculos/combo/all");
}
