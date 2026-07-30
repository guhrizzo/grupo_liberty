import { createElement } from 'react'
import path from 'node:path'
import fs from 'node:fs'
import { renderToBuffer } from '@react-pdf/renderer'
import PropostaAutorizacaoDoc from '../app/dashboard/propostas/pdf/PropostaAutorizacaoDocument'

async function run() {
  const Component = typeof PropostaAutorizacaoDoc === 'function'
    ? PropostaAutorizacaoDoc
    : (PropostaAutorizacaoDoc as any).default

  const element = createElement(Component, {
    id: 'test12345',
    clienteNome: 'João da Silva',
    clienteCpf: '123.456.789-00',
    clienteEmail: 'joao@example.com',
    clienteTelefone: null,
    veiculoMarca: 'Toyota',
    veiculoModelo: 'Corolla',
    veiculoAno: 2020,
    veiculoPlaca: 'ABC1D23',
    veiculoPrecoSugerido: 80000,
    veiculoValorFipe: 75000,
    parcelasTotais: 48,
    parcelasPagas: 12,
    parcelasAtrasadas: 36,
    valorParcela: 1500,
    saldoDevedor: 54000,
    dividaTotal: 60000,
    custoAcumulado: 12000,
    banco: 'Banco do Brasil',
    propostaComercial: 25000,
    valorOfertado: 22000,
    mensagem: 'Mensagem do cliente',
    statusProposta: 'pendente',
    criadoEm: '2026-07-29T10:00:00Z',
    observacoesInternas: null,
    condicoes: null,
  })

  try {
    const buffer = await renderToBuffer(element as any)
    const outPath = path.resolve(process.cwd(), '.inspect/test-output.pdf')
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, buffer)
    console.log('SUCCESS: PDF written to', outPath, 'size:', buffer.length, 'bytes')
  } catch (err) {
    console.error('RENDER ERROR:', err)
  }
}

run()
