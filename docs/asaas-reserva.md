# Reserva de quitação via Asaas (split)

Cada parcela paga pelo Asaas é dividida: o % de reserva do veículo, calculado sobre o valor BRUTO da cobrança, vai para a conta de reserva (split de valor fixo) e o restante, já descontada a taxa do Asaas, fica na conta operacional.

## Configuração (variáveis de ambiente)

| Variável | Uso |
| --- | --- |
| `ASAAS_API_KEY` | Chave da conta emissora (sandbox ou produção) |
| `ASAAS_ENV` | `production` para produção; qualquer outro valor usa o sandbox |
| `ASAAS_RESERVA_WALLET_ID` | `walletId` da conta de reserva (destino do split) |
| `ASAAS_WEBHOOK_TOKEN` | Token enviado pelo Asaas no header `asaas-access-token` |
| `ASAAS_CARTAO_HABILITADO` | Reservado: cartão ainda não implementado |

No painel do Asaas: habilitar o split (Integrações > Segurança) e cadastrar o webhook `https://<dominio>/api/asaas/webhook` com os eventos listados em `app/api/asaas/webhook/route.ts`.

## Fluxo

1. Admin define o % de reserva do veículo (modal de pagamento da parcela > "Definir reserva"; há sugestão pelo saldo devedor e parcelas em aberto). O % vale para as cobranças geradas depois.
2. "Gerar Pix"/"Gerar boleto" cria a cobrança no Asaas com `split: [{walletId, fixedValue}]` (fixedValue = bruto × %) e grava o % usado em `asaas_cobrancas`.
3. Webhook `PAYMENT_RECEIVED` (ou `CONFIRMED` no cartão): baixa a parcela pelo mesmo núcleo do pagamento manual (`utils/cobrancas/pagamento-core.ts`), lança a receita no financeiro e credita a reserva em `reserva_lancamentos` (bruto, taxa, líquido, reserva, caixa).
4. `PAYMENT_REFUNDED` / `CHARGEBACK_DISPUTE_LOST`: remove a baixa e a receita e lança o estorno da reserva. `PAYMENT_OVERDUE` marca inadimplência. `PAYMENT_SPLIT_DONE` marca o crédito como liquidado.

## Coleções

- `asaas_cobrancas/{paymentId}`, `reserva_quitacao_veiculos/{veiculoId}` (% e saldo acumulado), `reserva_lancamentos/{paymentId_tipo}`, `asaas_eventos/{eventId}` (idempotência).

## Pontos a confirmar com o suporte do Asaas

- Compatibilidade do split com Pix, boleto e cartão e prazo de liquidação de cada um.
- Se a conta de reserva pode ser outra conta/subconta do mesmo CNPJ.
- Taxa extra de split e quem arca com a tarifa.
- Efeito de chargeback e estorno parcial sobre splits já liquidados.

Até lá: cartão fica bloqueado; estorno parcial e chargeback solicitado só sinalizam `revisaoManual`. O valor da reserva é lido do split devolvido pela API quando vier `totalValue`; senão é estimado (% sobre o líquido) e o lançamento fica com `fonte: 'estimado'`.
