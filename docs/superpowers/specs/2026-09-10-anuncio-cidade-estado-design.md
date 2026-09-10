# Cidade/Estado no anúncio de veículo de terceiro

## Contexto

O formulário público `/anuncie-seu-veiculo` não pergunta onde o veículo está.
Hoje, quando o anúncio é aprovado, o veículo criado usa uma `localizacao` fixa
('Jaú/SP' ou 'Bauru/SP') — a loja da Liberty escolhida na triagem — que não
reflete a localização real de um carro de terceiro (o carro fica com o dono,
não numa loja da Liberty). Ver [[feature-anuncios-terceiros]] e
[[feature-selo-terceiro-publico]].

## Objetivo

Coletar a cidade e o estado do veículo no formulário de anúncio, mostrar isso
pra equipe na triagem, e exibir publicamente no anúncio do veículo (card e
ficha técnica) quando for um veículo de terceiro — em vez do pino fixo de loja,
que não corresponde à realidade nesses casos.

## Decisão (aprovada com o Gustavo)

- **Onde coletar:** formulário público `/anuncie-seu-veiculo`, seção "O
  veículo". Cidade (texto livre) + Estado (select de UF), ambos
  **obrigatórios**.
- **Uso:** aparece na triagem (`/dashboard/anuncios`) para a equipe, e também
  **publicamente** no anúncio do veículo (card do catálogo e ficha técnica),
  quando `terceiro === true`.
- **Substituição, não adição:** no card e na ficha pública, para veículos de
  terceiro, o pino "Cidade/UF" **substitui** o pino de loja fixo (Jaú/SP ou
  Bauru/SP), que não faz sentido pra um carro que não está numa loja da
  Liberty. Veículos do estoque próprio continuam mostrando a loja normalmente.
- **Dados expostos:** só cidade e estado. Nome/telefone/e-mail do dono
  continuam estritamente internos (comportamento existente, sem mudança).

## Escopo técnico

1. `utils/estadosBrasil.ts` (novo): lista das 27 UFs, no padrão de
   `utils/veiculos/opcoes.ts`.
2. `app/anuncie-seu-veiculo/AnuncioForm.tsx`: campos Cidade + Estado
   (obrigatórios) na seção "O veículo".
3. `app/api/anuncios/route.ts`: validar e gravar `cidade`/`estado` no
   documento `anuncios`.
4. `app/dashboard/anuncios/shared.ts`: `cidade`/`estado` na interface
   `Anuncio`.
5. `app/dashboard/anuncios/AnunciosClient.tsx`: mostrar cidade/estado no card
   de triagem.
6. `app/dashboard/anuncios/actions.ts` (`aprovarAnuncio`): copiar
   `cidade`/`estado` do anúncio para `terceiroInfo` do veículo criado.
7. `app/dashboard/veiculos/actions.ts` (`Veiculo.terceiroInfo`): adicionar
   `cidade: string` e `estado: string` ao tipo.
8. `app/dashboard/veiculos/public.ts` (`PublicVeiculo`): expor
   `cidadeTerceiro`/`estadoTerceiro` (só esses dois campos — nunca o
   `terceiroInfo` inteiro) quando `terceiro === true`.
9. `app/PublicVehiclesList.tsx`: card mostra `cidadeTerceiro/estadoTerceiro`
   no lugar do pino de loja quando `terceiro === true` e os dados existem.
10. `app/veiculos/[id]/page.tsx`: ficha técnica mostra
    `terceiroInfo.cidade/estado` no lugar de "Loja Jaú/SP" / "Bauru/SP"
    quando `terceiro === true`.

Fora de escopo: mudar o campo "Loja" da triagem (continua existindo, usado
internamente/logística); veículos do estoque próprio (não-terceiro).
