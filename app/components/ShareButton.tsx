'use client'

import { useState } from 'react'
import { IconShare3, IconCheck } from '@tabler/icons-react'
import { useToast } from './ui'

interface ShareButtonProps {
  url: string
  title: string
  text?: string
  className?: string
  /** Rótulo exibido. Default 'Compartilhar'. */
  label?: string
}

/**
 * Botão de compartilhamento. Usa a Web Share API quando disponível
 * (mobile, em HTTPS) e cai para clipboard em desktop/servidores sem API.
 */
export default function ShareButton({ url, title, text, className, label = 'Compartilhar' }: ShareButtonProps) {
  const [shared, setShared] = useState(false)
  const toast = useToast()

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    // Aceita URL relativa ou absoluta. Para o clipboard/share, é melhor absoluto.
    const fullUrl = (() => {
      try {
        return new URL(url, window.location.origin).toString()
      } catch {
        return url
      }
    })()

    const shareData = {
      title,
      text: text || title,
      url: fullUrl,
    }

    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        await navigator.share(shareData)
        return
      }
    } catch (err) {
      // Usuário cancelou ou falhou; cai para o clipboard abaixo.
      if ((err as { name?: string })?.name === 'AbortError') return
    }

    try {
      await navigator.clipboard.writeText(fullUrl)
      setShared(true)
      toast.success('Link copiado para a área de transferência.')
      setTimeout(() => setShared(false), 1800)
    } catch {
      toast.error('Não foi possível copiar o link.')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${label}: ${title}`}
      className={className}
    >
      {shared ? <IconCheck size={12} stroke={2.5} /> : <IconShare3 size={12} stroke={2.5} />}
      {label}
    </button>
  )
}
