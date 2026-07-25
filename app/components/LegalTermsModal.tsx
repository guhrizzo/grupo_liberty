'use client'

import { useState } from 'react'
import {
  IconFileText,
  IconShieldCheck,
  IconX,
  IconLock,
  IconScale,
  IconCheck,
  IconCopy,
  IconBuildingStore,
  IconUserCheck,
} from '@tabler/icons-react'
import { Modal } from '@/app/components/ui/Modal'

export type LegalTab = 'termos' | 'privacidade'

interface LegalTermsModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTab?: LegalTab
}

export default function LegalTermsModal({
  isOpen,
  onClose,
  defaultTab = 'termos',
}: LegalTermsModalProps) {
  const [activeTab, setActiveTab] = useState<LegalTab>(defaultTab)
  const [copied, setCopied] = useState(false)

  const handleTabChange = (tab: LegalTab) => {
    setActiveTab(tab)
  }

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.origin)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      hideClose
      className="max-w-3xl overflow-hidden p-0 rounded-2xl bg-white border border-neutral-200 shadow-2xl"
    >
      {/* Header com gradiente e abas */}
      <div className="relative border-b border-neutral-200 bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-800 text-white p-6 pb-0">
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-liberty/20 text-liberty border border-liberty/30 grid place-items-center">
              {activeTab === 'termos' ? (
                <IconScale size={22} stroke={2} />
              ) : (
                <IconShieldCheck size={22} stroke={2} />
              )}
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                Liberty<span className="text-liberty">Car</span> — Central de Transparência
              </h2>
              <p className="text-xs text-neutral-400">
                Termos legais, garantias e política de privacidade conforme a LGPD
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              title="Copiar link do site"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              {copied ? <IconCheck size={14} className="text-emerald-400" /> : <IconCopy size={14} />}
              {copied ? 'Copiado!' : 'Compartilhar'}
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg grid place-items-center bg-white/10 hover:bg-red-500/20 hover:text-red-400 text-neutral-400 transition-colors cursor-pointer"
              aria-label="Fechar modal"
            >
              <IconX size={18} />
            </button>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => handleTabChange('termos')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer border-b-2 ${
              activeTab === 'termos'
                ? 'bg-white text-neutral-900 border-liberty shadow-sm'
                : 'text-neutral-400 hover:text-white border-transparent hover:bg-white/5'
            }`}
          >
            <IconFileText size={16} className={activeTab === 'termos' ? 'text-liberty' : ''} />
            Termos de Uso
          </button>
          <button
            onClick={() => handleTabChange('privacidade')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer border-b-2 ${
              activeTab === 'privacidade'
                ? 'bg-white text-neutral-900 border-liberty shadow-sm'
                : 'text-neutral-400 hover:text-white border-transparent hover:bg-white/5'
            }`}
          >
            <IconLock size={16} className={activeTab === 'privacidade' ? 'text-liberty' : ''} />
            Política de Privacidade (LGPD)
          </button>
        </div>
      </div>

      {/* Conteúdo rolável */}
      <div className="p-6 md:p-8 max-h-[60vh] overflow-y-auto space-y-6 text-sm text-neutral-700 leading-relaxed">
        {activeTab === 'termos' ? (
          <>
            <div className="p-4 rounded-xl bg-liberty/5 border border-liberty/20 text-neutral-800 text-xs flex items-start gap-3">
              <IconBuildingStore size={20} className="text-liberty shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-neutral-900 block mb-0.5">
                  Bem-vindo à Liberty Car (Jaú/SP & Bauru/SP)
                </span>
                Ao navegar em nosso portal, consultar o estoque ou enviar propostas de veículos, você concorda com as condições descritas abaixo.
              </div>
            </div>

            <section className="space-y-2">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-liberty" />
                1. Objeto e Serviços Oferecidos
              </h3>
              <p>
                A <strong>Liberty Car</strong> atua no comércio de veículos automotores novos e seminovos, intermediando propostas, simulações de financiamento, trocas e vendas diretas nas unidades de Jaú/SP e Bauru/SP.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-liberty" />
                2. Procedência e Laudo de Vistoria
              </h3>
              <p>
                Todos os veículos seminovos exibidos em nosso estoque passam por rigoroso processo de vistoria cautelar e verificação de histórico documental. Os valores informados estão sujeitos a alteração sem aviso prévio de acordo com a cotação de mercado ou disponibilidade em estoque.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-liberty" />
                3. Propostas e Simulações de Financiamento
              </h3>
              <p>
                As simulações de parcelamento ou propostas enviadas pelo site têm caráter prévio e não garantem aprovação imediata de crédito junto às instituições financeiras parceiras. A concessão de crédito depende da análise cadastral e documental do cliente.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-liberty" />
                4. Propriedade Intelectual
              </h3>
              <p>
                Todas as fotos de veículos, marcas, logotipos e conteúdos apresentados neste site são de propriedade exclusiva da Liberty Car ou de seus parceiros autorizados. É proibida a reprodução sem autorização prévia por escrito.
              </p>
            </section>
          </>
        ) : (
          <>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-start gap-3">
              <IconUserCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block mb-0.5">
                  Conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)
                </span>
                Garantimos total transparência e segurança na coleta e tratamento das suas informações pessoais durante o processo de compra ou negociação de veículos.
              </div>
            </div>

            <section className="space-y-2">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                1. Quais Dados Coletamos
              </h3>
              <p>
                Coletamos apenas os dados necessários para ativarmos o atendimento personalizado e a simulação de compra, tais como:
              </p>
              <ul className="list-disc list-inside pl-2 space-y-1 text-neutral-600 text-xs">
                <li>Nome completo, e-mail e telefone/WhatsApp para contato.</li>
                <li>Dados cadastrais para análise de financiamento (quando solicitado).</li>
                <li>Informações do seu veículo usado (no caso de avaliação de troca).</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                2. Finalidade do Uso dos Dados
              </h3>
              <p>
                Seus dados são utilizados exclusivamente para:
              </p>
              <ul className="list-disc list-inside pl-2 space-y-1 text-neutral-600 text-xs">
                <li>Responder a propostas e dúvidas sobre veículos do estoque.</li>
                <li>Realizar simulações de crédito junto a bancos e financeiras credenciadas.</li>
                <li>Emitir documentos contratuais de compra e venda de veículos.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                3. Segurança e Compartilhamento
              </h3>
              <p>
                Não vendemos nem compartilhamos seus dados pessoais com terceiros para fins de marketing não solicitado. O compartilhamento ocorre estritamente com financeiras ou órgãos de trânsito necessários para a conclusão do seu negócio.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                4. Seus Direitos como Titular
              </h3>
              <p>
                Você possui o direito de solicitar a atualização, correção ou exclusão dos seus dados cadastrais a qualquer momento. Para isso, entre em contato diretamente com nossa equipe através do e-mail <strong>contato@libertycar.com.br</strong>.
              </p>
            </section>
          </>
        )}
      </div>

      {/* Footer do Modal */}
      <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
        <p className="text-[11px] text-neutral-500">
          Última atualização: Julho de 2026 — Liberty Car
        </p>
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors cursor-pointer shadow-sm"
        >
          Compreendi
        </button>
      </div>
    </Modal>
  )
}
