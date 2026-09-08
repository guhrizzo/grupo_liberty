'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  IconSpeakerphone,
  IconMail,
  IconPhone,
  IconBrandWhatsapp,
  IconGauge,
  IconManualGearbox,
  IconGasStation,
  IconPalette,
  IconCalendar,
  IconCash,
  IconTrash,
  IconPhoto,
  IconExternalLink,
  IconSearch,
} from '@tabler/icons-react'
import { Breadcrumb, Button, ConfirmDialog, EmptyState, Modal, Textarea, useToast } from '../../components/ui'
import PhotoLightbox from '../../components/PhotoLightbox'
import { formatCurrency } from '@/utils/format'
import { recusarAnuncio, excluirAnuncio } from './actions'
import {
  ANUNCIO_STATUS_LABEL,
  ANUNCIO_STATUS_TONE,
  type Anuncio,
  type AnuncioStatus,
} from './shared'
import RevisarAnuncioModal from './RevisarAnuncioModal'

const CAMBIO_LABEL: Record<string, string> = {
  manual: 'Manual',
  automatico: 'Automático',
  cvt: 'CVT',
  automatizado: 'Automatizado',
}
const COMBUSTIVEL_LABEL: Record<string, string> = {
  flex: 'Flex',
  gasolina: 'Gasolina',
  etanol: 'Etanol',
  diesel: 'Diesel',
  eletrico: 'Elétrico',
  hibrido: 'Híbrido',
}

const FILTROS: Array<{ value: 'todos' | AnuncioStatus; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendente', label: 'Pendentes' },
  { value: 'publicado', label: 'Publicados' },
  { value: 'no_estoque', label: 'No estoque' },
  { value: 'recusado', label: 'Recusados' },
]

