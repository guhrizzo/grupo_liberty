# Agenda com integração ao Google Agenda — design

Data: 2026-10-03 · Branch: `feat/agenda-google` · Origem: sugestão do Otavio em
Bugs & Melhorias ("agenda para compromissos, integrada ao Google Agenda").

## Objetivo

Nova aba **Agenda** para compromissos com data e horário. O compromisso criado
no painel aparece sozinho no Google Agenda de cada participante que conectou a
conta Google, e acompanha as edições e a exclusão feitas no painel.

## Decisões (confirmadas com o Gustavo)

- **Integração direta** com o Google Agenda (OAuth por usuário), não só link.
- **Com participantes:** cada compromisso tem um ou mais participantes da equipe.
- **Só o ADM supremo** (`isAdmSupremo`) cria, edita e exclui compromissos.
- **ADM supremo vê todos**, com filtro por pessoa; os demais veem só os
  compromissos em que são participantes.
- **Sincronia de mão única:** criar, editar e excluir no painel muda o Google.
  O que for mudado direto no Google não volta para o painel.

## Dados

### `agenda` (coleção nova)

```
titulo, descricao, local
data: 'YYYY-MM-DD'
diaInteiro: boolean
horaInicio, horaFim: 'HH:MM' | null      (fuso America/Sao_Paulo)
participantesUids: string[]
participantesNomes: Record<uid, string>
googleEventos: Record<uid, string>       (id do evento no Google de cada participante)
googleErros: Record<uid, string>         (última falha de sincronia, se houver)
criadoPorUid, criadoPorNome, criadoEm, atualizadoEm
```

### `google_agenda_contas/{uid}` (coleção nova, só servidor)

```
refreshToken: string (criptografado com utils/crypto)
email: string        (conta Google conectada)
conectadoEm: ISO
```

Lida/escrita só pelo Admin SDK; nunca vai para o navegador.

## Conexão com o Google (OAuth 2.0, web server flow)

1. Na aba Agenda, "Conectar Google Agenda" chama uma server action que monta a
   URL de autorização: escopos `calendar.events` + `openid email`,
   `access_type=offline`, `prompt=consent`, `state` assinado (HMAC com o client
   secret) contendo `uid` + validade de 10 min.
2. O navegador vai para o Google. **No app desktop** o Electron abre esse
   endereço externo no navegador do sistema (o Google não autoriza dentro de
   webview); a conexão fica salva na conta, então vale em todo lugar.
3. `GET /api/google-agenda/callback` valida o `state`, troca o `code` por
   tokens, guarda o refresh token criptografado e redireciona para
   `/google-agenda/conectado` (página pública simples: "Conectado, pode voltar").
4. Ao conectar, os compromissos **futuros** em que a pessoa já é participante
   são enviados para o Google dela.
5. "Desconectar" revoga o token no Google e apaga o registro (os eventos já
   criados no Google ficam lá).

## Sincronia (servidor, Calendar API v3 via `fetch`, sem dependência nova)

- Criar: `events.insert` no calendário `primary` de cada participante conectado.
- Editar: `events.patch` nos existentes; participante novo → `insert`;
  participante removido → `delete`.
- Excluir: `delete` em todos.
- Falha no Google **não impede** salvar no painel: grava em `googleErros[uid]`
  e o card mostra "Não sincronizado com o Google" com botão "Tentar de novo".
- Evento no Google: título, descrição + link para o painel, local, horário com
  `timeZone: America/Sao_Paulo` (ou dia inteiro).

## Telas

- **`/dashboard/agenda`** (menu "Agenda", todos os cargos, logo após Demandas
  na ordem padrão):
  - Faixa de conexão: "Conectar Google Agenda" ou "Conectado como x@gmail.com ·
    Desconectar".
  - Lista agrupada por dia (Hoje, Amanhã, datas), alternando Próximos/Anteriores.
  - ADM supremo: botão "Novo compromisso", editar/excluir no card e filtro por
    participante.
  - Card: horário, título, local, participantes (com quem não conectou o Google
    marcado), status de sincronia.
- **`/google-agenda/conectado`**: página pública de retorno.

## Configuração no Google Cloud (feita pelo Gustavo)

No projeto do Firebase (`FIREBASE_PROJECT_ID`) em console.cloud.google.com:

1. **APIs e serviços → Biblioteca:** ativar **Google Calendar API**.
2. **Plataforma de autenticação do Google → Branding:** nome do app, e-mail de
   suporte.
3. **Público-alvo:** tipo **Externo**, e clicar em **Publicar app** ("Em
   produção"). Sem verificação: até 100 usuários, aviso "app não verificado"
   na primeira conexão (Avançado → continuar). Em modo **Teste** a conexão
   venceria a cada 7 dias.
4. **Acesso a dados:** adicionar o escopo `.../auth/calendar.events`.
5. **Clientes → Criar cliente → Aplicativo da Web**, com URIs de redirecionamento:
   - `https://www.grupolibertycar.com.br/api/google-agenda/callback`
   - `http://localhost:3000/api/google-agenda/callback`
6. Copiar **ID do cliente** e **chave secreta** para a Vercel e o `.env.local`:
   `GOOGLE_AGENDA_CLIENT_ID`, `GOOGLE_AGENDA_CLIENT_SECRET`.

Sem as variáveis, a aba funciona normalmente sem a integração (botão de
conectar mostra "integração não configurada").

## Fora do escopo

Sincronia do Google para o painel, convites/RSVP pelo Google, lembretes por
e-mail do painel, compromissos recorrentes, visão de calendário em grade
(primeira versão é lista).

## Verificação

`tsc` + `npm run build` + teste manual: criar/editar/excluir compromisso com e
sem Google conectado; conectar/desconectar; conferir evento no Google Agenda.
