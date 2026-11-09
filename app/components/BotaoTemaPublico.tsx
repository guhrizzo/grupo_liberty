'use client'

import { IconMoon, IconSun } from '@tabler/icons-react'
import { useDashboardTheme } from './DashboardThemeProvider'

/** Alterna claro/escuro no site público (a preferência é a mesma do painel). */
export default function BotaoTemaPublico() {
  const { theme, toggleTheme } = useDashboardTheme()
  const escuro = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={escuro ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
      className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-50"
    >
      {escuro ? <IconSun size={17} stroke={2} /> : <IconMoon size={17} stroke={2} />}
    </button>
  )
}
