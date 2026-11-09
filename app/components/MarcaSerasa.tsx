import Image from 'next/image'
import LOGO_SERASA from '@/app/public/logo-serasa.svg'

/** Logo do Serasa em linha com o texto (altura acompanha a fonte). */
export default function MarcaSerasa({ className = '' }: { className?: string }) {
  return (
    <Image
      src={LOGO_SERASA}
      alt="Serasa"
      width={52}
      height={23}
      className={`inline-block h-[1.5em] w-auto align-middle ${className}`}
    />
  )
}
