'use client'

import { useState } from 'react'
import LegalTermsModal, { LegalTab } from '@/app/components/LegalTermsModal'
import { IconFileText, IconShieldCheck } from '@tabler/icons-react'

export default function FooterLegalLinks() {
  const [modalOpen, setModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<LegalTab>('termos')

  const openModal = (tab: LegalTab) => {
    setActiveTab(tab)
    setModalOpen(true)
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <button
          onClick={() => openModal('termos')}
          className="inline-flex items-center gap-1.5 hover:text-liberty transition-colors cursor-pointer group"
          title="Ver Termos de Uso"
        >
          <IconFileText size={14} className="text-neutral-400 group-hover:text-liberty transition-colors" />
          <span>Termos de Uso</span>
        </button>
        <span className="text-neutral-300">•</span>
        <button
          onClick={() => openModal('privacidade')}
          className="inline-flex items-center gap-1.5 hover:text-liberty transition-colors cursor-pointer group"
          title="Ver Política de Privacidade (LGPD)"
        >
          <IconShieldCheck size={14} className="text-neutral-400 group-hover:text-liberty transition-colors" />
          <span>Privacidade</span>
        </button>
      </div>

      <LegalTermsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultTab={activeTab}
      />
    </>
  )
}
