import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { codigoExiste } from '@/utils/indicacoes/servidor'
import { lerTemaPortal } from '@/utils/portal/tema'
import { clienteAutenticado } from '@/utils/portal/acesso'
import logo from '@/app/public/logo-liberty-car-white.png'
import FormEntrada from './FormEntrada'
import TemaEntrada from './TemaEntrada'
import VideoEntrada from './VideoEntrada'
import styles from './entrada.module.css'

const destinos = [
  { rota: 'quitacao', modulo: 'quitacao' },
  { rota: 'pos-venda', modulo: 'posVenda' },
  { rota: 'investimentos', modulo: 'investimentos' },
] as const

export default async function EntrarPortalPage({ searchParams }: { searchParams: Promise<{ destino?: string | string[]; ref?: string | string[] }> }) {
  const { destino, ref } = await searchParams
  const codigoIndicacao = typeof ref === 'string' && await codigoExiste(ref) ? ref : undefined
  const destinoPermitido = destinos.find(({ rota }) => rota === destino)
  const cliente = await clienteAutenticado()
  if (cliente) {
    redirect(destinoPermitido && cliente.cadastro.modulos.includes(destinoPermitido.modulo)
      ? `/area-do-cliente/${destinoPermitido.rota}`
      : '/area-do-cliente')
  }
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
          <FormEntrada destino={destinoPermitido?.rota} codigoIndicacao={codigoIndicacao} />
        </div>
      </section>
    </TemaEntrada>
  )
}
