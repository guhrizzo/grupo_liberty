const { renderToBuffer, Font } = require('@react-pdf/renderer')
const React = require('react')
const path = require('node:path')
const fs = require('node:fs')

const PropostaDoc = require('../app/dashboard/propostas/pdf/PropostaAutorizacaoDocument').default

async function main() {
  const props = {
    id: 'TEST12345',
    clienteNome: 'Fulano da Silva',
    clienteCpf: '123.456.789-00',
    clienteEmail: 'fulano@example.com',
    clienteTelefone: '11999999999',
    veiculoMarca: 'Toyota',
    veiculoModelo: 'Corolla',
    veiculoAno: 2022,
    veiculoPlaca: 'ABC1D23',
    veiculoPrecoSugerido: 90000,
    veiculoValorFipe: 95000,
    parcelasTotais: 48,
    parcelasPagas: 20,
    parcelasAtrasadas: 28,
    valorParcela: 1500,
    saldoDevedor: 42000,
    dividaTotal: 45000,
    custoAcumulado: 5000,
    ipvaAtrasado: 1200,
    licenciamento: 300,
    multas: 500,
    pecasReparo: 'Para-choque e Pintura',
    valorPecasReparo: 2500,
    propostaComercial: 35000,
    valorOfertado: 35000,
    mensagem: 'Proposta enviada pelo sistema',
    statusProposta: 'aceito',
    criadoEm: new Date().toISOString(),
    observacoesInternas: null,
    condicoes: null,
  }

  const elem = React.createElement(PropostaDoc, props)
  const buf = await renderToBuffer(elem)
  fs.writeFileSync('.inspect/proposta_gerada.pdf', buf)
  console.log('🎉 SUCESSO! PDF gerado em .inspect/proposta_gerada.pdf - Tamanho:', buf.length, 'bytes')
}

main().catch(err => {
  console.error('ERRO:', err)
})
