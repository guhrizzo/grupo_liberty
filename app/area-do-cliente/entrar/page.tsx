import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { lerTemaPortal } from '@/utils/portal/tema'
import { clienteAutenticado } from '@/utils/portal/acesso'
import logo from '@/app/public/logo-liberty-car-white.png'
import FormEntrada from './FormEntrada'
import TemaEntrada from './TemaEntrada'
import VideoEntrada from './VideoEntrada'
import styles from './entrada.module.css'

export default async function EntrarPortalPage() {
  if (await clienteAutenticado()) redirect('/area-do-cliente')
  const temaInicial = await lerTemaPortal()

  return (
    <TemaEntrada temaInicial={temaInicial}>
      <div className={styles.apresentacao}>
        <VideoEntrada />
        <Link href="/" className={styles.marca} aria-label="Página inicial da Liberty">
          <Image src={logo} alt="Liberty Car" width={112} className={styles.logo} />
        </Link>
      </div>
      <section className={styles.acesso} aria-labelledby="entrar-titulo">
        <div className={styles.conteudo}>
          <h1 id="entrar-titulo">Entrar na Área do Cliente</h1>
          <FormEntrada />
        </div>
      </section>
    </TemaEntrada>
  )
}
