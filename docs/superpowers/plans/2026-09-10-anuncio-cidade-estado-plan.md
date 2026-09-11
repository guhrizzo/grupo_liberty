# Plano: cidade/estado no anúncio de veículo de terceiro

Spec: `docs/superpowers/specs/2026-09-10-anuncio-cidade-estado-design.md`
Branch: `feat/anuncio-cidade-estado`

## Passo 1 — lista de UFs
- `utils/estadosBrasil.ts`: `ESTADO_OPCOES` (27 UFs), `ESTADO_VALUES`,
  `isEstadoValido`.
- Commit: `feat: lista de UFs do Brasil`

## Passo 2 — formulário público
- `AnuncioForm.tsx`: campos Cidade (Input) + Estado (Select de UF),
  obrigatórios, na seção "O veículo"; validação em `validar()`; envio no
  FormData.
- Commit: `feat: campos cidade/estado no formulário de anúncio`

## Passo 3 — API `/api/anuncios`
- `route.ts`: validar `cidade` (não vazia) e `estado` (UF válida) em
  `parseAnuncioForm`; gravar no doc `anuncios`.
- Commit: `feat: valida e grava cidade/estado no anúncio`

## Passo 4 — triagem
- `shared.ts`: `cidade`/`estado` na interface `Anuncio`.
- `AnunciosClient.tsx`: exibir cidade/estado no card (bloco "Veículo").
- `actions.ts` (`aprovarAnuncio`): `terceiroInfo.cidade`/`estado` = dados do
  anúncio.
- Commit: `feat: cidade/estado na triagem de anúncios`

## Passo 5 — exposição pública
- `dashboard/veiculos/actions.ts`: `terceiroInfo.cidade`/`estado` no tipo
  `Veiculo`.
- `dashboard/veiculos/public.ts`: `cidadeTerceiro`/`estadoTerceiro` em
  `PublicVeiculo` (só quando `terceiro === true`).
- `PublicVehiclesList.tsx`: pino cidade/UF no lugar do pino de loja pra
  veículo de terceiro.
- `veiculos/[id]/page.tsx`: idem na ficha técnica pública.
- Commit: `feat: cidade/estado do terceiro na parte pública`

## Verificação
- `npm run lint`
- `npm run build`
- Teste manual: enviar anúncio de teste com cidade/estado → aprovar → conferir
  card e ficha pública mostrando a cidade certa, e o card de veículo próprio
  (não-terceiro) continuando com o pino de loja normal.

## Fora de escopo
Campo "Loja" da triagem, veículos do estoque próprio.
