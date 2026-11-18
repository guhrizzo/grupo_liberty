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

  const [localizando, setLocalizando] = useState(false)
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

  function registrar(t: string | null = token) {
    if (!t) return
    setErro(null)
    iniciar(async () => concluir(await baterPonto(t)))
  }

  /** QR lido pela câmera do site: fecha o leitor e já registra a batida. */
  function aoLerQr(t: string) {
    setLendo(false)
    registrar(t)
  }

  /** Ponto digital: pega a posição do aparelho e o servidor confere se está na empresa. */
  function registrarDigital() {
    setErro(null)
    if (!('geolocation' in navigator)) {
      setErro('Este aparelho não oferece localização.')
      return
    }
    setLocalizando(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocalizando(false)
        iniciar(async () =>
          concluir(
            await baterPontoDigital({
              lat: p.coords.latitude,
              lng: p.coords.longitude,
              precisaoM: p.coords.accuracy,
            }),
          ),
        )
      },
      (e) => {
        setLocalizando(false)
        setErro(
          e.code === e.PERMISSION_DENIED
            ? 'Permissão de localização negada. Libere a localização do navegador para este site e tente de novo.'
            : e.code === e.TIMEOUT
              ? 'Não foi possível obter sua localização a tempo. Vá para um local aberto e tente de novo.'
              : 'Não foi possível obter sua localização.',
        )
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
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
              {mobile === true && (
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
              )}
              {mobile === false && (
                <p className="text-xs font-semibold text-amber-700">
                  A leitura do QR só funciona no celular. Abra esta página no seu celular para bater o ponto.
                </p>
              )}
            </Card>
          )}

          {digitalDisponivel && (
            <>
              <p className="text-center text-xs font-semibold uppercase tracking-wider text-neutral-400">ou</p>
              <Button
                variant={tokenValido ? 'secondary' : 'liberty'}
                size="lg"
                fullWidth
                loading={localizando || pendente}
                loadingLabel={localizando ? 'Obtendo localização...' : 'Registrando...'}
                leftIcon={<IconMapPin className="h-5 w-5" />}
                onClick={registrarDigital}
              >
                Bater ponto digital: {BATIDA_LABEL[proxima].toLowerCase()}
              </Button>
              <p className="text-center text-xs text-neutral-500">
                Usa a localização do celular e só libera dentro da empresa.
              </p>
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
