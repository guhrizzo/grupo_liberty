import { redirect } from 'next/navigation'

// Os registros e comissões viraram a página principal da aba Propostas.
export default function PropostasRegistradasRedirect() {
  redirect('/dashboard/propostas')
}
