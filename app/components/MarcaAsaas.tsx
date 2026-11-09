import Image from 'next/image'
import LOGO_ASAAS from '@/app/public/logo-asaas.svg'

/** Logo do Asaas em linha com o texto. No tema escuro ganha um fundo claro (o azul some no escuro). */
export default function MarcaAsaas({ className = '' }: { className?: string }) {
  return (
    <Image
      src={LOGO_ASAAS}
      alt="Asaas"
      width={87}
      height={15}
      className={`inline-block h-[0.85em] w-auto align-baseline adobe-dark:box-content adobe-dark:rounded adobe-dark:bg-white adobe-dark:px-1.5 adobe-dark:py-0.5 ${className}`}
    />
  )
}
