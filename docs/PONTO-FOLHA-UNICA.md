# Ponto: folha única com o liberty-sistema

A folha de ponto mora no **liberty-sistema** (Supabase). Este sistema não grava mais em `ponto_registros` / `ponto_config` do Firestore: as ações de `app/dashboard/ponto/**` chamam `POST /api/ponto/integracao` do liberty-sistema por `utils/ponto/folha-unica.ts`.

- **Identidade:** o e-mail. Na folha, o `uid` de um funcionário é o próprio e-mail (os uids do Firebase e do Supabase são diferentes). O funcionário precisa ter conta nos dois sistemas.
- **Continua aqui:** sessão, permissão `ponto` para ver a folha, QR rotativo (`PONTO_QR_SECRET`, o mesmo valor nos dois), validação de celular e de GPS.
- **Passou para a folha única:** gravar a batida (ordem, intervalo mínimo, duplicidade), correções com histórico, jornada por funcionário e a leitura da folha do mês (Excel e PDF usam esses dados).

## Variáveis de ambiente (deploy da Vercel e `.env.local`)

| Variável | Valor |
|---|---|
| `PONTO_API_URL` | `https://<dominio-do-liberty-sistema>/api/ponto/integracao` |
| `PONTO_API_SECRET` | o mesmo valor configurado no liberty-sistema (mín. 16 caracteres) |

Sem elas o ponto fica indisponível (a tela mostra "integração com a folha única não configurada").

## Migrar os dados que já estão no Firestore

Com o liberty-sistema já no ar e com a mesma `PONTO_API_SECRET`:

```bash
npm run ponto:migrar
npm run ponto:migrar -- --apply
```

O primeiro comando é uma simulação e só conta o que seria feito. O segundo grava. Dias que já existem na folha única são mantidos (conflito) e nada é apagado do Firestore. Depois de conferir a folha, as coleções antigas podem ser arquivadas à mão.

Contrato completo da API: `docs/PONTO.md` no liberty-sistema.
