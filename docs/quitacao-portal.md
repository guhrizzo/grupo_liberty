# Acompanhe sua Quitação na Área do Cliente

## Operação

- Registre o CPF ou CNPJ em **Dados do Vendedor** e a data de aquisição no cadastro do veículo. O portal usa esses dados para relacionar a compra ao titular.
- O cliente precisa ter o acesso ativo e o módulo **Quitação** liberado em **Clientes do portal**.
- Em **Quitações**, abra a ficha do veículo e use **Acompanhe sua Quitação (Área do Cliente)** para atualizar a etapa e, se houver estimativa confiável, a **Previsão de conclusão**. O cliente também vê a data da operação (data de aquisição) e a instituição financeira (campo Banco do veículo). O controle **Marcar como quitado** também atualiza o portal.
- Faça o upload na área de anexos da própria ficha. Selecione os arquivos em **Documentos visíveis ao cliente** e salve. Quando um arquivo é substituído, a nova versão precisa ser selecionada novamente.
- O botão de atendimento usa o número em `QUITACAO_WHATSAPP`, com código do país e DDD. Se a variável estiver ausente, usa o WhatsApp do site da Liberty.

## Ativação

Novos cadastros e edições de veículos já atualizam o vínculo. Para preparar compras existentes, execute com as credenciais do ambiente de destino:

```powershell
npx.cmd tsx scripts/indexar-quitacoes-portal.ts
npx.cmd tsx scripts/indexar-quitacoes-portal.ts --apply
```

O primeiro comando só simula. O segundo altera apenas o índice de vínculo. São elegíveis veículos próprios com documento válido nos dados do vendedor e data de aquisição preenchida. Se `PORTAL_QUITACAO_INDEX_KEY` for usada, mantenha a mesma chave no servidor e durante a indexação. Na ausência dessa variável, o índice usa a chave privada do Firebase configurada no servidor.

Os avisos de mudança de etapa saem pelo Resend quando `RESEND_API_KEY` está configurada. O cron `/api/cron/avisos-quitacao` usa `CRON_SECRET` e tenta reenviar avisos pendentes. O envio não é necessário para salvar a etapa.

## Etapas configuráveis

- A lista de etapas é **global** e fica em `quitacao_config/etapas` (Firestore). Sem configuração salva, vale o padrão de 9 etapas definido em `utils/quitacoes/etapas.ts`.
- O administrador edita a lista em **Quitações > Configurar etapas** (`/dashboard/quitacoes/etapas`): nome, descrição para o cliente, ativa, avisar por e-mail e "conta como quitado", além da ordem. Só administradores acessam.
- Etapas existentes **não podem ser apagadas**, apenas desativadas, para o histórico das operações continuar válido. A etapa inicial (`recebido`) não pode ser desativada. Os ids antigos (`recebido`, `documentacao`, `negociacao`, `negociacao_concluida`, `em_quitacao`, `quitado`, `finalizado`) foram mantidos.
- Em cada operação, a ficha do veículo tem **Etapas que não se aplicam**: as marcadas somem da linha do tempo do cliente. A etapa atual não pode ser marcada.
- Etapas desativadas continuam aparecendo na linha do tempo das operações que já passaram por elas.
