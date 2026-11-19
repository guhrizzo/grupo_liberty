import fs from 'node:fs'
import path from 'node:path'
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { BATIDAS, TIPO_DIA_LABEL, type RegistroPonto, type TipoDiaEspecial } from '@/constants/ponto'
import { diasDoMes, formatarMinutos as formatarMin, horaSP, minutosTrabalhados, resumoMes, saldoDia } from '@/utils/ponto/calculo'

// Folha de ponto de um funcionário no mês (PDF). Mesmo visual dos recibos: logo no
// cabeçalho, Helvetica, painel de resumo e a logo como marca d'água no fundo.

// Logo da Liberty Car (app/public/): usada no cabeçalho e como marca d'água.
const LOGO = (() => {
  for (const base of [path.join(process.cwd(), 'app', 'public'), path.join(process.cwd(), 'public')]) {
    try {
      const f = path.join(base, 'logo-liberty-car-blue.png')
      if (fs.existsSync(f)) return `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`
    } catch {
      // sem o arquivo, a folha sai sem logo nem marca d'água.
    }
  }
  return ''
})()

const MARCA_LARGURA = 380
const MARCA_ALTURA = (MARCA_LARGURA * 448) / 1014 // proporção da logo (1014×448)

const C = {
  ink: '#09090b',
  muted: '#71717a',
  faint: '#a1a1aa',
  line: '#e4e4e7',
  head: '#f4f4f5',
  // Fundos translúcidos: a marca d'água aparece por baixo da tabela.
  zebra: 'rgba(244, 244, 245, 0.6)',
  fimSemana: 'rgba(226, 232, 240, 0.6)',
  green: '#047857',
  red: '#be123c',
  amber: '#b45309',
  azul: '#1d4ed8',
  especial: 'rgba(219, 234, 254, 0.7)',
}

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 40, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 9, color: C.ink, lineHeight: 1.35 },
  marcaDagua: { position: 'absolute', left: (595 - MARCA_LARGURA) / 2, top: (842 - MARCA_ALTURA) / 2, width: MARCA_LARGURA, height: MARCA_ALTURA, opacity: 0.07 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  logo: { width: 105 },
  headerRight: { alignItems: 'flex-end' },
  titulo: { fontFamily: 'Helvetica-Bold', fontSize: 16, letterSpacing: 1, textTransform: 'uppercase' },
  meta: { fontSize: 8.5, color: C.muted, marginTop: 6 },

  quem: { marginBottom: 9 },
  nome: { fontFamily: 'Helvetica-Bold', fontSize: 13 },
  sub: { fontSize: 9, color: C.muted, marginTop: 1 },

  resumo: { flexDirection: 'row', marginBottom: 10 },
  caixa: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 9, marginRight: 6 },
  caixaUltima: { marginRight: 0 },
  caixaRotulo: { fontFamily: 'Helvetica-Bold', fontSize: 6.5, letterSpacing: 0.8, textTransform: 'uppercase', color: C.faint },
  caixaValor: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginTop: 2 },

  tabela: { borderWidth: 1, borderColor: C.line, borderRadius: 6, overflow: 'hidden' },
  linha: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: C.line },
  linhaUltima: { borderBottomWidth: 0 },
  cab: { backgroundColor: C.head, borderBottomWidth: 1, borderBottomColor: C.faint, paddingVertical: 5 },
  cabTexto: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: C.ink },
  cDia: { width: '25%', paddingLeft: 8 },
  cHora: { width: '13%', textAlign: 'center' },
  cTotal: { width: '12%', textAlign: 'center' },
  cSaldo: { width: '11%', textAlign: 'center', paddingRight: 4 },
  cEspecial: { width: '52%', textAlign: 'center', fontFamily: 'Helvetica-Bold', color: C.azul },
  vazio: { color: C.faint },

  legenda: { marginTop: 8, fontSize: 7.5, color: C.muted },
  legendaSeguinte: { marginTop: 2, fontSize: 7.5, color: C.muted },

  assinaturas: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 26 },
  assinatura: { width: '44%', borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 3, alignItems: 'center' },
  assinaturaTexto: { fontSize: 8, color: C.muted },

  rodape: { position: 'absolute', left: 40, right: 40, bottom: 18, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 5, fontSize: 7.5, color: C.faint, textAlign: 'center' },
})

