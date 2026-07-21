import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#111',
    lineHeight: 1.5,
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#111',
    paddingBottom: 12,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  brand: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 1,
  },
  brandSub: {
    fontSize: 9,
    color: '#555',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  badgeBox: {
    backgroundColor: '#111',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 9,
    textAlign: 'center',
    color: '#555',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 3,
  },
  table: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 3,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableRowLast: {
    flexDirection: 'row',
  },
  tableCellLabel: {
    width: '38%',
    padding: 7,
    fontWeight: 700,
    backgroundColor: '#f7f7f7',
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    fontSize: 10,
  },
  tableCellValue: {
    flex: 1,
    padding: 7,
    fontSize: 10,
  },
  mensagemBox: {
    marginTop: 6,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 3,
    padding: 10,
    fontSize: 10,
    lineHeight: 1.6,
    color: '#333',
  },
  statusBadgeWrap: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 4,
  },
  statusBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#6ee7b7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 700,
    color: '#065f46',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: '#888',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 6,
  },
})

function formatCurrency(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(iso: string | undefined) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function DataRow({
  label,
  value,
  last,
}: {
  label: string
  value: string | number | null | undefined
  last?: boolean
}) {
  return (
    <View style={last ? styles.tableRowLast : styles.tableRow}>
      <Text style={styles.tableCellLabel}>{label}</Text>
      <Text style={styles.tableCellValue}>{value ?? '—'}</Text>
    </View>
  )
}

export interface PropostaDocumentProps {
  id: string
  clienteNome: string
  clienteEmail: string
  veiculoMarca: string
  veiculoModelo: string
  veiculoPrecoSugerido: number | null
  valorOfertado: number | null
  mensagem: string
  criadoEm: string
  aceitoEm: string
}

export default function PropostaDocument({
  id,
  clienteNome,
  clienteEmail,
  veiculoMarca,
  veiculoModelo,
  veiculoPrecoSugerido,
  valorOfertado,
  mensagem,
  criadoEm,
  aceitoEm,
}: PropostaDocumentProps) {
  const diferenca =
    valorOfertado != null && veiculoPrecoSugerido != null
      ? valorOfertado - veiculoPrecoSugerido
      : null

  return (
    <Document
      title={`Proposta Aceita - ${clienteNome}`}
      author="Liberty Car"
      subject="Resumo de Proposta de Compra Aceita"
    >
      <Page size="A4" style={styles.page} wrap>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>LIBERTY CAR</Text>
            <Text style={styles.brandSub}>Seminovos & Novos • CNPJ 00.000.000/0001-00</Text>
          </View>
          <View style={styles.badgeBox}>
            <Text style={styles.badgeText}>Proposta Aceita</Text>
          </View>
        </View>

        {/* Título */}
        <Text style={styles.title}>Resumo de Proposta de Compra</Text>
        <Text style={styles.subtitle}>
          Documento gerado eletronicamente pelo sistema Liberty Car
        </Text>

        {/* Status */}
        <View style={styles.statusBadgeWrap}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>✓ Proposta Aceita</Text>
          </View>
        </View>

        {/* Dados do Cliente */}
        <Text style={styles.sectionTitle}>Dados do Cliente</Text>
        <View style={styles.table}>
          <DataRow label="Nome" value={clienteNome} />
          <DataRow label="E-mail" value={clienteEmail} last />
        </View>

        {/* Dados do Veículo */}
        <Text style={styles.sectionTitle}>Veículo de Interesse</Text>
        <View style={styles.table}>
          <DataRow label="Marca" value={veiculoMarca} />
          <DataRow label="Modelo" value={veiculoModelo} />
          <DataRow label="Preço Sugerido" value={formatCurrency(veiculoPrecoSugerido)} last />
        </View>

        {/* Dados da Proposta */}
        <Text style={styles.sectionTitle}>Dados da Proposta</Text>
        <View style={styles.table}>
          <DataRow label="Valor Ofertado" value={formatCurrency(valorOfertado)} />
          <DataRow
            label="Diferença"
            value={
              diferenca != null
                ? `${diferenca >= 0 ? '+' : ''}${formatCurrency(diferenca)}`
                : '—'
            }
          />
          <DataRow label="Enviada em" value={formatDate(criadoEm)} />
          <DataRow label="Aceita em" value={formatDate(aceitoEm)} last />
        </View>

        {/* Mensagem do Cliente */}
        <Text style={styles.sectionTitle}>Mensagem do Cliente</Text>
        <Text style={styles.mensagemBox}>{mensagem || '—'}</Text>

        {/* Rodapé */}
        <Text style={styles.footer} fixed>
          Liberty Car — Documento gerado eletronicamente • ID da proposta: {id} • Emitido em{' '}
          {formatDate(new Date().toISOString())}
        </Text>
      </Page>
    </Document>
  )
}
