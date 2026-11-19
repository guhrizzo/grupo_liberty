import fs from 'node:fs'
import path from 'node:path'
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { maskCPFCNPJ } from '@/utils/masks'
import { brl, reaisPorExtenso } from '../texto'
import { numeroDe } from '../types'
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

/** "2026-11-19" → "19/11/2026" (sem passar por Date, que deslocaria o dia em servidor UTC). */
const dataCurta = (iso: string) => iso.split('-').reverse().join('/')

const emitidoEm = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)

export default function ReciboDocument({ input, agora }: { input: ReciboInput; agora: Date }) {
  const { pagador: p, veiculo: v, recebedor: r, pagamento: g } = input
  const valor = numeroDe(g.valor)
  const total = g.valorTotal.trim() ? numeroDe(g.valorTotal) : null
  const saldo = total !== null ? Math.max(0, Math.round((total - valor) * 100) / 100) : null
  const integral = total !== null && saldo === 0

  const badge = total === null ? null : integral
    ? { texto: 'Pagamento integral', cor: C.green, fundo: C.greenBg }
    : { texto: 'Pagamento parcial', cor: C.amber, fundo: C.amberBg }
  const corValor = badge?.cor ?? C.ink

  const doc = p.documento.replace(/\D/g, '')
  const rotuloDoc = doc.length === 14 ? 'CNPJ' : 'CPF'
  const veiculoLinha = [`${v.marca} ${v.modelo}`.trim(), v.ano, v.cor].filter(Boolean).join(' · ') + (v.placa ? ` · Placa ${v.placa}` : '')
  const veiculoDocs = [v.chassi && `Chassi ${v.chassi}`, v.renavam && `RENAVAM ${v.renavam}`].filter(Boolean).join(' · ')
  const forma = g.forma.trim()

  return (
    <Document title={`Recibo de pagamento — ${p.nome}`} author="Liberty Car" subject={`Veículo ${v.placa}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {LOGO ? <Image src={LOGO} style={s.logo} /> : <Text style={s.titulo}>Liberty Car</Text>}
          <View style={s.headerRight}>
            <Text style={s.titulo}>Recibo de pagamento</Text>
            <Text style={s.meta}>Veículo: {v.placa}</Text>
            <Text style={s.meta}>Emitido em: {emitidoEm(agora)}</Text>
          </View>
        </View>

        {badge && (
          <View style={[s.badge, { borderColor: badge.cor, backgroundColor: badge.fundo }]}>
            <Text style={[s.badgeText, { color: badge.cor }]}>{badge.texto}</Text>
          </View>
        )}

        <View style={s.bloco}>
          <Text style={s.label}>Pagador</Text>
          <Text style={s.valor}>{p.nome.toUpperCase()}</Text>
          <Text style={s.apoio}>
            {rotuloDoc} nº {maskCPFCNPJ(doc)}
          </Text>
          {p.endereco.trim() ? <Text style={s.apoio}>{p.endereco}</Text> : null}
          {[p.telefone, p.email].filter((x) => x.trim()).length > 0 ? (
            <Text style={s.apoio}>{[p.telefone, p.email].filter((x) => x.trim()).join(' · ')}</Text>
          ) : null}
        </View>

        <View style={s.bloco}>
          <Text style={s.label}>Recebedor</Text>
          <Text style={s.valor}>{r.nome}</Text>
          {r.cnpj ? <Text style={s.apoio}>CNPJ nº {maskCPFCNPJ(r.cnpj)}</Text> : null}
          {r.endereco.trim() ? <Text style={s.apoio}>{r.endereco}</Text> : null}
        </View>

        <View style={s.bloco}>
          <Text style={s.label}>Veículo</Text>
          <Text style={s.valor}>{veiculoLinha}</Text>
          {veiculoDocs ? <Text style={s.apoio}>{veiculoDocs}</Text> : null}
        </View>

        <View style={s.painel}>
          <View style={s.linha}>
            <Text style={s.rotulo}>Referente a</Text>
            <Text style={s.rotuloTexto}>{g.referencia}</Text>
          </View>
          <View style={s.linha}>
            <Text style={s.rotulo}>Data do pagamento</Text>
            <Text style={s.negrito}>{dataCurta(g.data)}</Text>
          </View>
          {forma ? (
            <View style={s.linha}>
              <Text style={s.rotulo}>Forma de pagamento</Text>
              <Text style={s.negrito}>{forma}</Text>
            </View>
          ) : null}
          <View style={s.divisor} />
          <View style={total === null ? s.linhaFim : s.linha}>
            <Text style={s.rotulo}>Valor recebido</Text>
            <Text style={[s.grande, { color: corValor }]}>{brl(valor)}</Text>
          </View>
          {total !== null && saldo !== null ? (
            <>
              <View style={s.linha}>
                <Text style={s.rotulo}>Valor total do contrato</Text>
                <Text style={s.negrito}>{brl(total)}</Text>
              </View>
              <View style={s.linhaFim}>
                <Text style={s.rotulo}>Saldo restante</Text>
                <Text style={s.negrito}>{brl(saldo)}</Text>
              </View>
            </>
          ) : null}
        </View>

        <Text style={s.declaracao}>
          Declaramos ter recebido de {p.nome.toUpperCase()}, {rotuloDoc} nº {maskCPFCNPJ(doc)}, na data de {dataCurta(g.data)}, a importância de {brl(valor)} (
          {reaisPorExtenso(valor)}){forma ? `, por ${forma}` : ''}, referente a {g.referencia}. Este recibo dá quitação apenas do valor aqui descrito.
        </Text>

        <View style={s.assinatura}>
          <View style={s.assinaturaLinha}>
            <Text style={s.negrito}>{r.responsavel || r.nome}</Text>
            <Text style={s.apoio}>
              {r.responsavelCpf ? `CPF nº ${maskCPFCNPJ(r.responsavelCpf)} · ` : ''}RECEBEDOR
            </Text>
          </View>
        </View>

        <Text style={s.rodape}>Liberty Car · grupolibertycar.com.br · Jaú/SP</Text>
      </Page>
    </Document>
  )
}
