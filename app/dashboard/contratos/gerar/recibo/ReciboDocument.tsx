import fs from 'node:fs'
import path from 'node:path'
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { montarRecibo } from './montar'
import type { ReciboInput } from './types'

// Recibo de pagamento de veículo (PDF). Mesmo visual do recibo de parcela
// (cobrancas/pdf/ReciboPagamentoDocument): logo, Helvetica e painel de valores.

const LOGO = (() => {
  for (const base of [path.join(process.cwd(), 'app', 'public'), path.join(process.cwd(), 'public')]) {
    try {
      const f = path.join(base, 'logo-liberty-car-blue.png')
      if (fs.existsSync(f)) return `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`
    } catch {
      // sem o arquivo, o recibo sai só com o título.
    }
  }
  return ''
})()

const C = {
  ink: '#09090b',
  muted: '#71717a',
  faint: '#a1a1aa',
  line: '#e4e4e7',
  panel: '#fafafa',
  amber: '#b45309',
  amberBg: '#fffbeb',
  green: '#047857',
  greenBg: '#ecfdf5',
}

const s = StyleSheet.create({
  page: { paddingVertical: 44, paddingHorizontal: 48, fontFamily: 'Helvetica', fontSize: 10, color: C.ink, lineHeight: 1.5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  logo: { width: 120 },
  headerRight: { alignItems: 'flex-end' },
  titulo: { fontFamily: 'Helvetica-Bold', fontSize: 16, letterSpacing: 1, textTransform: 'uppercase' },
  meta: { fontSize: 9, color: C.muted, marginTop: 4 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingVertical: 5, paddingHorizontal: 14, marginBottom: 18 },
  badgeText: { fontFamily: 'Helvetica-Bold', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' },
  label: { fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: C.faint, marginBottom: 3 },
  bloco: { marginBottom: 14 },
  valor: { fontSize: 11 },
  apoio: { color: C.muted },
  painel: { borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: C.panel, padding: 16, marginBottom: 16 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  linhaFim: { flexDirection: 'row', justifyContent: 'space-between' },
  rotulo: { color: C.muted },
  rotuloTexto: { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold', marginLeft: 16 },
  negrito: { fontFamily: 'Helvetica-Bold' },
  grande: { fontFamily: 'Helvetica-Bold', fontSize: 13 },
  divisor: { borderTopWidth: 1, borderTopColor: C.line, marginVertical: 9 },
  declaracao: { fontSize: 10.5, textAlign: 'justify', marginBottom: 6 },
  assinatura: { marginTop: 40, alignItems: 'center' },
  assinaturaLinha: { width: 260, borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 4, alignItems: 'center' },
  rodape: { marginTop: 'auto', paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line, fontSize: 8, color: C.faint, textAlign: 'center' },
})

export default function ReciboDocument({ input, agora }: { input: ReciboInput; agora: Date }) {
  const m = montarRecibo(input, agora)
  const cor = m.badge?.tom === 'integral' ? C.green : m.badge ? C.amber : C.ink

  return (
    <Document title={`Recibo de pagamento — ${input.pagador.nome}`} author="Liberty Car" subject={`Veículo ${input.veiculo.placa}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {LOGO ? <Image src={LOGO} style={s.logo} /> : <Text style={s.titulo}>Liberty Car</Text>}
          <View style={s.headerRight}>
            <Text style={s.titulo}>Recibo de pagamento</Text>
            <Text style={s.meta}>Veículo: {m.veiculo.placa}</Text>
            <Text style={s.meta}>Emitido em: {m.emitidoEm}</Text>
          </View>
        </View>

        {m.badge && (
          <View style={[s.badge, { borderColor: cor, backgroundColor: m.badge.tom === 'integral' ? C.greenBg : C.amberBg }]}>
            <Text style={[s.badgeText, { color: cor }]}>{m.badge.texto}</Text>
          </View>
        )}

        <View style={s.bloco}>
          <Text style={s.label}>Pagador</Text>
          <Text style={s.valor}>{m.pagador.nome}</Text>
          <Text style={s.apoio}>{m.pagador.documento}</Text>
          {m.pagador.endereco ? <Text style={s.apoio}>{m.pagador.endereco}</Text> : null}
          {m.pagador.contato ? <Text style={s.apoio}>{m.pagador.contato}</Text> : null}
        </View>

        <View style={s.bloco}>
          <Text style={s.label}>Recebedor</Text>
          <Text style={s.valor}>{m.recebedor.nome}</Text>
          {m.recebedor.documento ? <Text style={s.apoio}>{m.recebedor.documento}</Text> : null}
          {m.recebedor.endereco ? <Text style={s.apoio}>{m.recebedor.endereco}</Text> : null}
        </View>

        <View style={s.bloco}>
          <Text style={s.label}>Veículo</Text>
          <Text style={s.valor}>{m.veiculo.linha}</Text>
          {m.veiculo.docs ? <Text style={s.apoio}>{m.veiculo.docs}</Text> : null}
        </View>

        <View style={s.painel}>
          <View style={s.linha}>
            <Text style={s.rotulo}>Referente a</Text>
            <Text style={s.rotuloTexto}>{m.referencia}</Text>
          </View>
          <View style={s.linha}>
            <Text style={s.rotulo}>Data do pagamento</Text>
            <Text style={s.negrito}>{m.data}</Text>
          </View>
          {m.forma ? (
            <View style={s.linha}>
              <Text style={s.rotulo}>Forma de pagamento</Text>
              <Text style={s.negrito}>{m.forma}</Text>
            </View>
          ) : null}
          <View style={s.divisor} />
          <View style={m.total === null ? s.linhaFim : s.linha}>
            <Text style={s.rotulo}>Valor recebido</Text>
            <Text style={[s.grande, { color: cor }]}>{m.valorRecebido}</Text>
          </View>
          {m.total !== null && m.saldo !== null ? (
            <>
              <View style={s.linha}>
                <Text style={s.rotulo}>Valor total do contrato</Text>
                <Text style={s.negrito}>{m.total}</Text>
              </View>
              <View style={s.linhaFim}>
                <Text style={s.rotulo}>Saldo restante</Text>
                <Text style={s.negrito}>{m.saldo}</Text>
              </View>
            </>
          ) : null}
        </View>

        <Text style={s.declaracao}>{m.declaracao}</Text>

        <View style={s.assinatura}>
          <View style={s.assinaturaLinha}>
            <Text style={s.negrito}>{m.assinatura.nome}</Text>
            <Text style={s.apoio}>{m.assinatura.detalhe}</Text>
          </View>
        </View>

        <Text style={s.rodape}>Liberty Car · grupolibertycar.com.br · Jaú/SP</Text>
      </Page>
    </Document>
  )
}