function whatsappLink(telefone: string, nome: string, veiculo: string): string | null {
  const digits = telefone.replace(/\D/g, '')
  if (!digits) return null
  const comPais = digits.length <= 11 ? `55${digits}` : digits
  const texto = encodeURIComponent(
    `Olá ${nome}, recebemos o anúncio do seu ${veiculo} na Liberty Car! Podemos conversar?`,
  )
  return `https://wa.me/${comPais}?text=${texto}`
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AnunciosClient({ anuncios }: { anuncios: Anuncio[] }) {
  const router = useRouter()
  const toast = useToast()

  const [filtro, setFiltro] = useState<'todos' | AnuncioStatus>('todos')
  const [busca, setBusca] = useState('')

  const [lightbox, setLightbox] = useState<{ fotos: string[]; alt: string } | null>(null)
  const [revisar, setRevisar] = useState<Anuncio | null>(null)
  const [recusarAlvo, setRecusarAlvo] = useState<Anuncio | null>(null)
  const [motivo, setMotivo] = useState('')
  const [excluirAlvo, setExcluirAlvo] = useState<Anuncio | null>(null)
  const [processando, setProcessando] = useState(false)

  const pendentes = anuncios.filter((a) => a.status === 'pendente').length

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return anuncios.filter((a) => {
      if (filtro !== 'todos' && a.status !== filtro) return false
      if (!q) return true
      return (
        a.nome.toLowerCase().includes(q) ||
        `${a.marca} ${a.modelo}`.toLowerCase().includes(q)
      )
    })
  }, [anuncios, filtro, busca])

  async function confirmarRecusa() {
    if (!recusarAlvo) return
    setProcessando(true)
    try {
      const res = await recusarAnuncio(recusarAlvo.id, motivo)
      if (res.error) {
        toast.error(res.error, 'Não foi possível recusar')
      } else {
        toast.success(res.success ?? 'Anúncio recusado.', 'Pronto')
        if (res.emailSent) toast.success('E-mail enviado ao anunciante.', 'E-mail ✉️')
        router.refresh()
      }
    } finally {
      setProcessando(false)
      setRecusarAlvo(null)
      setMotivo('')
    }
  }

  async function confirmarExclusao() {
    if (!excluirAlvo) return
    setProcessando(true)
    try {
      const res = await excluirAnuncio(excluirAlvo.id)
      if (res.error) toast.error(res.error, 'Não foi possível excluir')
      else {
        toast.success(res.success ?? 'Anúncio excluído.', 'Pronto')
        router.refresh()
      }
    } finally {
      setProcessando(false)
      setExcluirAlvo(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Anúncios' }]} />
        <h1 className="mt-1 flex items-center gap-3 text-3xl font-bold tracking-tight text-neutral-950">
          Anúncios de terceiros
          {pendentes > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-3 py-1 text-[13px] font-bold text-white shadow-sm">
              {pendentes} {pendentes === 1 ? 'novo' : 'novos'}
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Veículos que pessoas de fora cadastraram pelo site. Recuse, publique no site ou adicione
          ao estoque como veículo de terceiro.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                filtro === f.value
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome ou veículo…"
            className="w-64 rounded-lg border border-neutral-200 bg-neutral-50/50 py-2 pl-9 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <p className="px-1 text-xs text-neutral-500">
        Exibindo <strong className="font-semibold text-neutral-900">{filtrados.length}</strong> de{' '}
        <strong className="font-semibold text-neutral-900">{anuncios.length}</strong> anúncios
      </p>

      {filtrados.length === 0 ? (
        <EmptyState
          icon={<IconSpeakerphone size={24} stroke={1.5} />}
          title="Nenhum anúncio encontrado"
          description="Quando alguém anunciar um veículo pelo site, ele aparece aqui para triagem."
        />
      ) : (
        <div className="space-y-4">
          {filtrados.map((a) => {
            const veiculo = `${a.marca} ${a.modelo}`
            const wa = whatsappLink(a.telefone, a.nome, veiculo)
            return (
              <div key={a.id} className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
                <div className="mb-4 flex flex-col justify-between gap-4 border-b border-neutral-100 pb-4 md:flex-row md:items-center">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                      Enviado em {formatDate(a.created_at)}
                    </span>
                    <h3 className="mt-1 text-base font-bold text-neutral-900">{a.nome}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-neutral-600">
                      {a.cpf && <span>CPF {a.cpf}</span>}
                      <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 hover:text-liberty">
                        <IconMail size={13} className="text-neutral-400" />
                        {a.email}
                      </a>
                      <span className="inline-flex items-center gap-1 font-semibold text-neutral-800">
                        <IconPhone size={13} className="text-neutral-400" />
                        {a.telefone}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                      >
                        <IconBrandWhatsapp size={16} />
                        WhatsApp
                      </a>
                    )}
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${ANUNCIO_STATUS_TONE[a.status]}`}
                    >
                      {ANUNCIO_STATUS_LABEL[a.status]}
                    </span>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 md:col-span-1">
                    <span className="block text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                      Veículo
                    </span>
                    <h4 className="mt-1 text-sm font-bold text-neutral-900">
                      {veiculo} <span className="font-semibold text-neutral-500">{a.ano || ''}</span>
                    </h4>
                    <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                      <li className="flex items-center gap-1.5"><IconGauge size={12} /> {a.quilometragem.toLocaleString('pt-BR')} km</li>
                      <li className="flex items-center gap-1.5"><IconPalette size={12} /> {a.cor}</li>
                      <li className="flex items-center gap-1.5"><IconManualGearbox size={12} /> {CAMBIO_LABEL[a.cambio] ?? a.cambio}</li>
                      <li className="flex items-center gap-1.5"><IconGasStation size={12} /> {COMBUSTIVEL_LABEL[a.combustivel] ?? a.combustivel}</li>
                      {a.placa && <li className="flex items-center gap-1.5"><IconCalendar size={12} /> Placa {a.placa}</li>}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 md:col-span-1">
                    <span className="block text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                      Preço pretendido
                    </span>
                    <p className="mt-1 flex items-center gap-1.5 text-lg font-black text-neutral-950">
                      <IconCash size={16} className="text-neutral-400" />
                      {formatCurrency(a.precoDesejado)}
                    </p>
                    <span className="mt-3 block text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                      Informações
                    </span>
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-neutral-600">
                      {a.observacoes}
                    </p>
                  </div>

                  <div className="md:col-span-1">
                    <span className="block text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                      Fotos ({a.fotos.length})
                    </span>
                    {a.fotos.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setLightbox({ fotos: a.fotos, alt: veiculo })}
                        className="mt-2 grid grid-cols-3 gap-1.5"
                      >
                        {a.fotos.slice(0, 6).map((url, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={url}
                            src={url}
                            alt={`${veiculo} ${i + 1}`}
                            className="aspect-square w-full rounded-md object-cover"
                          />
                        ))}
                      </button>
                    ) : (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-400">
                        <IconPhoto size={13} /> Sem fotos
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-neutral-100 pt-4">
                  {a.status === 'pendente' ? (
                    <>
                      <button
                        onClick={() => setRecusarAlvo(a)}
                        className="rounded-lg border border-rose-200 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        Recusar
                      </button>
                      <button
                        onClick={() => setRevisar(a)}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
                      >
                        Aprovar…
                      </button>
                    </>
                  ) : (
                    <>
                      {a.veiculoId && (
                        <Link
                          href={`/dashboard/veiculos?veiculoId=${a.veiculoId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-100"
                        >
                          <IconExternalLink size={13} /> Ver no estoque
                        </Link>
                      )}
                      <button
                        onClick={() => setExcluirAlvo(a)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <IconTrash size={13} /> Excluir
                      </button>
                    </>
                  )}
                </div>

                {a.status === 'recusado' && a.motivoRecusa && (
                  <p className="mt-3 rounded-lg bg-rose-50/60 p-3 text-xs text-rose-800">
                    <strong>Motivo da recusa:</strong> {a.motivoRecusa}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {lightbox && (
        <PhotoLightbox fotos={lightbox.fotos} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}

      {revisar && (
        <RevisarAnuncioModal
          anuncio={revisar}
          open
          onClose={() => setRevisar(null)}
          onDone={() => {
            setRevisar(null)
            router.refresh()
          }}
        />
      )}

      <Modal
        open={!!recusarAlvo}
        onClose={() => {
          setRecusarAlvo(null)
          setMotivo('')
        }}
        title="Recusar anúncio"
        description="O anunciante recebe um e-mail avisando. O motivo é opcional e vai na mensagem."
        size="sm"
      >
        <Textarea
          label="Motivo (opcional)"
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={500}
          placeholder="Ex: veículo fora do perfil que trabalhamos no momento."
        />
        <div className="mt-4 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setRecusarAlvo(null)
              setMotivo('')
            }}
          >
            Cancelar
          </Button>
          <Button variant="danger" loading={processando} onClick={confirmarRecusa}>
            Recusar anúncio
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!excluirAlvo}
        onClose={() => setExcluirAlvo(null)}
        onConfirm={confirmarExclusao}
        title="Excluir anúncio?"
        description="Remove o anúncio e as fotos originais dele. O veículo já criado no estoque não é afetado."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        tone="danger"
        loading={processando}
      />
    </div>
  )
}
