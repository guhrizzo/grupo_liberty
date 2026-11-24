import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { clienteAutenticado } from '@/utils/portal/acesso'
import { carregarConfigIndicacoes, codigoDoIndicador, listarDoIndicador } from '@/utils/indicacoes/servidor'
import { ROTULO_STATUS_INDICACAO, ROTULO_STATUS_RECOMPENSA } from '@/utils/indicacoes/modelo'
import CopiarLink from './CopiarLink'

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' })
const formatarData = (valor: string | null) => (valor ? data.format(new Date(valor)) : '—')

export default async function IndicacoesClientePage() {
  const cliente = await clienteAutenticado()
  if (!cliente?.cadastro.modulos.includes('indicacoes')) notFound()

  const [codigo, config, { indicacoes, recompensas }, cabecalhos] = await Promise.all([
    codigoDoIndicador(cliente.documento),
    carregarConfigIndicacoes(),
    listarDoIndicador(cliente.documento),
    headers(),
  ])
  const host = cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host') ?? 'localhost:3000'
  const protocolo = cabecalhos.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const link = `${protocolo}://${host}/area-do-cliente/entrar?ref=${codigo}`

  const total = (status: string) => recompensas.filter((r) => r.status === status).reduce((soma, r) => soma + r.valor, 0)
  const caixa = 'rounded-2xl border border-[var(--portal-divisor)] bg-[var(--portal-campo)] p-5 sm:p-6'

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-5 py-9 sm:px-8 sm:py-14">
      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Indique e ganhe</h1>
        <p className="mt-2 text-[var(--portal-secundario)]">
          Indique pessoas para a Liberty e receba uma recompensa quando a indicação for convertida, ou seja, quando a pessoa indicada criar a conta e acessar a Área do Cliente.
        </p>
      </header>

      <section className={`${caixa} space-y-4`} aria-label="Seu link de indicação">
        <CopiarLink link={link} mensagem="Conheça a Liberty Car! Crie sua conta pelo meu link de indicação:" />
        <p className="text-sm text-[var(--portal-secundario)]">
          Você não pode usar o próprio link. A recompensa é liberada pela equipe Liberty depois da conversão.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo das recompensas">
        {[
          ['Aguardando liberação', total('pendente')],
          ['Liberado para pagamento', total('liberada')],
          ['Já recebido', total('paga')],
        ].map(([rotulo, valor]) => (
          <div key={String(rotulo)} className={caixa}>
            <p className="text-sm text-[var(--portal-secundario)]">{rotulo}</p>
            <p className="mt-1 text-2xl font-bold">{moeda.format(Number(valor))}</p>
          </div>
        ))}
      </section>

      <section className={caixa} aria-labelledby="tabela-recompensas">
        <h2 id="tabela-recompensas" className="font-semibold">Quanto você ganha por indicação convertida</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {config.faixas.map((f) => (
            <li key={f.de} className="flex justify-between gap-4">
              <span>{f.ate === null ? `A partir da ${f.de}ª` : f.de === f.ate ? `${f.de}ª` : `${f.de}ª a ${f.ate}ª`} indicação</span>
              <strong>{moeda.format(f.valor)}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className={caixa} aria-labelledby="lista-indicacoes">
        <h2 id="lista-indicacoes" className="font-semibold">Suas indicações</h2>
        {indicacoes.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--portal-secundario)]">Você ainda não tem indicações. Compartilhe seu link para começar.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--portal-divisor)] text-sm">
            {indicacoes.map((i) => (
              <li key={i.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{i.nome} <span className="text-[var(--portal-secundario)]">· indicado em {formatarData(i.criadoEm)}</span></span>
                <span className="font-medium">{ROTULO_STATUS_INDICACAO[i.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recompensas.length > 0 && (
        <section className={caixa} aria-labelledby="lista-recompensas">
          <h2 id="lista-recompensas" className="font-semibold">Suas recompensas</h2>
          <ul className="mt-3 divide-y divide-[var(--portal-divisor)] text-sm">
            {recompensas.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{r.ordem}ª indicação convertida · {moeda.format(r.valor)}</span>
                <span className="font-medium">
                  {ROTULO_STATUS_RECOMPENSA[r.status]}
                  {r.status === 'paga' && ` em ${formatarData(r.pagaEm)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
