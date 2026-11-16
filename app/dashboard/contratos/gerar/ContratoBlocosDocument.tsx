import fs from 'node:fs'
import path from 'node:path'
import { Document, Font, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { BlocoContrato, ContratoBlocos } from './blocos'

// Layout do modelo em PDF: Times, texto justificado, sem cabeçalho, tabelas
// com borda, alíneas recuadas e assinaturas com linha à direita.
// O modelo não separa palavras no fim da linha.
Font.registerHyphenationCallback((palavra) => [palavra])

// Marca d'água: logo da Liberty Car, centralizada no fundo de cada página (app/public/).
const MARCA_DAGUA = (() => {
  for (const base of [path.join(process.cwd(), 'app', 'public'), path.join(process.cwd(), 'public')]) {
    try {
      const f = path.join(base, 'logo-liberty-car-blue.png')
      if (fs.existsSync(f)) return `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`
    } catch {
      // sem o arquivo, o contrato sai sem marca d'água.
    }
  }
  return ''
})()
const MARCA_LARGURA = 380
const MARCA_ALTURA = (MARCA_LARGURA * 448) / 1014

const REGULAR = 'Times-Roman'
const NEGRITO = 'Times-Bold'

const styles = StyleSheet.create({
  page: { paddingTop: 64, paddingBottom: 64, paddingHorizontal: 80, fontSize: 11.5, fontFamily: REGULAR, color: '#000', lineHeight: 1.35 },
  marcaDagua: { position: 'absolute', left: (595 - MARCA_LARGURA) / 2, top: (842 - MARCA_ALTURA) / 2, width: MARCA_LARGURA, height: MARCA_ALTURA, opacity: 0.07 },
  titulo: { fontFamily: NEGRITO, fontSize: 14, textAlign: 'center', marginBottom: 20 },
  secao: { fontFamily: NEGRITO, marginTop: 16, marginBottom: 8 },
  p: { textAlign: 'justify', marginBottom: 9 },
  rotuloLinha: { flexDirection: 'row', marginBottom: 9 },
  rotulo: { width: 38, fontFamily: NEGRITO },
  rotuloTexto: { flex: 1, textAlign: 'justify' },
  alinea: { flexDirection: 'row', marginBottom: 3, fontSize: 10.5 },
  alineaLetra: { width: 18 },
  alineaTexto: { flex: 1, textAlign: 'justify' },
  alineas: { marginBottom: 9 },
  tabela: { borderTopWidth: 1, borderColor: '#000', marginBottom: 12 },
  linha: { flexDirection: 'row' },
  celulaRotulo: { width: '36%', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#000', paddingVertical: 1.5, paddingHorizontal: 4, textAlign: 'center', fontFamily: NEGRITO },
  celulaValor: { flex: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#000', paddingVertical: 1.5, paddingHorizontal: 6 },
  assinatura: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 34 },
  assinaturaTexto: { fontFamily: NEGRITO },
  assinaturaLinha: { width: 170, borderBottomWidth: 1, borderColor: '#000', marginBottom: 2 },
})

/** `**texto**` → trechos em negrito. */
function Rico({ texto }: { texto: string }) {
  const partes = texto.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {partes.map((parte, idx) =>
        idx % 2 === 1 ? (
          <Text key={idx} style={{ fontFamily: NEGRITO }}>
            {parte}
          </Text>
        ) : (
          parte
        ),
      )}
    </>
  )
}

/** `prende`: o bloco seguinte é tabela ou alíneas, que este parágrafo apresenta. */
function Bloco({ b, prende }: { b: BlocoContrato; prende: 'tabela' | 'alineas' | 'assinaturas' | null }) {
  switch (b.tipo) {
    case 'titulo':
      return <Text style={styles.titulo}>{b.texto}</Text>
    case 'secao':
      return (
        <Text style={styles.secao} minPresenceAhead={60}>
          {b.texto}
        </Text>
      )
    case 'p':
      return b.rotulo ? (
        <View style={styles.rotuloLinha} wrap={false}>
          <Text style={styles.rotulo}>{b.rotulo}</Text>
          <Text style={styles.rotuloTexto}>
            <Rico texto={b.texto} />
          </Text>
        </View>
      ) : (
        <Text style={styles.p} minPresenceAhead={prende === 'tabela' ? 190 : prende === 'alineas' ? 70 : prende === 'assinaturas' ? 300 : undefined}>
          <Rico texto={b.texto} />
        </Text>
      )
    case 'alineas':
      return (
        <View style={styles.alineas}>
          {b.itens.map((item, idx) => (
            <View key={idx} style={styles.alinea} wrap={false}>
              <Text style={styles.alineaLetra}>{String.fromCharCode(97 + idx)}.</Text>
              <Text style={styles.alineaTexto}>
                <Rico texto={item} />
              </Text>
            </View>
          ))}
        </View>
      )
    case 'tabela':
      return (
        // Tabela inteira na mesma página (as linhas também não se dividem).
        <View style={styles.tabela} wrap={false}>
          {b.linhas.map(([rotulo, valor]) => (
            <View key={rotulo} style={styles.linha} wrap={false}>
              <Text style={styles.celulaRotulo}>{rotulo}</Text>
              <Text style={styles.celulaValor}>{valor}</Text>
            </View>
          ))}
        </View>
      )
    case 'assinaturas':
      return (
        // Data e todas as assinaturas na mesma página.
        <View wrap={false}>
          {b.itens.map((a) => (
            <View key={a.papel} style={styles.assinatura} wrap={false}>
              <View>
                <Text style={styles.assinaturaTexto}>{a.nome}</Text>
                <Text style={styles.assinaturaTexto}>{a.documento}</Text>
                <Text style={styles.assinaturaTexto}>{a.papel}</Text>
              </View>
              <View style={styles.assinaturaLinha} />
            </View>
          ))}
        </View>
      )
  }
}

export default function ContratoBlocosDocument({ contrato, nomeCliente }: { contrato: ContratoBlocos; nomeCliente: string }) {
  return (
    <Document title={`${contrato.titulo} - ${nomeCliente}`} subject={contrato.titulo}>
      <Page size="A4" style={styles.page} wrap>
        {MARCA_DAGUA && <Image alt="" src={MARCA_DAGUA} style={styles.marcaDagua} fixed />}
        {contrato.blocos.map((b, idx) => (
          <Bloco
            key={idx}
            b={b}
            prende={
              contrato.blocos[idx + 1]?.tipo === 'tabela'
                ? 'tabela'
                : contrato.blocos[idx + 1]?.tipo === 'alineas'
                  ? 'alineas'
                  : contrato.blocos[idx + 1]?.tipo === 'assinaturas'
                    ? 'assinaturas'
                    : null
            }
          />
        ))}
      </Page>
    </Document>
  )
}
