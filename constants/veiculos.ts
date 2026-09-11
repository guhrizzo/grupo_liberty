// Constantes de regra de negócio dos veículos.

/**
 * Dias que um veículo marcado como "vendido" fica exposto na vitrine pública
 * antes de ser apagado de vez (doc + fotos + contratos) pelo cron
 * `/api/cron/limpar-vendidos`.
 */
export const VENDIDO_TTL_DIAS = 30
