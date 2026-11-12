import Image from 'next/image'
import { IconBrandWhatsapp, IconArrowRight } from '@tabler/icons-react'
import LOGO_LIBERTY from '@/app/public/logo-liberty-car-blue.png'
import LOGO_LIBERTY_CLARO from '@/app/public/logo-liberty-car-white.png'
import FooterLegalLinks from '@/app/components/FooterLegalLinks'

export default function PublicFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white py-10 px-4 md:px-8 mt-auto">
      <div className="mx-auto max-w-7xl grid gap-8 sm:flex sm:justify-between">
        {/* Logo / Sobre */}
        <div>
          <div>
            <Image src={LOGO_LIBERTY} alt="Liberty Car" className="h-auto w-[116px] adobe-dark:hidden" />
            <Image
              src={LOGO_LIBERTY_CLARO}
              alt="Liberty Car"
              className="hidden h-auto w-[116px] adobe-dark:block"
            />
          </div>
          <p className="mt-3 text-xs text-neutral-500 leading-relaxed max-w-xs">
            Veículos selecionados com transparência, segurança e as melhores condições de Jaú e Bauru.
          </p>
          <a
            href="https://localiberty.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-neutral-600 hover:text-liberty transition-colors"
          >
            Também alugamos veículos — Liberty
            <IconArrowRight size={13} stroke={2.2} />
          </a>
        </div>

        {/* Lojas */}
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-neutral-500">
            Lojas
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
            <li>
              <a
                href="https://maps.app.goo.gl/KKstZnVUb82SY4nf8"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-liberty transition-colors"
              >
                Jaú/SP — Ver no Google Maps
              </a>
            </li>
            <li>Bauru/SP — Av. Duque de Caxias, 7-75</li>
          </ul>
        </div>

        {/* Atendimento + Redes sociais */}
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-neutral-500">
            Atendimento
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
            <li>Seg–Sex • 08h–18h</li>
            <li>Sábado • 09h–17h</li>
          </ul>
          <div className="social-links mt-3 flex items-center gap-2">
            <a
              href="https://www.instagram.com/liberty_car7/"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition-[color,background-color,border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110 hover:-translate-y-0.5 hover:border-liberty hover:bg-liberty/10 hover:text-liberty hover:shadow-lg hover:shadow-liberty/20 active:scale-95"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-300 ease-out group-hover:rotate-6"
                aria-hidden="true"
              >
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </a>
            <a
              href="https://wa.me/5514998659046"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition-[color,background-color,border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110 hover:-translate-y-0.5 hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95"
            >
              <IconBrandWhatsapp size={20} stroke={1.8} />
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl mt-8 pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-neutral-500">
        <p>© {new Date().getFullYear()} Liberty Car. Todos os direitos reservados.</p>
        <p>
          Desenvolvido por{' '}
          <a
            href="https://www.instagram.com/gfrizzo_/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-neutral-700 hover:text-liberty transition-colors"
          >
            Gustavo Rizzo
          </a>
        </p>
        <FooterLegalLinks />
      </div>
    </footer>
  )
}
