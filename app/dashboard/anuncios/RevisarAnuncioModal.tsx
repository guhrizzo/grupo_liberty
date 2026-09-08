'use client'

import { useMemo, useState } from 'react'
import {
  IconArrowUp,
  IconArrowDown,
  IconWorld,
  IconBuildingWarehouse,
  IconAlertTriangle,
} from '@tabler/icons-react'
import { Modal, Input, Select, Textarea, Button, useToast } from '../../components/ui'
import { moneyFromNumber, parseMoney } from '@/utils/masks'
import { CAMBIO_OPCOES, COMBUSTIVEL_OPCOES } from '@/utils/veiculos/opcoes'
import { aprovarAnuncio } from './actions'
import { LOCALIZACOES_VEICULO, validarRevisaoVeiculo, type Anuncio, type RevisaoVeiculo } from './shared'

interface RevisarAnuncioModalProps {
  anuncio: Anuncio
  open: boolean
  onClose: () => void
  onDone: () => void
}

const LOCALIZACAO_OPCOES = LOCALIZACOES_VEICULO.map((l) => ({ value: l, label: l }))

export default function RevisarAnuncioModal({
  anuncio,
  open,
  onClose,
  onDone,
}: RevisarAnuncioModalProps) {
  const toast = useToast()

  const [marca, setMarca] = useState(anuncio.marca)
  const [modelo, setModelo] = useState(anuncio.modelo)
  const [ano, setAno] = useState(String(anuncio.ano || ''))
  const [cor, setCor] = useState(anuncio.cor)
  const [cambio, setCambio] = useState(anuncio.cambio)
  const [combustivel, setCombustivel] = useState(anuncio.combustivel)
  const [quilometragem, setQuilometragem] = useState(String(anuncio.quilometragem || ''))
  const [preco, setPreco] = useState(moneyFromNumber(anuncio.precoDesejado))
  const [descricao, setDescricao] = useState(anuncio.observacoes)
  const [placa, setPlaca] = useState(anuncio.placa ?? '')
  const [localizacao, setLocalizacao] = useState<string>('Jaú/SP')

  // Ordem das fotos + quais estão selecionadas.
  const [ordem, setOrdem] = useState<string[]>(anuncio.fotos)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set(anuncio.fotos))

  const [loading, setLoading] = useState<null | 'site' | 'estoque'>(null)

  const fotosEscolhidas = useMemo(
    () => ordem.filter((f) => selecionadas.has(f)),
    [ordem, selecionadas],
  )

  function moverFoto(i: number, dir: -1 | 1) {
    const destino = i + dir
    if (destino < 0 || destino >= ordem.length) return
    const nova = [...ordem]
    ;[nova[i], nova[destino]] = [nova[destino], nova[i]]
    setOrdem(nova)
  }

  function toggleFoto(url: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  function montarDados(): RevisaoVeiculo {
    return {
      marca: marca.trim(),
      modelo: modelo.trim(),
      ano: Number(ano.replace(/\D/g, '')),
      cor: cor.trim(),
      cambio,
      combustivel,
      quilometragem: Number(quilometragem.replace(/\D/g, '')),
      preco: parseMoney(preco),
      descricao: descricao.trim(),
      placa: placa.trim() ? placa.trim().toUpperCase() : null,
      localizacao,
      fotos: fotosEscolhidas,
    }
  }

  async function aprovar(publicar: boolean) {
    const dados = montarDados()
    const erro = validarRevisaoVeiculo(dados, anuncio.fotos)
    if (erro) {
      toast.error(erro, 'Revise os dados')
      return
    }

    setLoading(publicar ? 'site' : 'estoque')
    try {
      const res = await aprovarAnuncio(anuncio.id, dados, { publicar })
      if (res.error) {
        toast.error(res.error, 'Não foi possível aprovar')
        return
      }
      toast.success(res.success ?? 'Anúncio aprovado.', 'Pronto')
      if (res.emailSent) toast.success('E-mail enviado ao anunciante.', 'E-mail ✉️')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado.', 'Falha')
    } finally {
      setLoading(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Aprovar anúncio — ${anuncio.marca} ${anuncio.modelo}`}
      description="Confira e ajuste os dados. O veículo entra no estoque marcado como veículo de terceiro."
    >
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Marca" value={marca} onChange={(e) => setMarca(e.target.value)} />
          <Input label="Modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} />
          <Input
            label="Ano"
            inputMode="numeric"
            maxLength={4}
            value={ano}
            onChange={(e) => setAno(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          <Input label="Cor" value={cor} onChange={(e) => setCor(e.target.value)} />
          <Select
            label="Câmbio"
            options={[...CAMBIO_OPCOES]}
            value={cambio}
            onChange={(e) => setCambio(e.target.value)}
          />
          <Select
            label="Combustível"
            options={[...COMBUSTIVEL_OPCOES]}
            value={combustivel}
            onChange={(e) => setCombustivel(e.target.value)}
          />
          <Input
            label="Quilometragem"
            inputMode="numeric"
            value={quilometragem}
            onChange={(e) => setQuilometragem(e.target.value.replace(/\D/g, '').slice(0, 7))}
          />
          <Input
            label="Preço de venda (R$)"
            mask="money"
            inputMode="decimal"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
          />
          <Input
            label="Placa (opcional)"
            mask="plate"
            value={placa}
            onChange={(e) => setPlaca(e.target.value)}
            containerClassName="sm:col-span-1"
          />
          <Select
            label="Loja"
            options={LOCALIZACAO_OPCOES}
            value={localizacao}
            onChange={(e) => setLocalizacao(e.target.value)}
          />
        </div>

        <Textarea
          label="Descrição (vai para o site)"
          rows={4}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={2000}
        />

        <div>
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
            Fotos — {fotosEscolhidas.length} selecionada(s) · a 1ª é a capa
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {ordem.map((url, i) => {
              const on = selecionadas.has(url)
              return (
                <li
                  key={url}
                  className={`group relative aspect-square overflow-hidden rounded-lg border ${
                    on ? 'border-liberty ring-2 ring-liberty/30' : 'border-neutral-200 opacity-50'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => toggleFoto(url)}
                    className="absolute inset-0"
                    aria-label={on ? 'Remover foto' : 'Incluir foto'}
                  />
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => moverFoto(i, -1)}
                      disabled={i === 0}
                      className="rounded bg-white/90 p-0.5 text-neutral-700 disabled:opacity-30 cursor-pointer"
                      aria-label="Mover para trás"
                    >
                      <IconArrowUp size={11} stroke={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moverFoto(i, 1)}
                      disabled={i === ordem.length - 1}
                      className="rounded bg-white/90 p-0.5 text-neutral-700 disabled:opacity-30 cursor-pointer"
                      aria-label="Mover para frente"
                    >
                      <IconArrowDown size={11} stroke={2.5} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <IconAlertTriangle size={15} className="mt-0.5 shrink-0" />
          O veículo entra no estoque com o selo <strong>veículo de terceiro</strong> (não é da
          Liberty). O contato do dono fica guardado só no painel.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
        <Button
          variant="secondary"
          leftIcon={<IconBuildingWarehouse size={15} />}
          loading={loading === 'estoque'}
          disabled={loading !== null}
          onClick={() => aprovar(false)}
        >
          Só adicionar ao estoque
        </Button>
        <Button
          variant="liberty"
          leftIcon={<IconWorld size={15} />}
          loading={loading === 'site'}
          disabled={loading !== null}
          onClick={() => aprovar(true)}
        >
          Publicar no site
        </Button>
      </div>
    </Modal>
  )
}
