# Plano: excluir fotos de veículo no mobile

Spec: `docs/superpowers/specs/2026-09-10-excluir-fotos-veiculo-mobile-design.md`
Branch: `feat/excluir-fotos-veiculo-mobile` (a partir da `master`)

Arquivo único: `app/dashboard/veiculos/VeiculosClient.tsx`.
`ConfirmDialog` já está importado no arquivo (linha ~13) e hoje sem uso.

## Passo 1 — estado + confirmação

- Adicionar estado perto dos outros de foto (após `dragOverIndex`, ~linha 245):
  `const [photoToRemove, setPhotoToRemove] = useState<number | null>(null)`
- Em `resetForm` (~linha 495, junto de `setPhotos([])`): adicionar
  `setPhotoToRemove(null)`.
- Nova função logo abaixo de `removePhoto` (~linha 299):
  ```ts
  const confirmRemovePhoto = () => {
    if (photoToRemove !== null) removePhoto(photoToRemove)
    setPhotoToRemove(null)
  }
  ```

## Passo 2 — botão "X" da miniatura

Na grade `photos.map(...)` (~linha 1910), no `<button>` de remover:

- `onClick`: trocar `removePhoto(index)` por `setPhotoToRemove(index)`
  (manter o `e.stopPropagation()`).
- className: `opacity-0 group-hover:opacity-100` →
  `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`.
- Alvo de toque maior: `p-1` → `p-1.5`, `top-1 right-1` → `top-1.5 right-1.5`.
- `<IconX size={12} .../>` → `size={14}`.

## Passo 3 — renderizar o ConfirmDialog

Junto do modal de exclusão de veículo (~linha 2353), adicionar:

```tsx
<ConfirmDialog
  open={photoToRemove !== null}
  onClose={() => setPhotoToRemove(null)}
  onConfirm={confirmRemovePhoto}
  title="Remover esta foto?"
  description="A foto sai da galeria deste veículo quando você salvar as alterações."
  confirmLabel="Remover"
  cancelLabel="Cancelar"
  tone="danger"
/>
```

## Passo 4 — verificação

- `npm run lint`
- `npm run build`
- Teste manual no preview (viewport mobile ~375px e desktop):
  - Mobile: X visível em cada miniatura; toque abre o diálogo; Remover tira a
    foto da grade; Cancelar não faz nada.
  - Desktop: X no hover; diálogo de confirmação aparece; Remover funciona.
  - Remover a 1ª foto (capa) promove a próxima a capa (badge "Capa" move).
  - Salvar o veículo persiste a galeria sem a foto removida (foto nova e foto
    já existente).

## Commits

1. `feat(veiculos): confirma antes de remover foto e deixa o X visível no mobile`

(Passos 1–3 são um só commit — mudança pequena e coesa num arquivo.)

## Fora de escopo

Seleção múltipla, reordenar fotos no toque, fotos em telas de anúncios/ficha
pública, mudança no modal de exclusão de veículo.
