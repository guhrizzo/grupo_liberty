// Formatação de posições do Autocarsat (sem "server-only": usada também em
// componentes de tela).
// O portal manda a data como "DD/MM/AAAA HH:mm:ss" (horário de Brasília, sem
// horário de verão desde 2019). `new Date()` leria isso como mês/dia — por
// isso o parse é manual. Outros formatos (ISO) caem no `new Date()`.
export function parseEventoAutocarsat(valor: string | undefined | null): Date | null {
  if (!valor) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(valor.trim());
  const d = m
    ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] + 3, +m[5], +(m[6] ?? 0)))
    : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatarEvento(valor: string): { texto: string; antigo: boolean } {
  const d = parseEventoAutocarsat(valor);
  if (!d) return { texto: valor || "—", antigo: false };
  const texto = d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  // Sem sinal há mais de 24 h.
  return { texto, antigo: Date.now() - d.getTime() > 24 * 60 * 60 * 1000 };
}

export type EstadoVeiculo = "movimento" | "parado" | "desligado" | "semsinal";

export const ESTADOS: Record<EstadoVeiculo, { rotulo: string; cor: string }> = {
  movimento: { rotulo: "Em movimento", cor: "#16a34a" },
  parado: { rotulo: "Parado (ligado)", cor: "#f59e0b" },
  desligado: { rotulo: "Desligado", cor: "#6b7280" },
  semsinal: { rotulo: "Sem sinal há +24 h", cor: "#dc2626" },
};

// Estado de um veículo a partir da posição do Autocarsat: sem evento há mais
// de 24 h (ou data inválida) = sem sinal; ignição ligada e acima de 3 km/h =
// em movimento; ligada e parada = parado; senão desligado.
export function estadoDoVeiculo(
  p: { ignition?: string; speed?: number; date_time_event?: string },
  agora: number = Date.now(),
): EstadoVeiculo {
  const t = parseEventoAutocarsat(p.date_time_event)?.getTime();
  if (t === undefined || agora - t > 24 * 60 * 60 * 1000) return "semsinal";
  if (p.ignition === "ON") return Number(p.speed) > 3 ? "movimento" : "parado";
  return "desligado";
}