/** Igual a formatarMinutos, mas com hífen no lugar do "−" (U+2212), que a Helvetica do PDF não desenha. */
const formatarMinutos = (min: number, comSinal = false) => formatarMin(min, comSinal).replace('−', '-')

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const diaSemana = (data: string) => {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(a, m - 1, d).getDay()
}
const rotulo = (data: string) => {
  const [, m, d] = data.split('-').map(Number)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} ${DIAS[diaSemana(data)]}`
}
const mesExtenso = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  const t = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const emitidoEm = () =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())

/** Corta com reticências para o nome do feriado caber ao lado da data. */
const abreviar = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t)

const tomSaldo = (min: number) => (min > 0 ? C.green : min < 0 ? C.red : C.ink)

export default function FolhaPontoDocument({
  nome,
  mes,
  registros,
  jornadaMin,
  diasEspeciais = [],
}: {
  nome: string
  mes: string
  registros: RegistroPonto[]
  jornadaMin: number
  /** Feriados e trocas de feriado do funcionário no mês (jornada do dia zerada). */
  diasEspeciais?: { data: string; tipo: TipoDiaEspecial; nome?: string }[]
}) {
  const porData = new Map(registros.map((r) => [r.data, r]))
  const r = resumoMes(registros)
  // Domingos não entram na folha, a menos que tenham batida (aí a linha aparece, para não esconder dado).
  const especialPorData = new Map(diasEspeciais.map((d) => [d.data, d]))
  const dias = diasDoMes(mes).filter((d) => diaSemana(d) !== 0 || porData.has(d) || especialPorData.has(d))
  const domingosOcultos = diasDoMes(mes).some((d) => diaSemana(d) === 0 && !porData.has(d) && !especialPorData.has(d))
  const temEspecial = dias.some((d) => especialPorData.has(d))
  const temManual = registros.some((reg) => BATIDAS.some((b) => reg.batidas[b] && reg.origens?.[b] === 'manual'))

  const caixas: { rotulo: string; valor: string; cor?: string }[] = [
    { rotulo: 'Total no mês', valor: formatarMinutos(r.trabalhadoMin) },
    { rotulo: 'Saldo do mês', valor: formatarMinutos(r.saldoMin, true), cor: tomSaldo(r.saldoMin) },
    { rotulo: 'Dias completos', valor: String(r.diasCompletos) },
    { rotulo: 'Dias incompletos', valor: String(r.diasIncompletos), cor: r.diasIncompletos > 0 ? C.amber : undefined },
    { rotulo: 'Jornada por dia', valor: formatarMinutos(jornadaMin) },
  ]

  return (
    <Document title={`Folha de ponto - ${nome} - ${mes}`} author="Liberty Car" subject={`Folha de ponto de ${mesExtenso(mes)}`}>
      <Page size="A4" style={styles.page}>
        {/* Marca d'água: logo centralizada no fundo de todas as páginas. */}
        {LOGO ? <Image src={LOGO} style={styles.marcaDagua} fixed /> : null}

        <View style={styles.header}>
          {LOGO ? <Image src={LOGO} style={styles.logo} /> : <Text style={styles.titulo}>Liberty Car</Text>}
          <View style={styles.headerRight}>
            <Text style={styles.titulo}>Folha de ponto</Text>
            <Text style={styles.meta}>Emitida em: {emitidoEm()}</Text>
          </View>
        </View>

        <View style={styles.quem}>
          <Text style={styles.nome}>{nome}</Text>
          <Text style={styles.sub}>{mesExtenso(mes)}</Text>
        </View>

        <View style={styles.resumo}>
          {caixas.map((c, i) => (
            <View key={c.rotulo} style={i === caixas.length - 1 ? [styles.caixa, styles.caixaUltima] : styles.caixa}>
              <Text style={styles.caixaRotulo}>{c.rotulo}</Text>
              <Text style={[styles.caixaValor, c.cor ? { color: c.cor } : {}]}>{c.valor}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tabela}>
          <View style={[styles.linha, styles.cab]} fixed>
            <Text style={[styles.cDia, styles.cabTexto]}>Dia</Text>
            <Text style={[styles.cHora, styles.cabTexto]}>Entrada</Text>
            <Text style={[styles.cHora, styles.cabTexto]}>Saída almoço</Text>
            <Text style={[styles.cHora, styles.cabTexto]}>Volta almoço</Text>
            <Text style={[styles.cHora, styles.cabTexto]}>Saída</Text>
            <Text style={[styles.cTotal, styles.cabTexto]}>Total</Text>
            <Text style={[styles.cSaldo, styles.cabTexto]}>Saldo</Text>
          </View>

          {dias.map((data, idx) => {
            const reg = porData.get(data)
            const domingo = diaSemana(data) === 0
            const trab = reg ? minutosTrabalhados(reg.batidas) : null
            const saldo = reg ? saldoDia(reg.batidas, reg.jornadaMin) : null
            const temBatida = !!reg && BATIDAS.some((b) => reg.batidas[b])
            const incompleto = temBatida && trab === null
            const especial = especialPorData.get(data)
            const tipo = especial?.tipo
            const fundo = tipo ? C.especial : domingo ? C.fimSemana : idx % 2 === 1 ? C.zebra : undefined
            return (
              <View
                key={data}
                style={idx === dias.length - 1 ? [styles.linha, styles.linhaUltima, { backgroundColor: fundo }] : [styles.linha, { backgroundColor: fundo }]}
                wrap={false}
              >
                <Text style={[styles.cDia, { color: domingo && !tipo ? C.muted : C.ink }]}>
                  {rotulo(data)}
                  {tipo && temBatida ? <Text style={{ fontSize: 6.5, color: C.azul, fontFamily: 'Helvetica-Bold' }}>{`  ${abreviar(especial?.nome || (tipo === 'feriado' ? 'Feriado' : 'Troca de feriado'), 19)}`}</Text> : null}
                </Text>
                {tipo && !temBatida ? (
                  // Feriado / troca de feriado sem batida: o rótulo ocupa as colunas de horário.
                  <Text style={styles.cEspecial}>{especial?.nome ? `${TIPO_DIA_LABEL[tipo]} · ${especial.nome}` : TIPO_DIA_LABEL[tipo]}</Text>
                ) : (
                  BATIDAS.map((b) => {
                    const iso = reg?.batidas[b]
                    return (
                      <Text key={b} style={[styles.cHora, iso ? {} : styles.vazio]}>
                        {iso ? `${horaSP(iso)}${reg?.origens?.[b] === 'manual' ? '*' : ''}` : '—'}
                      </Text>
                    )
                  })
                )}
                <Text style={[styles.cTotal, trab !== null ? { fontFamily: 'Helvetica-Bold' } : incompleto ? { color: C.amber, fontFamily: 'Helvetica-Bold' } : styles.vazio]}>
                  {trab !== null ? formatarMinutos(trab) : incompleto ? 'incompleto' : '—'}
                </Text>
                <Text style={[styles.cSaldo, saldo !== null ? { color: tomSaldo(saldo), fontFamily: 'Helvetica-Bold' } : styles.vazio]}>
                  {saldo !== null ? formatarMinutos(saldo, true) : '—'}
                </Text>
              </View>
            )
          })}
        </View>

        {temManual ? <Text style={styles.legenda}>* Horário lançado ou corrigido manualmente pelo administrador.</Text> : null}
        {temEspecial ? (
          <Text style={temManual ? styles.legendaSeguinte : styles.legenda}>
            Feriado e troca de feriado: jornada do dia zerada (sem saldo negativo; horas trabalhadas contam como saldo positivo).
          </Text>
        ) : null}
        {domingosOcultos ? <Text style={temManual || temEspecial ? styles.legendaSeguinte : styles.legenda}>Domingos sem registro não são exibidos.</Text> : null}

        <View style={styles.assinaturas} wrap={false}>
          <View style={styles.assinatura}>
            <Text style={styles.assinaturaTexto}>{nome}</Text>
            <Text style={styles.assinaturaTexto}>Funcionário</Text>
          </View>
          <View style={styles.assinatura}>
            <Text style={styles.assinaturaTexto}>Liberty Car</Text>
            <Text style={styles.assinaturaTexto}>Responsável</Text>
          </View>
        </View>

        <Text
          style={styles.rodape}
          fixed
          render={({ pageNumber, totalPages }) => `Liberty Car · grupolibertycar.com.br · Jaú/SP · Página ${pageNumber} de ${totalPages}`}
        />
      </Page>
    </Document>
  )
}
