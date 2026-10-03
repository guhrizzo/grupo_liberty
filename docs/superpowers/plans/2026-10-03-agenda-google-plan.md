# Agenda + Google Agenda — plano

Spec: `docs/superpowers/specs/2026-10-03-agenda-google-design.md`

1. `utils/google-agenda.ts` (server-only): state assinado, URL de autorização,
   troca de code, refresh token criptografado, insert/patch/delete de eventos.
2. `app/dashboard/agenda/sincronia.ts` (server-only): sincronizar compromisso e
   futuros de um uid (fora de 'use server' de propósito).
3. `app/dashboard/agenda/actions.ts`: leitura, CRUD do ADM supremo,
   conectar/desconectar, ressincronizar.
4. `app/api/google-agenda/callback/route.ts` + `app/google-agenda/conectado`.
5. `page.tsx`, `AgendaClient.tsx`, `loading.tsx`, item no menu, changelog.
6. `tsc` + build + teste manual (sem credenciais; com credenciais após config).
