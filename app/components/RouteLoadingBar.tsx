'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import LoadingBar from './LoadingBar'

export default function RouteLoadingBar() {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const originalPush = router.push.bind(router)
    const originalReplace = router.replace.bind(router)
    const originalRefresh = router.refresh.bind(router)

    const start = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setLoading(true), 120)
    }
    const stop = () => {
      if (timer) clearTimeout(timer)
      timer = null
      setLoading(false)
    }

    ;(router as any).push = (...args: any[]) => {
      start()
      const res = originalPush.apply(router, args as any)
      Promise.resolve(res).finally(stop)
      return res
    }
    ;(router as any).replace = (...args: any[]) => {
      start()
      const res = originalReplace.apply(router, args as any)
      Promise.resolve(res).finally(stop)
      return res
    }
    ;(router as any).refresh = (...args: any[]) => {
      start()
      const res = originalRefresh.apply(router, args as any)
      Promise.resolve(res).finally(stop)
      return res
    }

    return () => {
      if (timer) clearTimeout(timer)
      ;(router as any).push = originalPush
      ;(router as any).replace = originalReplace
      ;(router as any).refresh = originalRefresh
    }
  }, [router])

  useEffect(() => {
    setLoading(false)
  }, [pathname])

  if (!loading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-100">
      <LoadingBar className="h-1" />
    </div>
  )
}