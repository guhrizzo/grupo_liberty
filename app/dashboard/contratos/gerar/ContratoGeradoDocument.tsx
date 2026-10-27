import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ContratoTexto } from './texto'

const styles = StyleSheet.create({
  page: { padding: 48, paddingBottom: 56, fontSize: 10.5, fontFamily: 'Helvetica', color: '#111', lineHeight: 1.5 },
  header: { borderBottomWidth: 2, borderBottomColor: '#111', paddingBottom: 10, marginBottom: 16 },
  brand: { fontSize: 18, fontWeight: 700, letterSpacing: 1 },
  title: { fontSize: 13, fontWeight: 700, textAlign: 'center', marginBottom: 14, letterSpacing: 0.5 },
  paragraph: { marginBottom: 6, textAlign: 'justify' },
  clausula: { fontSize: 10.5, fontWeight: 700, marginTop: 10, marginBottom: 4 },
  local: { marginTop: 18, textAlign: 'right' },
  signatureBlock: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  signatureColumn: { width: '46%', marginTop: 36 },
  signatureLine: { borderTopWidth: 1, borderTopColor: '#111', paddingTop: 4, textAlign: 'center', fontSize: 9 },
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, fontSize: 8, color: '#666', textAlign: 'center' },
})

export default function ContratoGeradoDocument({ texto, nomeCliente }: { texto: ContratoTexto; nomeCliente: string }) {
  return (
    <Document title={`${texto.titulo} - ${nomeCliente}`} author="Liberty Car" subject={texto.titulo}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.brand}>LIBERTY CAR</Text>
        </View>
        <Text style={styles.title}>{texto.titulo}</Text>
        <Text style={styles.paragraph}>{texto.introducao}</Text>
        {texto.clausulas.map((c) => (
          <View key={c.titulo}>
            <Text style={styles.clausula} minPresenceAhead={40}>
              {c.titulo}
            </Text>
            {c.itens.map((item, idx) => (
              <Text key={idx} style={styles.paragraph}>
                {c.itens.length > 1 ? `§ ${idx + 1}º ` : ''}
                {item}
              </Text>
            ))}
          </View>
        ))}
        <Text style={styles.local}>{texto.local}</Text>
        <View style={styles.signatureBlock} wrap={false}>
          {texto.assinantes.map((a) => (
            <View key={a} style={styles.signatureColumn}>
              <Text style={styles.signatureLine}>{a}</Text>
            </View>
          ))}
        </View>
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => `${texto.titulo} — página ${pageNumber} de ${totalPages}`}
        />
      </Page>
    </Document>
  )
}
