import PropostaAutorizacaoDocument, {
  PropostaAutorizacaoDocumentProps,
} from './PropostaAutorizacaoDocument'

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
  // Props estendidas opcionais
  clienteCpf?: string | null
  veiculoAno?: number | null
  veiculoPlaca?: string | null
  veiculoValorFipe?: number | null
  parcelasTotais?: number | null
  parcelasPagas?: number | null
  parcelasAtrasadas?: number | null
  valorParcela?: number | null
  saldoDevedor?: number | null
  ipvaAtrasado?: number | null
  licenciamento?: number | null
  multas?: number | null
  pecasReparo?: string | null
  valorPecasReparo?: number | null
  propostaComercial?: number | null
  condicoes?: string | null
}

export default function PropostaDocument(props: PropostaDocumentProps) {
  const docProps: PropostaAutorizacaoDocumentProps = {
    id: props.id,
    clienteNome: props.clienteNome,
    clienteCpf: props.clienteCpf,
    clienteEmail: props.clienteEmail,
    veiculoMarca: props.veiculoMarca,
    veiculoModelo: props.veiculoModelo,
    veiculoAno: props.veiculoAno,
    veiculoPlaca: props.veiculoPlaca,
    veiculoPrecoSugerido: props.veiculoPrecoSugerido,
    veiculoValorFipe: props.veiculoValorFipe,
    parcelasTotais: props.parcelasTotais,
    parcelasPagas: props.parcelasPagas,
    parcelasAtrasadas: props.parcelasAtrasadas,
    valorParcela: props.valorParcela,
    saldoDevedor: props.saldoDevedor,
    ipvaAtrasado: props.ipvaAtrasado,
    licenciamento: props.licenciamento,
    multas: props.multas,
    pecasReparo: props.pecasReparo,
    valorPecasReparo: props.valorPecasReparo,
    propostaComercial: props.propostaComercial ?? props.valorOfertado,
    valorOfertado: props.valorOfertado,
    mensagem: props.mensagem,
    statusProposta: 'Aceita',
    criadoEm: props.criadoEm,
    condicoes: props.condicoes,
  }

  return <PropostaAutorizacaoDocument {...docProps} />
}
