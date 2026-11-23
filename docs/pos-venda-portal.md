# Pós-venda Liberty

## Operação

1. Cadastre o CPF ou CNPJ em **Dados do Comprador** e registre a venda no cadastro do veículo.
2. Libere o módulo **Pós-venda** em **Clientes do portal**.
3. O cliente solicita um serviço ou pacote em **Área do Cliente → Pós-venda**. Em **Dashboard → Pós-venda**, a equipe com acesso ao Financeiro publica a mensalidade, o primeiro vencimento e as condições.
4. O cliente aceita a proposta no portal. Se a cobrança estiver habilitada, o sistema cria uma assinatura mensal Pix no Asaas. O Pix é faturado mês a mês; o cliente paga a cobrança pelo link do Asaas. Recebimentos e estornos atualizam **Financeiro → Serviços de Pós-venda** pelo webhook.
5. A equipe autorizada publica os alertas jurídicos e os retornos de negociação na ficha do contrato. Processos cadastrados no Jurídico aparecem quando o veículo e o CPF do cliente correspondem. Observações internas ficam restritas à equipe.
6. Para rastreamento, informe o identificador do dispositivo Autocarsat na proposta. A localização exige serviço ativo, autorização do cliente e placa correspondente. O histórico reúne posições válidas registradas nas consultas ao portal e à tela interna.
7. A inativação da assinatura interrompe novas mensalidades. As cobranças já emitidas continuam disponíveis para conferência.

A defesa judicial e os honorários de 20%, quando previstos, devem constar nas condições acordadas com o advogado. O sistema registra as condições e o aceite da proposta. A negociação com bancos e os alertas do Jurídico são publicados pela equipe.

## Ativação

- Revise a permissão **Pós-venda** para a equipe. Ações de cobrança também exigem acesso a **Financeiro**; publicações jurídicas exigem **Jurídico**; consulta interna à localização exige **Rastreamento**.
- Defina `POS_VENDA_COBRANCA_HABILITADA=true` apenas no ambiente em que a recorrência deve operar. Use `ASAAS_API_KEY`, `ASAAS_ENV` e `ASAAS_WEBHOOK_TOKEN` do ambiente correspondente.
- No webhook existente, habilite `PAYMENT_CREATED`, `PAYMENT_UPDATED`, `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`, `SUBSCRIPTION_INACTIVATED` e `SUBSCRIPTION_DELETED`, além dos eventos já usados pelo sistema.
- O envio de alertas jurídicos por e-mail usa `RESEND_API_KEY`. A localização usa as credenciais Autocarsat já utilizadas pelo painel interno.
- Rode a simulação e, para aplicar o vínculo às vendas elegíveis antigas, execute novamente com `--apply` usando as credenciais do ambiente de destino:

```powershell
npx.cmd tsx scripts/indexar-pos-venda-portal.ts
npx.cmd tsx scripts/indexar-pos-venda-portal.ts --apply
```

Mantenha a chave de indexação estável. O servidor e o script usam `PORTAL_POS_VENDA_INDEX_KEY` ou, na ausência dela, a chave já usada na quitação ou a chave privada do Firebase.
