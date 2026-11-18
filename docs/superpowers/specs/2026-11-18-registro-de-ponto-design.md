# Registro de ponto por QR code — design

Data: 2026-11-18

## Objetivo

Funcionários registram o ponto apontando a câmera para um QR code rotativo exibido na empresa. O ADM supremo acessa a folha de ponto, corrige batidas, define jornadas e vê as horas trabalhadas no mês.

## Decisões

- **Identificação:** login existente (Firebase, cookie `session`). Quem não estiver logado faz login e volta à página de bater ponto.
- **Anti-fraude:** QR rotativo (token HMAC com validade curta) exibido em uma tela na empresa.
- **Quem bate ponto:** todos os usuários do sistema (qualquer cargo).
- **Quem vê a folha:** somente ADM supremo (`ehAdmSupremo`, e-mails em `ADM_SUPREMO_EMAILS`).
- **Fuso:** `America/Sao_Paulo` para definir o dia e exibir horários.
- **Esquecimento:** dia sem a saída final fica "incompleto", destacado ao ADM; nenhuma hora é calculada automaticamente.

## Fluxo do funcionário

1. Tela `/dashboard/ponto/qr` (ADM supremo) exibe o QR, renovado a cada 30 s. O QR codifica `/dashboard/ponto/bater?t=<token>`.
2. Funcionário abre o link. Sem sessão, o middleware/página redireciona ao login e retorna à mesma URL.
3. A página valida o token no servidor e mostra um botão com a próxima batida do dia, na ordem fixa:
   `entrada → saida_almoco → volta_almoco → saida`.
4. A server action `baterPonto(token)` revalida token e sessão, define a batida pela ordem e grava com horário do servidor.

## Token do QR

- Formato: `<janela>.<hmac>`, onde `janela = floor(now / 30s)` e `hmac = HMAC-SHA256(PONTO_QR_SECRET, janela)`.
- Aceita a janela atual e a anterior (tolerância ~60 s). Comparação em tempo constante.
- Sem estado no banco. Nova variável de ambiente: `PONTO_QR_SECRET`.
- O token identifica a empresa, não a pessoa; a pessoa vem da sessão.

## Regras de batida

- Horário gravado = `Timestamp` do servidor, nunca do cliente.
- Ordem fixa; não permite repetir nem pular etapa. Dia concluído (4 batidas) não aceita nova batida.
- Transação Firestore ao gravar, para evitar duplo toque/concorrência.

## Dados (Firestore)

`ponto_registros/{uid}_{AAAA-MM-DD}`:
- `uid`, `email`, `nome`, `data` (AAAA-MM-DD em America/Sao_Paulo)
- `batidas`: `{ entrada?, saida_almoco?, volta_almoco?, saida? }` (Timestamps)
- `jornada_min`: jornada esperada vigente no dia (minutos), copiada de `ponto_config` na criação do dia
- `edicoes[]`: `{ por_uid, por_email, em, campo, de, para, motivo }`

`ponto_config/{uid}`:
- `jornada_min` (minutos/dia, padrão 480), `atualizado_em`, `atualizado_por`.

## Cálculo

- Trabalhado do dia = `(saida_almoco − entrada) + (saida − volta_almoco)`. Dia incompleto = menos de 4 batidas (trabalhado exibido como parcial/"—").
- Saldo do dia = trabalhado − `jornada_min` (só em dias completos).
- Total do mês = soma dos trabalhados de dias completos; saldo do mês = soma dos saldos.
- Funções puras em `utils/ponto/calculo.ts`, testadas com vitest.

## Folha do ADM supremo (`/dashboard/ponto`)

- Seletor de mês e funcionário; tabela dia a dia (4 batidas, total, saldo, marca de "incompleto"); totais do mês.
- Lançar/corrigir batida manual (com motivo obrigatório; grava em `edicoes[]`).
- Definir jornada por funcionário (`ponto_config`).
- Exportar mês em Excel (`xlsx`) e PDF (`@react-pdf/renderer`), já presentes no projeto.

## Organização do código

- `constants/ponto.ts`: tipos, ordem das batidas, constantes.
- `utils/ponto/token.ts`: gerar/validar token (server-only).
- `utils/ponto/calculo.ts`: cálculos puros.
- `app/dashboard/ponto/` : `page.tsx` (folha, ADM), `actions.ts` (ações do ADM), `bater/` (página + action do funcionário), `qr/` (tela do QR, ADM).
- Item "Ponto" no menu; "Bater ponto" visível a todos, folha e QR somente ao ADM supremo. Checagem de permissão sempre no servidor.
- QR gerado com a lib `qrcode` (única dependência nova).
- Convenções de Next.js 16 do projeto: ler `node_modules/next/dist/docs/` antes de implementar.

## Erros e casos de borda

- Token expirado/ inválido: mensagem "QR expirado, escaneie novamente".
- Sem sessão: redireciona ao login e volta.
- Dia já concluído: mostra o resumo do dia, sem botão.
- Falha de gravação: mensagem de erro, nada é gravado pela metade (transação).

## Testes

- vitest: token (válido, expirado, adulterado), cálculo de horas/saldo (completo, incompleto, virada de dia), próxima batida.

## Fora do escopo

Geolocalização, fotos na batida, banco de horas acumulado entre meses, feriados/escala.
