# Aba Tarefas — plano de implementação

Spec: `docs/superpowers/specs/2026-10-01-tarefas-design.md` · Branch: `feat/tarefas`

1. **`constants/tarefas.ts`** — `TarefaStatus`, rótulos/cores, `ehTarefaStatus`,
   `tarefaAtrasada(t, hoje)` e limites de tamanho. Sem `server-only` (client + server).
2. **`app/dashboard/tarefas/types.ts`** — `Tarefa`, `UsuarioOpcao`,
   `TarefaFieldErrors`, `TarefaResponse`.
3. **`app/dashboard/tarefas/actions.ts`** (`'use server'`):
   - `getTarefas()` — ADM supremo: todas; demais: `where responsavelUid == uid`.
   - `getUsuariosAtribuiveis()` — só ADM supremo; Auth `listUsers` + `profiles` com cargo.
   - `salvarTarefa(fd)` — cria (sem `id`) ou edita (com `id`); valida título,
     descrição, prazo (`YYYY-MM-DD`) e responsável (tem de existir no Auth).
   - `excluirTarefa(id)`, `definirFechada(id, fechada)` — reabrir volta p/
     `pendente`, limpa `motivo`/`respondidoEm`.
   - `responderTarefa(id, status, motivo)` — só o responsável, só se `!fechada`;
     `nao_concluida` exige motivo; `pendente` desfaz a resposta.
   - Todas com `revalidatePath('/dashboard', 'layout')` (atualiza o contador).
4. **`page.tsx` / `loading.tsx` / `TarefasClient.tsx`** — lista em cartões, abas
   Abertas/Fechadas, filtros (ADM: responsável e status), modal criar/editar,
   `ConfirmDialog` p/ excluir, resposta inline com motivo. Classes `adobe-dark:`.
5. **Menu** — item "Tarefas" (ícone checklist, todos os cargos) em
   `DashboardShell.tsx`; prop `tarefasPendentesCount` calculada em `layout.tsx`.
6. **Changelog** — entrada no topo de `constants/changelog.ts`.
7. **Verificação** — `npm run lint`, `npm run build`, teste manual no navegador.
