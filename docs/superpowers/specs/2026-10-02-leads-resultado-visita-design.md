# Resultado de visita nos Leads — design

## Objetivo
O vendedor externo registra o resultado de cada visita ao cliente do lead.

## Decisões (usuário, 2026-10-02)
- Histórico de visitas por lead; a lista mostra a última em destaque.
- Campos: resultado (lista fechada), data da visita (editável, padrão hoje),
  data de retorno (só quando "Retornar", obrigatória nesse caso) e observação.
- Vale em Leads e Jurídico › Prospecção (mesmos registros, mesmo acesso).
- Resultados (sem "Outro"): Positiva, Negativa, Endereço não encontrado,
  Cliente não mora mais no endereço, Ninguém em casa / não atendeu, Retornar.

## Dados
Campo `visitas: Visita[]` no próprio documento de `juridico_prospeccao`
(poucas por lead; gravação atômica; some junto ao excluir o lead).
`Visita = { id, resultado, data (YYYY-MM-DD), retornoEm (YYYY-MM-DD|null),
observacao, vendedorUid, vendedorNome, criadoEm (ISO) }`.
"Última visita" = maior `data` (empate: maior `criadoEm`).
Editar/importar o lead não mexe em `visitas`.

## Permissões
- Registrar: quem tem acesso a Leads ou Jurídico (mesmo gate das actions atuais).
- Excluir visita: quem registrou ou ADM supremo. Visita não é editável
  (errou → exclui e registra de novo).

## Tela
- Colunas novas na tabela, depois do nome: "Última visita" (selo colorido +
  data + vendedor) e "Retornar em". Ambas com filtro estilo Excel.
- Botão "Visita" nas ações (tabela e cartão) abre modal com o checklist
  (botões de opção), campos e o histórico (mais recente primeiro).
- Cartão do celular mostra o selo da última visita e o retorno.
- Retorno vencido/hoje em destaque (âmbar).
