import { PageLoading } from '@/components/ui/loading-spinner'

export default function ClubLoading() {
  return (
    <div className="min-h-screen bg-background grid-pattern flex items-center justify-center px-4 py-12">
      <PageLoading
        title="Loading Club"
        description="Fetching club data..."
        variant="orbit"
      />
    </div>
  )
}

