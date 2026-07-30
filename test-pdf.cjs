const path = require('node:path')
const fs = require('node:fs')

process.chdir('C:/Users/Gustavo/Desktop/grupo_liberty')

require('ts-node/register')
const { renderToBuffer } = require('@react-pdf/renderer')
const React = require('react')
const PropostaDoc = require('./app/dashboard/propostas/pdf/PropostaAutorizacaoDocument.tsx').default

const props = {
  id: 'TEST',
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
  propostaComercial: 355.5,
  valorOfertado: 350,
  mensagem: 'oi',
  statusProposta: 'pendente',
  criadoEm: new Date().toISOString(),
  observacoesInternas: null,
  condicoes: null,
}

;(async () => {
  try {
    const elem = React.createElement(PropostaDoc, props)
    const buf = await renderToBuffer(elem)
    fs.writeFileSync('teste.pdf', buf)
    console.log('OK', buf.length, 'bytes')
  } catch (e) {
    console.error('FAIL:', e)
  }
})()
