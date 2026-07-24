import { Skeleton } from './components/ui'

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-neutral-50">
      <div className="w-full max-w-md space-y-4">
        <Skeleton className="h-8 w-3/4 mx-auto" />
        <Skeleton className="h-3 w-1/2 mx-auto" />
        <div className="flex justify-center pt-4">
          <Skeleton className="h-1 w-48" />
        </div>
      </div>
    </div>
  )
}
