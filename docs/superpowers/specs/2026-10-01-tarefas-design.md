# Aba Tarefas — design

**Data:** 2026-10-01 · **Branch:** `feat/tarefas`

## Objetivo

O ADM supremo (`ADM_SUPREMO_EMAILS` em `constants/permissoes.ts`: Gustavo e
Otavio) cria tarefas com prazo e as atribui a um usuário. O usuário vê as
próprias tarefas numa aba nova e responde: **concluída**, ou **não concluída**
com o motivo. O ADM supremo tem CRUD total.

## Decisões (confirmadas com o Gustavo)

| Tema | Decisão |
| --- | --- |
| Responsável | Um usuário por tarefa |
| Prazo | Só data (`YYYY-MM-DD`), vence no fim do dia no fuso `America/Sao_Paulo` |
| Aviso | Contador no menu lateral (tarefas pendentes do próprio usuário) |
| Resposta | O usuário pode mudar a resposta até o ADM supremo **fechar** a tarefa |
| Quem cria/edita/exclui | Só ADM supremo (gate por e-mail, `isAdmSupremo`) |

## Rota e menu

- `/dashboard/tarefas`, item "Tarefas" no menu (ícone checklist), visível a
  todos os cargos — mesma abordagem de "Bugs & Melhorias" (sem `PermissionKey`,
  porque o gate é por e-mail, não por cargo).
- Contador: nº de tarefas do usuário logado com `status = 'pendente'` e
  `fechada = false`. Calculado no `app/dashboard/layout.tsx` com
  `where('responsavelUid', '==', uid)` e filtro em memória (sem índice composto).

## Modelo — coleção `tarefas`

```ts
{
  titulo: string            // obrigatório, até 140
  descricao: string         // opcional, até 4000
  prazo: string             // 'YYYY-MM-DD'
  responsavelUid: string
  responsavelNome: string   // snapshot p/ exibir
  responsavelEmail: string
  status: 'pendente' | 'concluida' | 'nao_concluida'
  motivo: string | null     // obrigatório quando nao_concluida, até 1000
  respondidoEm: string | null  // ISO
  fechada: boolean          // ADM fechou → usuário não pode mais responder
  fechadaEm: string | null
  criadoPorUid, criadoPorNome, criadoEm, atualizadoEm
}
```

"Atrasada" é derivado: `status === 'pendente' && !fechada && prazo < hoje`.

## Permissões (aplicadas no servidor, em toda server action)

| Ação | ADM supremo | Responsável | Outros |
| --- | --- | --- | --- |
| Listar | todas | só as dele | nada |
| Criar / editar (inclui trocar responsável e prazo) | ✔ | — | — |
| Excluir | ✔ (com confirmação) | — | — |
| Fechar / reabrir | ✔ (reabrir volta p/ pendente e limpa o motivo) | — | — |
| Responder (concluída / não concluída + motivo) | ✔ se for o responsável | ✔ enquanto `fechada = false` | — |

## Tela

- **Usuário comum:** lista das suas tarefas, separadas em "Abertas" e
  "Fechadas". Cada cartão mostra título, descrição, prazo (vermelho se
  atrasada), status e os botões "Concluí" / "Não concluí" (abre campo de motivo).
  Depois de responder pode trocar a resposta enquanto não fechada.
- **ADM supremo:** botão "Nova tarefa" (modal: título, descrição, responsável,
  prazo); filtros por responsável e status, alternância Abertas/Fechadas; em
  cada cartão: editar, fechar/reabrir, excluir. Vê o motivo informado.
- Lista de usuários para o seletor: Firebase Auth + `profiles` (só quem tem cargo).
- Mobile: cartões empilhados; segue o tema claro/escuro (`adobe-dark:`) atual.

## Fora do escopo

E-mail de aviso, vários responsáveis, horário no prazo, anexos, comentários.

## Verificação

`npm run lint` + `npm run build` + teste manual: criar como ADM supremo,
responder como outro usuário, fechar/reabrir, excluir, contador do menu,
acesso negado às ações por usuário comum. Entrada no `constants/changelog.ts`.
