'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Button, Input, Select, useToast } from '@/app/components/ui'
import type { EtapaConfig, EtapaQuitacao } from '@/utils/quitacoes/etapas'
import { atualizarQuitacaoPortal } from './actions'
import { TIPOS_ANEXO, type AnexoQuitacao, type TipoAnexo } from './types'

export default function AcompanhamentoSection({ veiculoId, vinculo, etapas, etapaInicial, previsaoInicial, naoAplicaveisInicial, anexos, publicados }: {
  veiculoId: string
  vinculo: string
  etapas: EtapaConfig[]
  etapaInicial: EtapaQuitacao
  naoAplicaveisInicial: string[]
  previsaoInicial: string
  anexos: Partial<Record<TipoAnexo, AnexoQuitacao>>
  publicados: Partial<Record<TipoAnexo, string>>
}) {
  const [etapa, setEtapa] = useState(etapaInicial)
  const [previsao, setPrevisao] = useState(previsaoInicial)
  const [naoAplicaveis, setNaoAplicaveis] = useState(naoAplicaveisInicial)
  // Etapas desativadas só aparecem se a operação já está nelas.
  const disponiveis = etapas.filter((e) => e.ativa || e.id === etapaInicial)
  const opcoes = disponiveis.map(({ id, nome }) => ({ value: id, label: nome }))
  const [pendente, iniciar] = useTransition()
  const toast = useToast()

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    const arquivos = TIPOS_ANEXO.flatMap(({ id }) => {
      const versao = anexos[id]?.versaoArquivo
      return dados.get(id) === 'on' && versao ? [{ tipo: id, versao }] : []
    })
    iniciar(async () => {
      const resposta = await atualizarQuitacaoPortal(veiculoId, etapa, vinculo, arquivos, previsao, naoAplicaveis.filter((id) => id !== etapa))
      if (resposta.error) toast.error(resposta.error)
      else toast.success(resposta.success ?? 'Acompanhamento atualizado.')
    })
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h4 className="font-semibold text-neutral-900">Acompanhe sua Quitação (Área do Cliente)</h4>
      <p className="mt-1 text-sm text-neutral-600">A etapa e os arquivos selecionados ficam disponíveis ao titular vinculado à compra.</p>
      <form method="post" onSubmit={salvar} className="mt-4 space-y-3">
        <Select label="Etapa da quitação" value={etapa} options={opcoes} disabled={pendente} onChange={(evento) => setEtapa(evento.target.value as EtapaQuitacao)} />
        <fieldset className="space-y-2" disabled={pendente}>
          <legend className="mb-1 text-sm font-medium">Etapas que não se aplicam a esta operação</legend>
          <p className="text-xs text-neutral-500">Marque as etapas que esta operação não vai ter. Elas somem da linha do tempo do cliente.</p>
          {disponiveis.map(({ id, nome }) => (
            <label key={id} className="flex items-start gap-2 text-sm">
              <input
                className="mt-1"
                type="checkbox"
                checked={naoAplicaveis.includes(id) && id !== etapa}
                disabled={id === etapa}
                onChange={(evento) => setNaoAplicaveis((atual) => evento.target.checked ? [...atual, id] : atual.filter((x) => x !== id))}
              />
              <span className={id === etapa ? 'text-neutral-400' : undefined}>{nome}{id === etapa && ' (etapa atual)'}</span>
            </label>
          ))}
        </fieldset>
        <Input
          label="Previsão de conclusão (opcional)"
          type="date"
          value={previsao}
          disabled={pendente}
          onChange={(evento) => setPrevisao(evento.target.value)}
          hint="Só preencha com uma estimativa confiável. O cliente verá essa data. Deixe vazio para não exibir."
        />
        {TIPOS_ANEXO.some(({ id }) => anexos[id]) && (
          <fieldset className="space-y-2" disabled={pendente}>
            <legend className="mb-2 text-sm font-medium">Documentos visíveis ao cliente</legend>
            {TIPOS_ANEXO.filter(({ id }) => anexos[id]).map(({ id, label }) => (
              <label key={id} className="flex items-start gap-2 text-sm">
                <input className="mt-1" name={id} type="checkbox" defaultChecked={!!publicados[id] && publicados[id] === anexos[id]?.versaoArquivo} />
                <span>{label} <span className="text-neutral-500">({anexos[id]?.fileName})</span></span>
              </label>
            ))}
          </fieldset>
        )}
        <Button type="submit" size="sm" loading={pendente}>Salvar acompanhamento</Button>
      </form>
    </section>
  )
}
