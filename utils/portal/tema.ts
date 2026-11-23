import 'server-only'
import { cookies } from 'next/headers'

export async function lerTemaPortal() {
  return (await cookies()).get('liberty_tema_entrada')?.value === 'light' ? 'light' : 'dark'
}
