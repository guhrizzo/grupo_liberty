// Helpers para uso com useActionState (Next 16 / React 19).
// Padronizam o shape de retorno das server actions: { ok, message?, fieldErrors? }.

export type ActionResult = {
  ok: boolean
  message?: string
  fieldErrors?: Record<string, string>
}

export function ok(message?: string, extras?: Partial<ActionResult>): ActionResult {
  return { ok: true, message, ...extras }
}

export function fail(message: string, fieldErrors?: Record<string, string>): ActionResult {
  return { ok: false, message, fieldErrors }
}

export const initialActionState: ActionResult = { ok: true }
