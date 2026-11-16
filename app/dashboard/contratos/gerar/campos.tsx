// Peças de formulário compartilhadas pelo modal "Gerar contrato" e pela página
// da promessa de compra.

export function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 p-3.5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">{titulo}</p>
      {children}
    </div>
  )
}

export function Marcar({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-liberty,#0a84ff)]" />
      {children}
    </label>
  )
}
