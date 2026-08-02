import path from 'node:path'
import fs from 'node:fs'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  ImageBackground,
  Font,
} from '@react-pdf/renderer'

// ─────────────────────────────────────────────────────────────────────────────
// Assets de app/public/.
// Convertemos PNGs e TTF/OTF para data URL base64.
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
    console.error(`Erro ao carregar imagem ${fileName}:`, e)
  }
  return ''
}

const FUNDO_1 = toImageDataUrl('fundo-1.png')
const FUNDO_2 = toImageDataUrl('fundo-2.png')
const FUNDO_3 = toImageDataUrl('fundo-3.png')
const LOGO_LIBERTY = toImageDataUrl('logo-liberty-car-blue.png')
const CHECK_BLUE = toImageDataUrl('check-blue.png')
const SETA = toImageDataUrl('seta.png')

let fontsRegistered = false
try {
  const headingPath = resolvePublicPath('HeadingNowTrial-46Bold.ttf')
  const interLightPath = resolvePublicPath('inter-light.otf')
  const interMediumPath = resolvePublicPath('Inter-medium.ttf')
  const interSemiPath = resolvePublicPath('inter-semi-bold.ttf')

  if (headingPath && interLightPath && interMediumPath && interSemiPath) {
    const toDataUrl = (p: string) =>
      'data:font/ttf;base64,' + fs.readFileSync(p).toString('base64')

    const headingData = toDataUrl(headingPath)
    const lightData = toDataUrl(interLightPath)
    const mediumData = toDataUrl(interMediumPath)
    const semiData = toDataUrl(interSemiPath)

    Font.register({
      family: 'HeadingNowTrial',
      fonts: [
        { src: headingData, fontWeight: 400 },
        { src: headingData, fontWeight: 700 },
      ],
    })

    Font.register({
      family: 'Inter',
      fonts: [
        { src: lightData, fontWeight: 'normal' },
        { src: lightData, fontWeight: 300 },
        { src: lightData, fontWeight: 400 },
        { src: mediumData, fontWeight: 500 },
        { src: semiData, fontWeight: 600 },
        { src: semiData, fontWeight: 700 },
        { src: semiData, fontWeight: 'bold' },
      ],
    })

    fontsRegistered = true
  }
} catch (err) {
  console.error('[PropostaDocument] font register failed:', err)
  fontsRegistered = false
}

const HEADING_FONT = fontsRegistered ? 'HeadingNowTrial' : 'Helvetica-Bold'
const INTER_FONT = fontsRegistered ? 'Inter' : 'Helvetica'

const COLORS = {
  bgBlack: '#000000',
  bgContainer: 'rgba(0, 0, 0, 0.72)',
  accentBlue: '#000c28',
  accentBlueTransp: 'rgba(0, 12, 40, 0.95)',
  textLight: '#ffffff',
  textMuted: '#e5e5e5',
  textSubtle: '#a1a1aa',
  borderLine: 'rgba(255, 255, 255, 0.15)',
  redInfo: '#ff1a40',
}

