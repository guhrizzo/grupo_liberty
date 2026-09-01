import path from 'node:path'
import fs from 'node:fs'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import type { ComprovantePagamentoData } from '@/utils/email/templates/comprovante-pagamento'

// ─────────────────────────────────────────────────────────────────────────────
// Asset de app/public/ (ou public/) convertido para data URL base64.
// Mesmo esquema de PropostaAutorizacaoDocument.
// ─────────────────────────────────────────────────────────────────────────────
const resolvePublicPath = (fileName: string): string => {
  const candidates = [
    path.join(process.cwd(), 'app', 'public', fileName),
    path.join(process.cwd(), 'public', fileName),
    path.resolve(__dirname, '../../../public', fileName),
    path.resolve(__dirname, '../../../../app/public', fileName),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return ''
}

const toImageDataUrl = (fileName: string, mime = 'image/png'): string => {
  try {
    const filePath = resolvePublicPath(fileName)
    if (filePath) {
      const buf = fs.readFileSync(filePath)
      return `data:${mime};base64,${buf.toString('base64')}`
    }
  } catch (e) {
    console.error(`[ReciboPagamentoDocument] erro ao carregar ${fileName}:`, e)
  }
  return ''
}

const LOGO_LIBERTY = toImageDataUrl('logo-liberty-car-blue.png')

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
// Data "pura" (YYYY-MM-DD): parseia como meia-noite local e formata sem timeZone —
// as duas pontas no mesmo fuso se cancelam, então não desloca em servidor UTC.
const dateBR = new Intl.DateTimeFormat('pt-BR')
// "Emitido em" é um instante real → fixa o fuso do negócio para não mostrar UTC
// quando roda em servidor UTC (Vercel).
const dateTimeBR = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const fmtMoney = (n: number) => brl.format(n)
const fmtDateOnly = (v: string) => dateBR.format(new Date(v + 'T00:00:00'))
const fmtDateTime = (v: string) => dateTimeBR.format(new Date(v))

const COLORS = {
  ink: '#09090b',
  muted: '#71717a',
  faint: '#a1a1aa',
  line: '#e4e4e7',
  panel: '#fafafa',
  green: '#047857',
  amber: '#b45309',
  greenBg: '#ecfdf5',
  amberBg: '#fffbeb',
}

const styles = StyleSheet.create({
  page: {
    paddingVertical: 48,
    paddingHorizontal: 48,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLORS.ink,
    lineHeight: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  logo: { width: 120 },
  headerRight: { alignItems: 'flex-end' },
  docTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerMeta: { fontSize: 9, color: COLORS.muted, marginTop: 4 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  badgeText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.faint,
    marginBottom: 4,
  },
  block: { marginBottom: 16 },
  value: { fontSize: 11 },
  panel: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    backgroundColor: COLORS.panel,
    padding: 18,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rowLast: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: COLORS.muted },
  rowValue: { fontFamily: 'Helvetica-Bold' },
  rowValueBig: { fontFamily: 'Helvetica-Bold', fontSize: 13 },
  divider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    marginVertical: 10,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    fontSize: 8,
    color: COLORS.faint,
    textAlign: 'center',
  },
})

export interface ReciboPagamentoDocumentProps extends ComprovantePagamentoData {
  clienteNome: string
  clienteEmail: string
  /** ISO — momento em que o recibo foi gerado. */
  emitidoEm: string
}

export default function ReciboPagamentoDocument(props: ReciboPagamentoDocumentProps) {
  const {
    clienteNome,
    clienteEmail,
    veiculoResumo,
    numeroParcela,
    numeroParcelas,
    valorParcela,
    valorPagoAgora,
    dataPagamento,
    dataVencimento,
    valorPagoAcumulado,
    valorRestante,
    quitada,
    referencia,
    emitidoEm,
  } = props

  const badgeStyle = quitada
    ? { borderColor: COLORS.green, backgroundColor: COLORS.greenBg }
    : { borderColor: COLORS.amber, backgroundColor: COLORS.amberBg }
  const badgeTextColor = quitada ? COLORS.green : COLORS.amber

  return (
    <Document
      title={`Recibo de pagamento ${referencia}`}
      author="Liberty Car"
      subject={`Parcela ${numeroParcela}/${numeroParcelas}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {LOGO_LIBERTY ? (
            <Image src={LOGO_LIBERTY} style={styles.logo} />
          ) : (
            <Text style={styles.docTitle}>Liberty Car</Text>
          )}
          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>Recibo de pagamento</Text>
            <Text style={styles.headerMeta}>Referência: {referencia}</Text>
            <Text style={styles.headerMeta}>Emitido em: {fmtDateTime(emitidoEm)}</Text>
          </View>
        </View>

        <View style={[styles.badge, badgeStyle]}>
          <Text style={[styles.badgeText, { color: badgeTextColor }]}>
            {quitada ? 'Parcela paga' : 'Pagamento parcial'}
          </Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.sectionLabel}>Cliente</Text>
          <Text style={styles.value}>{clienteNome}</Text>
          {clienteEmail ? <Text style={{ color: COLORS.muted }}>{clienteEmail}</Text> : null}
        </View>

        <View style={styles.block}>
          <Text style={styles.sectionLabel}>Veículo</Text>
          <Text style={styles.value}>{veiculoResumo || '—'}</Text>
        </View>

        <View style={styles.panel}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Parcela</Text>
            <Text style={styles.rowValue}>
              {numeroParcela}/{numeroParcelas}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Valor da parcela</Text>
            <Text style={styles.rowValue}>{fmtMoney(valorParcela)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Vencimento</Text>
            <Text style={styles.rowValue}>{fmtDateOnly(dataVencimento)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Data do pagamento</Text>
            <Text style={styles.rowValue}>{fmtDateOnly(dataPagamento)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Valor pago agora</Text>
            <Text style={[styles.rowValueBig, { color: badgeTextColor }]}>
              {fmtMoney(valorPagoAgora)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Total pago nesta parcela</Text>
            <Text style={styles.rowValue}>{fmtMoney(valorPagoAcumulado)}</Text>
          </View>
          <View style={styles.rowLast}>
            <Text style={styles.rowLabel}>Saldo restante nesta parcela</Text>
            <Text style={styles.rowValue}>{fmtMoney(valorRestante)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Documento gerado automaticamente pelo sistema Liberty Car — não requer
          assinatura. Em caso de dúvida, entre em contato pelo site
          grupolibertycar.com.br.
        </Text>
      </Page>
    </Document>
  )
}
