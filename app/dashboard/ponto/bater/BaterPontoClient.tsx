'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { IconCamera, IconCheck, IconClock, IconMapPin, IconQrcode } from '@tabler/icons-react'
import { Button, Card, Modal, StatusBadge, useToast } from '@/app/components/ui'
import { useDispositivoMobile } from '@/utils/ponto/useDispositivoMobile'
import LeitorQr from './LeitorQr'
import { BATIDAS, BATIDA_LABEL, type Batida, type Batidas } from '@/constants/ponto'
import { horaSP } from '@/utils/ponto/calculo'
import { baterPonto, baterPontoDigital, type BaterPontoResultado } from './actions'

interface Posicao {
  lat: number
  lng: number
  precisaoM: number
}

function obterPosicao(): Promise<Posicao> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Este aparelho não permite bater o ponto.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, precisaoM: p.coords.accuracy }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? 'Permita o acesso à localização do navegador para bater o ponto.'
              : 'Não foi possível confirmar onde você está. Tente de novo em um local aberto.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    )
  })
}

function formatarDia(data: string) {
  const [a, m, d] = data.split('-')
  return `${d}/${m}/${a}`
}

export default function BaterPontoClient({
  hoje,
  batidas,
  proxima,
  token,
  tokenValido,
  digitalDisponivel,
  nome,
}: {
  hoje: string
  batidas: Batidas
  proxima: Batida | null
  token: string | null
  tokenValido: boolean
  digitalDisponivel: boolean
  nome: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const [lendo, setLendo] = useState(false)
  const mobile = useDispositivoMobile()

  function concluir(r: BaterPontoResultado) {
    if (r.ok) {
      toast.success(`${BATIDA_LABEL[r.batida]} registrada às ${r.hora}.`)
      // Tira o token da URL: recarregar a página não deve oferecer nova batida.
      router.replace('/dashboard/ponto/bater')
      router.refresh()
    } else {
      setErro(r.erro)
    }
  }

  /** Pega a posição (o servidor confere se está na empresa) e registra a batida. */
  function executar(registrarCom: (pos: Posicao) => Promise<BaterPontoResultado>) {
    setErro(null)
    iniciar(async () => {
      try {
        concluir(await registrarCom(await obterPosicao()))
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível registrar o ponto.')
      }
    })
  }

  function registrar(t: string | null = token) {
    if (!t) return
    executar((pos) => baterPonto(t, pos))
  }

  /** QR lido pela câmera do site: fecha o leitor e já registra a batida. */
  function aoLerQr(t: string) {
    setLendo(false)
    registrar(t)
  }

  function registrarDigital() {
    executar((pos) => baterPontoDigital(pos))
  }

  // Bater ponto não existe no computador: nem o resumo do dia nem os botões.
  if (mobile === null) return null
  if (mobile === false) {
    return (
      <Card className="space-y-2 p-6 text-center">
        <IconClock className="mx-auto h-8 w-8 text-neutral-400" />
        <p className="font-semibold text-neutral-900">O ponto só pode ser batido pelo celular.</p>
        <p className="text-sm text-neutral-500">Abra esta página no seu celular para registrar o horário.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{formatarDia(hoje)}</p>
            <p className="text-base font-bold text-neutral-900">{nome}</p>
          </div>
          <IconClock className="h-6 w-6 text-neutral-400" />
        </div>

        <ul className="mt-4 divide-y divide-neutral-100">
          {BATIDAS.map((b) => {
            const iso = batidas[b]
            const ehProxima = b === proxima
            return (
              <li key={b} className="flex items-center justify-between py-3">
                <span className={ehProxima ? 'font-semibold text-neutral-900' : 'text-neutral-600'}>
                  {BATIDA_LABEL[b]}
                </span>
                {iso ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-base font-bold text-emerald-700">
                    <IconCheck className="h-4 w-4" stroke={3} />
                    {horaSP(iso)}
                  </span>
                ) : ehProxima ? (
                  <StatusBadge tone="liberty">Próxima</StatusBadge>
                ) : (
                  <span className="text-neutral-300">—</span>
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      {!proxima ? (
        <Card className="p-5 text-center">
          <p className="font-semibold text-emerald-700">Seu ponto de hoje está completo. Bom descanso!</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tokenValido ? (
            <Button variant="liberty" size="lg" fullWidth loading={pendente} loadingLabel="Registrando..." onClick={() => registrar()}>
              Registrar {BATIDA_LABEL[proxima].toLowerCase()}
            </Button>
          ) : (
            <Card className="space-y-3 p-5 text-center">
              <IconQrcode className="mx-auto h-8 w-8 text-neutral-400" />
              <p className="text-sm font-semibold text-neutral-800">
                {token ? 'QR expirado. Escaneie o QR code da tela novamente.' : 'Escaneie o QR code da tela da empresa.'}
              </p>
              <p className="text-xs text-neutral-500">O QR muda a cada 30 segundos, por segurança.</p>
              <Button
                variant="liberty"
                size="lg"
                fullWidth
                loading={pendente}
                loadingLabel="Registrando..."
                leftIcon={<IconCamera className="h-5 w-5" />}
                onClick={() => {
                  setErro(null)
                  setLendo(true)
                }}
              >
                Escanear QR code
              </Button>
            </Card>
          )}

          {digitalDisponivel && (
            <>
              <p className="text-center text-xs font-semibold uppercase tracking-wider text-neutral-400">ou</p>
              <Button
                variant={tokenValido ? 'secondary' : 'liberty'}
                size="lg"
                fullWidth
                loading={pendente}
                loadingLabel="Registrando..."
                leftIcon={<IconMapPin className="h-5 w-5" />}
                onClick={registrarDigital}
              >
                Bater ponto digital: {BATIDA_LABEL[proxima].toLowerCase()}
              </Button>
            </>
          )}
          {erro && <p className="text-center text-sm font-medium text-rose-600">{erro}</p>}
        </div>
      )}

      <Modal open={lendo} onClose={() => setLendo(false)} title="Escanear QR code" size="sm">
        {lendo && <LeitorQr onToken={aoLerQr} />}
      </Modal>
    </div>
  )
}