const styles = StyleSheet.create({
  page: {
    width: 595.28,
    height: 841.89,
    fontFamily: INTER_FONT,
    color: COLORS.textLight,
    backgroundColor: COLORS.bgBlack,
  },
  pageFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // PAGE 1 — CAPA
  capaContent: {
    flex: 1,
    padding: 45,
    justifyContent: 'space-between',
  },
  h1Title: {
    fontSize: 125,
    fontFamily: HEADING_FONT,
    fontWeight: 'bold',
    color: COLORS.textLight,
    lineHeight: 0.9,
    marginTop: 20,
    textTransform: 'uppercase',
  },
  h1Span: {
    fontSize: 112,
    fontFamily: HEADING_FONT,
    fontWeight: 'bold',
    color: COLORS.textLight,
  },
  setaImg: {
    width: 100,
    height: 100,
    marginTop: 36,
  },
  capaBottomBlock: {
    marginBottom: 20,
  },
  dateBlock: {
    marginBottom: 16,
  },
  dateText: {
    fontFamily: INTER_FONT,
    fontSize: 15,
    color: COLORS.textLight,
    marginBottom: 3,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 20,
  },
  infoColLabel: {
    fontFamily: INTER_FONT,
    fontWeight: 600,
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 3,
  },
  infoColValue: {
    fontFamily: INTER_FONT,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  logoBlue: {
    width: 130,
  },

  // PAGE 2 — INFORMAÇÕES DO VEÍCULO E DÍVIDA
  page2Content: {
    flex: 1,
    paddingHorizontal: 25,
    paddingVertical: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subcontainer2: {
    width: '94%',
    flexGrow: 1,
    borderRadius: 24,
    backgroundColor: COLORS.bgContainer,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  h2Title: {
    fontSize: 22,
    fontFamily: INTER_FONT,
    fontWeight: 600,
    color: COLORS.textLight,
    marginTop: 6,
    marginBottom: 10,
  },
  pathLine: {
    width: '100%',
    height: 1,
    backgroundColor: COLORS.borderLine,
    marginVertical: 8,
  },
  pathLineShort: {
    width: '100%',
    height: 1,
    backgroundColor: COLORS.borderLine,
    marginTop: 4,
    marginBottom: 8,
  },
  dadosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'center',
  },
  dadosLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: INTER_FONT,
    maxWidth: '60%',
  },
  dadosLabelRed: {
    fontSize: 12,
    color: COLORS.redInfo,
    fontFamily: INTER_FONT,
    fontWeight: 600,
    maxWidth: '60%',
  },
  dadosValue: {
    fontSize: 12,
    color: COLORS.textLight,
    fontFamily: INTER_FONT,
    fontWeight: 500,
  },
  dadosValueRed: {
    fontSize: 12,
    color: COLORS.redInfo,
    fontFamily: INTER_FONT,
    fontWeight: 600,
  },
  sndTitle: {
    fontSize: 16,
    fontFamily: INTER_FONT,
    fontWeight: 600,
    color: COLORS.textLight,
    marginTop: 6,
    marginBottom: 4,
  },

  // PAGE 3 — PROPOSTA COMERCIAL
  page3Content: {
    flex: 1,
    paddingHorizontal: 25,
    paddingVertical: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subcontainer3: {
    width: '94%',
    flexGrow: 1,
    borderRadius: 24,
    backgroundColor: COLORS.accentBlueTransp,
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  thrdTitle: {
    fontSize: 22,
    fontFamily: INTER_FONT,
    fontWeight: 600,
    color: COLORS.textLight,
    marginTop: 6,
    marginBottom: 10,
  },
  propComercialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  propText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: INTER_FONT,
    lineHeight: 1.35,
  },
  carValue: {
    fontSize: 22,
    fontFamily: INTER_FONT,
    fontWeight: 600,
    color: COLORS.textLight,
  },
  longText: {
    fontSize: 11,
    lineHeight: 1.4,
    color: COLORS.textMuted,
    marginVertical: 8,
  },
  list: {
    marginTop: 4,
    marginBottom: 8,
  },
  checkItem: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  checkImg: {
    width: 10,
    height: 10,
    marginTop: 2,
  },
  checkText: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 1.35,
    flex: 1,
  },
  fthTitle: {
    fontSize: 16,
    fontFamily: INTER_FONT,
    fontWeight: 600,
    color: COLORS.textLight,
    marginBottom: 8,
  },
  condicoesP: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 1.45,
    marginBottom: 6,
  },
})

function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'R$: 0,00'
  const fmt = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
  return `R$: ${fmt}`
}

function formatDateBR(iso: string | undefined | null): string {
  if (!iso) return new Date().toLocaleDateString('pt-BR')
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return new Date().toLocaleDateString('pt-BR')
    return d.toLocaleDateString('pt-BR')
  } catch {
    return new Date().toLocaleDateString('pt-BR')
  }
}

export interface PropostaAutorizacaoDocumentProps {
  id: string
  // Contrato / capa
  numeroContrato?: string | null
  clienteNome: string
  clienteCpf?: string | null
  clienteEmail?: string | null
  clienteTelefone?: string | null
  clienteData?: string | null
  // Veículo
  veiculoMarca: string
  veiculoModelo: string
  veiculoAno?: number | null
  veiculoPlaca?: string | null
  veiculoPrecoSugerido?: number | null
  veiculoValorFipe?: number | null
  valorEstimadoDivida?: number | null
  // Financeiro do veículo
  parcelasTotais?: number | null
  parcelasPagas?: number | null
  parcelasAtrasadas?: number | null
  valorParcela?: number | null
  saldoDevedor?: number | null
  dividaTotal?: number | null
  custoAcumulado?: number | null
  // Pendências do veículo
  valorIpva?: number | null
  valorLicenciamento?: number | null
  valorMultas?: number | null
  /** Lista detalhada de débitos (substitui valorIpva/licenciamento/multas quando presente). */
  debitosItens?: Array<{ chave: string; label: string; valor: number }> | null
  // Peças
  pecasReparo?: string | null
  valorPecasReparo?: number | null
  pecasConserto?: Array<{ nome: string; valor: number }> | null
  banco?: string | null
  // Proposta comercial
  propostaComercial?: number | null
  /** Valor monetário da proposta prévia (página 4 do PDF). */
  propostaPrevia?: number | null
  valorOfertado?: number | null
  mensagem?: string | null
  statusProposta?: string
  criadoEm?: string
  observacoesInternas?: string | null
  condicoes?: string | null
}

