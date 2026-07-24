import Link from 'next/link'
import { IconCar, IconArrowLeft } from '@tabler/icons-react'
import { Button } from './components/ui'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-liberty/10 border border-liberty/30 flex items-center justify-center">
          <IconCar size={32} className="text-liberty" />
        </div>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-liberty">
            Erro 404
          </p>
          <h1 className="mt-2 text-3xl font-black text-neutral-900 tracking-tight">
            Esse veículo deu carona pra fora do nosso estoque.
          </h1>
          <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
            A página que você procura não existe ou foi removida. Confira o endereço ou volte para a listagem.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
          <Link href="/">
            <Button variant="liberty" leftIcon={<IconArrowLeft size={14} />}>
              Voltar ao estoque
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">Painel interno</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
