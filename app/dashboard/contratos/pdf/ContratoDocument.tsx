import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { Contrato } from '../types'

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
    marginBottom: 18,
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
  title: {
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 18,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paragraph: {
    marginBottom: 8,
    textAlign: 'justify',
  },
  table: {
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#111',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  tableRowLast: {
    flexDirection: 'row',
  },
  tableCellLabel: {
    width: '35%',
    padding: 6,
    fontWeight: 700,
    backgroundColor: '#f3f3f3',
    borderRightWidth: 1,
    borderRightColor: '#111',
  },
  tableCellValue: {
    flex: 1,
    padding: 6,
  },
  signatureBlock: {
    marginTop: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
  },
  signatureColumn: {
    flex: 1,
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#111',
    marginTop: 36,
    paddingTop: 4,
    textAlign: 'center',
    fontSize: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 6,
  },
})

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(iso: string) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('pt-BR')
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
      <Text style={styles.tableCellValue}>{value || '—'}</Text>
    </View>
  )
}

export default function ContratoDocument({ contrato }: { contrato: Contrato }) {
  const localLabel =
    contrato.veiculoLocalizacao === 'bauru'
      ? 'Loja Bauru/SP — R. das Palmeiras, 567'
      : 'Loja Jaú/SP — Av. Principal, 1234'

  return (
    <Document
      title={`Contrato - ${contrato.clienteNome}`}
      author="Liberty Car"
      subject="Contrato de Compra e Venda de Veículo"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.brand}>LIBERTY CAR</Text>
          <Text style={styles.brandSub}>Seminovos & Novos • CNPJ 00.000.000/0001-00</Text>
        </View>

        <Text style={styles.title}>
          Contrato de Compra e Venda de Veículo Automotor
        </Text>

        <Text style={styles.paragraph}>
          Pelo presente instrumento particular de contrato de compra e venda, de um
          lado <Text style={{ fontWeight: 700 }}>LIBERTY CAR</Text>, doravante
          denominada simplesmente <Text style={{ fontWeight: 700 }}>VENDEDORA</Text>,
          com sede em {localLabel}, e de outro lado{' '}
          <Text style={{ fontWeight: 700 }}>{contrato.clienteNome}</Text>, portador(a)
          do CPF/CNPJ nº <Text style={{ fontWeight: 700 }}>{contrato.clienteCpfCnpj}</Text>,
          residente e domiciliado(a) em {contrato.clienteEndereco}, doravante
          denominado(a) simplesmente <Text style={{ fontWeight: 700 }}>COMPRADOR(A)</Text>,
          têm entre si justo e contratado o seguinte:
        </Text>

        <Text style={styles.sectionTitle}>1. Do Objeto</Text>
        <Text style={styles.paragraph}>
          A VENDEDORA vende ao(à) COMPRADOR(A), que aceita e adquire, o veículo
          automotor abaixo descrito, livre e desimpedido de qualquer ônus,
          penhor, hipoteca, dívida ou restrição:
        </Text>

        <View style={styles.table}>
          <DataRow label="Marca" value={contrato.veiculoMarca} />
          <DataRow label="Modelo" value={contrato.veiculoModelo} />
          <DataRow label="Ano" value={contrato.veiculoAno} />
          <DataRow label="Placa" value={contrato.veiculoPlaca} />
          <DataRow label="Chassi" value={contrato.veiculoChassi} />
          <DataRow label="Cor" value={contrato.veiculoCor} />
          <DataRow
            label="Quilometragem"
            value={
              contrato.veiculoQuilometragem != null
                ? `${contrato.veiculoQuilometragem.toLocaleString('pt-BR')} km`
                : '—'
            }
            last
          />
        </View>

        <Text style={styles.sectionTitle}>2. Do Preço e da Forma de Pagamento</Text>
        <Text style={styles.paragraph}>
          Pela venda do veículo descrito na cláusula anterior, o(a) COMPRADOR(A)
          pagará à VENDEDORA o valor total de{' '}
          <Text style={{ fontWeight: 700 }}>{formatCurrency(contrato.valor)}</Text>,
          mediante a seguinte forma de pagamento:{' '}
          <Text style={{ fontWeight: 700 }}>{contrato.formaPagamento}</Text>.
        </Text>

        <Text style={styles.sectionTitle}>3. Da Transferência e Entrega</Text>
        <Text style={styles.paragraph}>
          O veículo será entregue ao(à) COMPRADOR(A) no ato da assinatura do
          presente contrato, livre de qualquer pendência. A VENDEDORA compromete-se
          a entregar toda a documentação necessária (CRV/CRLV, nota fiscal e
          manuais) para a transferência de propriedade junto ao DETRAN, que deverá
          ser providenciada pelo(a) COMPRADOR(A) no prazo de até 30 (trinta) dias
          a contar da data de assinatura deste instrumento.
        </Text>

        <Text style={styles.sectionTitle}>4. Das Garantias</Text>
        <Text style={styles.paragraph}>
          A VENDEDORA garante a procedência lícita do veículo e declara que o
          mesmo se encontra em perfeitas condições de uso, sem vícios ocultos que
          impeçam sua utilização normal. Eventuais vícios aparentes devem ser
          reclamados no ato da entrega. O prazo de garantia legal segue o disposto
          no Código de Defesa do Consumidor.
        </Text>

        <Text style={styles.sectionTitle}>5. Das Obrigações do(a) Comprador(a)</Text>
        <Text style={styles.paragraph}>
          O(A) COMPRADOR(A) se obriga a: (a) realizar a transferência do veículo
          junto ao DETRAN no prazo estabelecido; (b) manter o veículo em condições
          adequadas de uso e conservação; (c) arcar com todas as despesas de
          transferência, emplacamento e seguro obrigatório.
        </Text>

        {contrato.clausulasExtras?.trim() && (
          <>
            <Text style={styles.sectionTitle}>6. Cláusulas Adicionais</Text>
            <Text style={styles.paragraph}>
              {contrato.clausulasExtras.trim()}
            </Text>
          </>
        )}

        <Text style={styles.sectionTitle}>7. Do Foro</Text>
        <Text style={styles.paragraph}>
          Fica eleito o foro da comarca de Jaú/SP para dirimir quaisquer questões
          oriundas do presente contrato, com renúncia expressa a qualquer outro,
          por mais privilegiado que seja.
        </Text>

        <Text style={styles.paragraph}>
          E por estarem assim justas e contratadas, as partes assinam o presente
          instrumento em duas vias de igual teor e forma, na presença das
          testemunhas abaixo identificadas.
        </Text>

        <Text style={[styles.paragraph, { textAlign: 'center', marginTop: 12 }]}>
          {localLabel.includes('Bauru') ? 'Bauru' : 'Jaú'}/SP,{' '}
          {formatDate(contrato.dataEmissao)}.
        </Text>

        <View style={styles.signatureBlock}>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureLine}>LIBERTY CAR — VENDEDORA</Text>
          </View>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureLine}>
              {contrato.clienteNome} — COMPRADOR(A)
            </Text>
          </View>
        </View>

        <View style={[styles.signatureBlock, { marginTop: 32 }]}>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureLine}>Testemunha 1</Text>
          </View>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureLine}>Testemunha 2</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          Contrato gerado eletronicamente pelo sistema Liberty Car — ID:{' '}
          {contrato.id} • Emitido em {formatDate(contrato.criadoEm)}
        </Text>
      </Page>
    </Document>
  )
}
