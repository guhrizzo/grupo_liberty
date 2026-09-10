# Excluir fotos de veículo no mobile

**Data:** 2026-09-10
**Branch:** `feat/excluir-fotos-veiculo-mobile` (a partir da `master`)

## Problema

No formulário de cadastro/edição de veículo (`app/dashboard/veiculos/VeiculosClient.tsx`,
grade de miniaturas por volta da linha 1876), cada foto tem um botão "X" para
remover, mas ele é renderizado com `opacity-0 group-hover:opacity-100`. Em telas
de toque não existe hover, então o botão fica invisível e não há como remover uma
foto pelo celular.

Hoje a remoção também não pede nenhuma confirmação — um clique/toque acidental no
X apaga a miniatura na hora.

## Escopo

- Somente UI. Um único arquivo: `app/dashboard/veiculos/VeiculosClient.tsx`.
- A remoção de foto já é client-side: `removePhoto(index)` tira o item do estado
  `photos`, e no `handleSubmit` o array `fotos` final é remontado a partir do que
  sobrou e persistido via `updateVehicle`. **Nenhuma** mudança em server
  actions, Firestore ou Storage.
- Vale para o mesmo formulário tanto no cadastro quanto na edição.

### Fora do escopo

- Modo de seleção múltipla / tela "gerenciar fotos".
- Reordenar fotos no toque (o drag-and-drop HTML5 continua desktop-only).
- Fotos em outras telas (triagem de anúncios, ficha pública, etc.).

## Mudanças

### 1. Botão "X" alcançável no toque

Na miniatura de foto (`photos.map(...)`):

- Trocar `opacity-0 group-hover:opacity-100` do botão de remover por
  `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`. No mobile o X fica
  sempre visível; no desktop continua aparecendo no hover, como hoje.
- Aumentar o alvo de toque: padding `p-1` → `p-1.5`, ícone `IconX` de `size={12}`
  para `size={14}`, posição `top-1` → `top-1.5` / `right-1` → `right-1.5`.
- Manter `e.stopPropagation()` e `z-10` no botão para o toque não cair no
  container `draggable`.

### 2. Confirmação antes de remover

- Novo estado: `const [photoToRemove, setPhotoToRemove] = useState<number | null>(null)`.
- O `onClick` do botão "X" passa a chamar `setPhotoToRemove(index)` em vez de
  `removePhoto(index)` direto.
- Renderizar um `<ConfirmDialog>` (componente já usado no projeto — ver
  `app/dashboard/anuncios/AnunciosClient.tsx`) dentro do formulário:
  - `open={photoToRemove !== null}`
  - `onClose={() => setPhotoToRemove(null)}`
  - `onConfirm`: chama `removePhoto(photoToRemove!)` e depois `setPhotoToRemove(null)`
  - `title="Remover esta foto?"`
  - `description="A foto sai da galeria deste veículo quando você salvar as alterações."`
  - `confirmLabel="Remover"`, `cancelLabel="Cancelar"`, `tone="danger"`
- Vale em qualquer viewport (mobile e desktop) — protege contra toque/clique
  acidental.
- `resetForm` / fechar formulário: garantir que `photoToRemove` volta a `null`
  (adicionar `setPhotoToRemove(null)` no `resetForm`).

## Comportamento esperado

1. Abrir a edição de um veículo com fotos no celular → o X aparece no canto
   superior direito de cada miniatura.
2. Tocar no X → abre o diálogo "Remover esta foto?".
3. Confirmar → a miniatura some da grade. Cancelar → nada muda.
4. Salvar o veículo → a galeria persistida não tem mais a foto removida.
5. No desktop, o fluxo é o mesmo, com o X aparecendo no hover e o diálogo de
   confirmação agora também presente.

## Testes

Manual (não há suíte de testes de UI no projeto):

- Mobile (viewport ~375px, ou DevTools responsivo): X visível, diálogo abre,
  remoção e cancelamento funcionam, salvar persiste.
- Desktop: X no hover, diálogo de confirmação aparece, remoção funciona.
- Remover foto nova (ainda não enviada) e foto já existente — ambos os casos
  saem da grade e do array final no submit.
- Foto de capa (índice 0): remover a capa promove a próxima foto a capa (badge
  "Capa" muda de miniatura).
