import { PageLoading } from '@/components/ui/loading-spinner'
import { DelayedRender } from '@/components/ui/delayed-render'

export default function ClubLoading() {
  return (
    <DelayedRender
      delayMs={200}
      placeholder={<div className="min-h-screen bg-background grid-pattern" />}
    >
      <div className="min-h-screen bg-background grid-pattern flex items-center justify-center px-4 py-12">
        <PageLoading
          title="Loading Club"
          description="Fetching club data..."
          variant="orbit"
        />
      </div>
    </DelayedRender>
  )
}
