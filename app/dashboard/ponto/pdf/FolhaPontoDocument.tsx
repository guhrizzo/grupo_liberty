import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { BATIDAS, type RegistroPonto } from '@/constants/ponto'
import { diasDoMes, formatarMinutos, horaSP, minutosTrabalhados, resumoMes, saldoDia } from '@/utils/ponto/calculo'

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 9, color: '#09090b' },
  titulo: { fontFamily: 'Helvetica-Bold', fontSize: 15 },
  sub: { fontSize: 10, color: '#71717a', marginTop: 2, marginBottom: 14 },
  linha: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e4e4e7', paddingVertical: 3 },
  cab: { fontFamily: 'Helvetica-Bold', backgroundColor: '#fafafa', borderBottomColor: '#a1a1aa' },
  cDia: { width: '16%' },
  cHora: { width: '15%' },
  cTotal: { width: '12%' },
  cSaldo: { width: '12%' },
  rodape: { marginTop: 14, fontSize: 10 },
})

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const rotulo = (data: string) => {
  const [a, m, d] = data.split('-').map(Number)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} ${DIAS[new Date(a, m - 1, d).getDay()]}`
}
const mesExtenso = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function FolhaPontoDocument({
  nome,
  mes,
  registros,
  jornadaMin,
}: {
  nome: string
  mes: string
  registros: RegistroPonto[]
  jornadaMin: number
}) {
  const porData = new Map(registros.map((r) => [r.data, r]))
  const r = resumoMes(registros)
  return (
    <Document title={`Folha de ponto - ${nome} - ${mes}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.titulo}>Folha de ponto</Text>
        <Text style={styles.sub}>
          {nome} · {mesExtenso(mes)} · jornada {formatarMinutos(jornadaMin)}/dia
        </Text>

        <View style={[styles.linha, styles.cab]}>
          <Text style={styles.cDia}>Dia</Text>
          <Text style={styles.cHora}>Entrada</Text>
          <Text style={styles.cHora}>Saída almoço</Text>
          <Text style={styles.cHora}>Volta almoço</Text>
          <Text style={styles.cHora}>Saída</Text>
          <Text style={styles.cTotal}>Total</Text>
          <Text style={styles.cSaldo}>Saldo</Text>
        </View>
        {diasDoMes(mes).map((data) => {
          const reg = porData.get(data)
          const trab = reg ? minutosTrabalhados(reg.batidas) : null
          const saldo = reg ? saldoDia(reg.batidas, reg.jornadaMin) : null
          return (
            <View key={data} style={styles.linha} wrap={false}>
              <Text style={styles.cDia}>{rotulo(data)}</Text>
              {BATIDAS.map((b) => (
                <Text key={b} style={styles.cHora}>
                  {reg?.batidas[b] ? horaSP(reg.batidas[b]!) : '—'}
                </Text>
              ))}
              <Text style={styles.cTotal}>
                {trab !== null ? formatarMinutos(trab) : reg && BATIDAS.some((b) => reg.batidas[b]) ? 'incompleto' : '—'}
              </Text>
              <Text style={styles.cSaldo}>{saldo !== null ? formatarMinutos(saldo, true) : '—'}</Text>
            </View>
          )
        })}

        <Text style={styles.rodape}>
          Total no mês: {formatarMinutos(r.trabalhadoMin)} · Saldo: {formatarMinutos(r.saldoMin, true)} · Dias
          completos: {r.diasCompletos}
          {r.diasIncompletos ? ` · Dias incompletos: ${r.diasIncompletos}` : ''}
        </Text>
      </Page>
    </Document>
  )
}