export default function PropostaAutorizacaoDocument(props: PropostaAutorizacaoDocumentProps) {
  const {
    clienteNome,
    clienteCpf,
    clienteData,
    veiculoMarca,
    veiculoModelo,
    veiculoAno,
    veiculoPlaca,
    veiculoValorFipe,
    valorEstimadoDivida,
    parcelasTotais = 0,
    parcelasPagas = 0,
    parcelasAtrasadas: parcelasAtrasadasProp,
    valorParcela = 0,
    saldoDevedor: saldoDevedorProp,
    valorIpva = 0,
    valorLicenciamento = 0,
    valorMultas = 0,
    debitosItens,
    pecasReparo,
    valorPecasReparo = 0,
    pecasConserto,
    propostaComercial,
    valorOfertado = 0,
    criadoEm,
    condicoes,
  } = props

  const totTotais = Number(parcelasTotais) || 0
  const totPagas = Number(parcelasPagas) || 0
  const parcelasRestantes = Math.max(0, totTotais - totPagas)
  const parcelasEmAtraso = parcelasAtrasadasProp != null ? Number(parcelasAtrasadasProp) : 0

  const valParcela = Number(valorParcela) || 0
  const propostaValorFinal = propostaComercial ?? valorOfertado ?? 0
  const calcSaldoDevedor =
    saldoDevedorProp != null ? Number(saldoDevedorProp) : parcelasRestantes * valParcela

  const ipvaVal = Number(valorIpva) || 0
  const licVal = Number(valorLicenciamento) || 0
  const multasVal = Number(valorMultas) || 0

  const debitosLista: Array<{ chave: string; label: string; valor: number }> =
    Array.isArray(debitosItens) && debitosItens.length > 0
      ? debitosItens.filter((d) => Number(d.valor) > 0)
      : [
          { chave: 'ipva', label: 'IPVA', valor: ipvaVal },
          { chave: 'licenciamento', label: 'Licenciamento', valor: licVal },
          { chave: 'multas', label: 'Multas', valor: multasVal },
        ].filter((d) => Number(d.valor) > 0)

  const totEncargos = debitosLista.reduce((acc, d) => acc + (Number(d.valor) || 0), 0)

  const reparoVal = Number(valorPecasReparo) || 0

  const pecasConsertoList = Array.isArray(pecasConserto) && pecasConserto.length > 0
    ? pecasConserto
    : null
  const pecasConsertoTextoFallback =
    !pecasConsertoList && pecasReparo && pecasReparo.trim() ? pecasReparo : null
  const totalPecasConserto =
    pecasConsertoList && pecasConsertoList.length > 0
      ? pecasConsertoList.reduce((acc, p) => acc + (Number(p.valor) || 0), 0)
      : reparoVal
  const temPecasConserto =
    (pecasConsertoList != null && pecasConsertoList.length > 0) ||
    Boolean(pecasConsertoTextoFallback) ||
    reparoVal > 0
  const prejuizoTotal =
    valorEstimadoDivida != null && Number(valorEstimadoDivida) > 0
      ? Number(valorEstimadoDivida)
      : totEncargos + reparoVal + calcSaldoDevedor

  const dataContrato =
    clienteData && clienteData.trim()
      ? formatDateBR(clienteData)
      : formatDateBR(criadoEm)

  const temPendencias = totEncargos > 0
  const temReparos = temPecasConserto

  const condicoesArray =
    condicoes && condicoes.trim()
      ? condicoes.split('\n\n')
      : [
          'A proposta é válida por 5 dias a partir da data de emissão deste documento.',
          'O processo de quitação pode levar de 6 a 12 meses, conforme análise do caso e da financeira.',
          'Durante esse período, o cliente não será mais responsável pelo pagamento do financiamento, impostos ou multas relacionados ao veículo.',
          'Após o processo finalizado, nenhuma pendência financeira recairá sobre o antigo proprietário.',
          'Um contrato formal será assinado para segurança de ambas as partes.',
        ]

  return (
    <Document
      title={`Proposta Liberty Car - ${clienteNome}`}
      author="Liberty Car"
      subject="Proposta comercial de aquisição de veículo"
    >
      {/* ───── PÁGINA 1 — CAPA ───── */}
      <Page size="A4" style={styles.page}>
        <ImageBackground src={FUNDO_1} style={styles.pageFill}>
          <View style={styles.capaContent}>
            <View>
              <Text style={styles.h1Title}>
                Proposta{'\n'}
                <Text style={styles.h1Span}>Liberty Car</Text>
              </Text>
              {SETA ? <Image src={SETA} style={styles.setaImg} /> : null}
            </View>
            <View style={styles.capaBottomBlock}>
              <View style={styles.dateBlock}>
                <Text style={styles.dateText}>Data: {dataContrato}</Text>
              </View>
              <View style={styles.infoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoColLabel}>Cliente:</Text>
                  <Text style={styles.infoColValue}>{clienteNome}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoColLabel}>CPF:</Text>
                  <Text style={styles.infoColValue}>{clienteCpf || 'N/A'}</Text>
                </View>
              </View>
              {LOGO_LIBERTY ? <Image src={LOGO_LIBERTY} style={styles.logoBlue} /> : null}
            </View>
          </View>
        </ImageBackground>
      </Page>

      {/* ───── PÁGINA 2 — INFORMAÇÕES DO VEÍCULO + DÍVIDA + PENDÊNCIAS + PEÇAS ───── */}
      <Page size="A4" style={styles.page}>
        <ImageBackground src={FUNDO_2} style={styles.pageFill}>
          <View style={styles.page2Content}>
            <View style={styles.subcontainer2}>
              <Text style={styles.h2Title}>Informações do veículo</Text>
              <View style={styles.pathLine} />

              <View style={styles.dadosRow}>
                <Text style={styles.dadosLabel}>Marca &amp; Modelo:</Text>
                <Text style={styles.dadosValue}>
                  {veiculoMarca} / {veiculoModelo}
                </Text>
              </View>
              <View style={styles.dadosRow}>
                <Text style={styles.dadosLabel}>Ano do Veículo:</Text>
                <Text style={styles.dadosValue}>{veiculoAno ?? 'N/A'}</Text>
              </View>
              <View style={styles.dadosRow}>
                <Text style={styles.dadosLabel}>Placa do Veículo:</Text>
                <Text style={styles.dadosValue}>
                  {veiculoPlaca ? veiculoPlaca.toUpperCase() : 'N/A'}
                </Text>
              </View>
              <View style={styles.dadosRow}>
                <Text style={styles.dadosLabel}>Valor de mercado/FIPE:</Text>
                <Text style={styles.dadosValue}>{formatBRL(veiculoValorFipe)}</Text>
              </View>

              <View style={styles.pathLine} />
              <Text style={styles.sndTitle}>Dívida Atual</Text>
              <View style={styles.pathLineShort} />

              <View style={styles.dadosRow}>
                <Text style={styles.dadosLabel}>Parcelas totais:</Text>
                <Text style={styles.dadosValue}>{totTotais} Parcelas</Text>
              </View>
              <View style={styles.dadosRow}>
                <Text style={styles.dadosLabel}>Parcelas Pagas:</Text>
                <Text style={styles.dadosValue}>{totPagas} Parcelas</Text>
              </View>
              <View style={styles.dadosRow}>
                <Text style={styles.dadosLabel}>Parcelas em atraso:</Text>
                <Text style={styles.dadosValue}>{parcelasEmAtraso} Parcelas</Text>
              </View>
              <View style={styles.dadosRow}>
                <Text style={styles.dadosLabel}>Valor da parcela:</Text>
                <Text style={styles.dadosValue}>{formatBRL(valParcela)}</Text>
              </View>
              <View style={styles.dadosRow}>
                <Text style={styles.dadosLabel}>Saldo devedor total:</Text>
                <Text style={calcSaldoDevedor <= 0 ? styles.dadosValue : styles.dadosValueRed}>
                  {calcSaldoDevedor <= 0 ? 'Saldo Positivo' : formatBRL(calcSaldoDevedor)}
                </Text>
              </View>

              {temPendencias && (
                <>
                  <View style={styles.pathLine} />
                  <Text style={styles.sndTitle}>Pendências / Débitos</Text>
                  <View style={styles.pathLineShort} />
                  {debitosLista.map((d) => (
                    <View key={d.chave} style={styles.dadosRow}>
                      <Text style={styles.dadosLabel}>{d.label}:</Text>
                      <Text style={styles.dadosValue}>
                        {formatBRL(Number(d.valor) || 0)}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.dadosRow}>
                    <Text style={styles.dadosLabelRed}>
                      Total de débitos:
                    </Text>
                    <Text style={styles.dadosValueRed}>{formatBRL(totEncargos)}</Text>
                  </View>
                </>
              )}

              {temReparos && (
                <>
                  <View style={styles.pathLine} />
                  <Text style={styles.sndTitle}>Peças para Conserto</Text>
                  <View style={styles.pathLineShort} />
                  {pecasConsertoList && pecasConsertoList.length > 0 ? (
                    <>
                      {pecasConsertoList.map((p, idx) => (
                        <View key={idx} style={styles.dadosRow}>
                          <Text style={styles.dadosLabel}>{p.nome}</Text>
                          <Text style={styles.dadosValueRed}>
                            {formatBRL(Number(p.valor) || 0)}
                          </Text>
                        </View>
                      ))}
                      <View style={styles.dadosRow}>
                        <Text style={styles.dadosLabelRed}>Total de peças</Text>
                        <Text style={styles.dadosValueRed}>{formatBRL(totalPecasConserto)}</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.dadosRow}>
                      <Text style={styles.dadosLabel}>
                        Peças que precisam de reparo:{' '}
                        {pecasConsertoTextoFallback || 'N/A'}
                      </Text>
                      <Text style={styles.dadosValueRed}>
                        {formatBRL(totalPecasConserto)}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </ImageBackground>
      </Page>

      {/* ───── PÁGINA 3 — PROPOSTA COMERCIAL E CONDIÇÕES ───── */}
      <Page size="A4" style={styles.page}>
        <ImageBackground src={FUNDO_3} style={styles.pageFill}>
          <View style={styles.page3Content}>
            <View style={styles.subcontainer3}>
              <View>
                <Text style={styles.thrdTitle}>Proposta Comercial</Text>
                <View style={styles.pathLine} />

                <View style={styles.propComercialRow}>
                  <Text style={styles.propText}>
                    A empresa LibertyCar propõe adquirir o{'\n'}
                    veículo descrito acima por:
                  </Text>
                  <Text style={styles.carValue}>{formatBRL(propostaValorFinal)}</Text>
                </View>

                <Text style={styles.longText}>
                  Mesmo que o veículo esteja gerando um prejuízo acumulado de
                  mais de {formatBRL(prejuizoTotal)}, a LibertyCar se
                  compromete e assume todos os riscos e responsabilidades do
                  processo, pagando à vista por algo que, na prática, está em
                  situação desfavorável.
                </Text>

                <Text style={[styles.propText, { fontWeight: 600, color: COLORS.textLight, marginBottom: 4 }]}>
                  Este valor inclui os seguintes pontos:
                </Text>

                <View style={styles.list}>
                  {[
                    'Assunção integral da dívida ativa até a quitação total junto ao banco.',
                    'Assunção de TODAS as pendências do veículo junto ao Detran (IPVA atrasado, multas, licenciamento).',
                    'Assunção dos custos de reparo do veículo (incluindo estética e mecânica).',
                    'Regularização completa da documentação, taxas de transferência, vistoria, desbloqueio e o que mais for necessário.',
                    'Cobertura de eventuais pendências com cartórios (procurações, bloqueios e restrições judiciais).',
                    'Serviço adicional de limpeza de nome, caso a dívida com o banco esteja vinculada ao CPF do proprietário.',
                  ].map((item, idx) => (
                    <View key={idx} style={styles.checkItem}>
                      {CHECK_BLUE ? <Image src={CHECK_BLUE} style={styles.checkImg} /> : null}
                      <Text style={styles.checkText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View>
                <Text style={styles.fthTitle}>Condições e Garantias</Text>
                {condicoesArray.map((p, idx) => (
                  <Text key={idx} style={styles.condicoesP}>
                    {p}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </ImageBackground>
      </Page>
    </Document>
  )
}
