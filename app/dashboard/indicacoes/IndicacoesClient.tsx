'use client'

import { useState, useTransition } from 'react'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { Button, Input, Select, useToast } from '@/app/components/ui'
import { ROTULO_STATUS_INDICACAO, type ConfigIndicacoes, type FaixaRecompensa, type StatusIndicacao } from '@/utils/indicacoes/modelo'
import { decidirIndicacao, salvarConfigIndicacoes } from './actions'

type LinhaIndicacao = {
  id: string
  indicadoNome: string
  indicadorNome: string
  status: StatusIndicacao
  criadoEm: string
  motivoRevisao: string | null
}

const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' })
const cartao = 'rounded-xl border border-neutral-200 bg-white p-5 shadow-xs'

export default function IndicacoesClient({ config, indicacoes, podeEditarRegras }: {
  config: ConfigIndicacoes
  indicacoes: LinhaIndicacao[]
  podeEditarRegras: boolean
}) {
  const [faixas, setFaixas] = useState<FaixaRecompensa[]>(config.faixas)
  const [validade, setValidade] = useState(String(config.validadeIndicacaoDias))
  const [jaCadastrado, setJaCadastrado] = useState(config.indicadoJaCadastrado)
  const [automatica, setAutomatica] = useState(config.liberacaoAutomatica)
  const [pendente, iniciar] = useTransition()
  const toast = useToast()

  // As faixas são contíguas: editar o "até" de uma faixa define o "de" da seguinte.
  const alterarFaixa = (i: number, mudanca: Partial<FaixaRecompensa>) =>
    setFaixas((lista) => {
      const copia = lista.map((f, j) => (j === i ? { ...f, ...mudanca } : f))
      for (let j = 1; j < copia.length; j++) copia[j] = { ...copia[j], de: (copia[j - 1].ate ?? copia[j - 1].de) + 1 }
      return copia
    })

  function adicionarFaixa() {
    setFaixas((lista) => {
      const ultima = lista[lista.length - 1]
      const fechada = lista.map((f, j) => (j === lista.length - 1 ? { ...f, ate: f.de + 2 } : f))
      return [...fechada, { de: ultima.de + 3, ate: null, valor: ultima.valor }]
    })
  }

  function removerFaixa() {
    setFaixas((lista) => (lista.length > 1 ? lista.slice(0, -1).map((f, j, l) => (j === l.length - 1 ? { ...f, ate: null } : f)) : lista))
  }

  function salvar() {
    iniciar(async () => {
      const resposta = await salvarConfigIndicacoes({
        faixas, validadeIndicacaoDias: Number(validade), indicadoJaCadastrado: jaCadastrado, liberacaoAutomatica: automatica,
      })
      if (resposta.error) toast.error(resposta.error)
      else toast.success(resposta.success ?? 'Regras salvas.')
    })
  }

  function decidir(id: string, decisao: 'aprovar' | 'recusar') {
    iniciar(async () => {
      const resposta = await decidirIndicacao(id, decisao)
      if (resposta.error) toast.error(resposta.error)
      else toast.success(resposta.success ?? 'Feito.')
    })
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Indicações</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600">
          Programa Indique e ganhe da Área do Cliente. A indicação converte quando a pessoa indicada cria a conta pelo link, confirma o e-mail e acessa a Área do Cliente.
        </p>
      </header>

      <section className={`${cartao} space-y-4`} aria-labelledby="regras">
        <h2 id="regras" className="font-semibold">Regras de recompensa</h2>
        <ul className="space-y-3">
          {faixas.map((f, i) => {
            const ultima = i === faixas.length - 1
            return (
              <li key={i} className="grid items-end gap-3 sm:grid-cols-3">
                <Input label="Da indicação nº" type="number" value={f.de} readOnly disabled placeholder="Ex.: 1" />
                {ultima ? (
                  <Input label="Até a indicação nº" value="sem limite" readOnly disabled placeholder="Sem limite" />
                ) : (
                  <Input
                    label="Até a indicação nº"
                    type="number"
                    min={f.de}
                    value={f.ate ?? ''}
                    disabled={!podeEditarRegras || pendente}
                    placeholder="Ex.: 2"
                    onChange={(e) => alterarFaixa(i, { ate: Number(e.target.value) })}
                  />
                )}
                <Input
                  label="Recompensa (R$)"
                  type="number"
                  min={0}
                  step="0.01"
                  value={f.valor}
                  disabled={!podeEditarRegras || pendente}
                  placeholder="Ex.: 150"
                  onChange={(e) => alterarFaixa(i, { valor: Number(e.target.value) })}
                />
              </li>
            )
          })}
        </ul>
        {podeEditarRegras && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" leftIcon={<IconPlus size={15} />} onClick={adicionarFaixa} disabled={pendente || faixas.length >= 10}>Adicionar faixa</Button>
            <Button type="button" variant="secondary" size="sm" leftIcon={<IconTrash size={15} />} onClick={removerFaixa} disabled={pendente || faixas.length <= 1}>Remover última faixa</Button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Prazo da indicação (dias)"
            type="number"
            min={0}
            value={validade}
            disabled={!podeEditarRegras || pendente}
            placeholder="Ex.: 90 (0 = sem prazo)"
            hint="Tempo que o indicado tem, depois do cadastro, para acessar a Área do Cliente."
            onChange={(e) => setValidade(e.target.value)}
          />
          <Select
            label="Quando o indicado já tem cadastro"
            value={jaCadastrado}
            disabled={!podeEditarRegras || pendente}
            onChange={(e) => setJaCadastrado(e.target.value as ConfigIndicacoes['indicadoJaCadastrado'])}
          >
            <option value="revisao">Enviar para revisão da equipe</option>
            <option value="recusar">Recusar automaticamente</option>
          </Select>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input className="mt-1" type="checkbox" checked={automatica} disabled={!podeEditarRegras || pendente} onChange={(e) => setAutomatica(e.target.checked)} />
          <span>Liberar a recompensa para pagamento assim que a indicação converter (desmarcado: a equipe libera manualmente)</span>
        </label>
        {podeEditarRegras ? <Button type="button" loading={pendente} onClick={salvar}>Salvar regras</Button> : (
          <p className="text-sm text-neutral-500">Somente administradores alteram as regras.</p>
        )}
      </section>

      <section className={cartao} aria-labelledby="lista">
        <h2 id="lista" className="font-semibold">Indicações recebidas</h2>
        {indicacoes.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Nenhuma indicação ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100 text-sm">
            {indicacoes.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{i.indicadoNome} <span className="font-normal text-neutral-500">indicado por {i.indicadorNome}</span></p>
                  <p className="text-xs text-neutral-500">{data.format(new Date(i.criadoEm))} · {ROTULO_STATUS_INDICACAO[i.status]}{i.motivoRevisao && ` · ${i.motivoRevisao}`}</p>
                </div>
                {i.status === 'em_revisao' && (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={pendente} onClick={() => decidir(i.id, 'aprovar')}>Aprovar e converter</Button>
                    <Button type="button" size="sm" variant="secondary" disabled={pendente} onClick={() => decidir(i.id, 'recusar')}>Recusar</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
