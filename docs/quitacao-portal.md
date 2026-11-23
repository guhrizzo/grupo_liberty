# Acompanhamento de quitação na Área do Cliente

## Operação

- Registre o CPF ou CNPJ em **Dados do Vendedor** e a data de aquisição no cadastro do veículo. O portal usa esses dados para relacionar a compra ao titular.
- O cliente precisa ter o acesso ativo e o módulo **Quitação** liberado em **Clientes do portal**.
- Em **Quitações**, abra a ficha do veículo e use **Acompanhamento na Área do Cliente** para atualizar a etapa. O controle **Marcar como quitado** também atualiza o portal.
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
