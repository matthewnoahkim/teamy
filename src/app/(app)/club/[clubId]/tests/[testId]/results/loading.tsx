import { PageLoading } from '@/components/ui/loading-spinner'

export default function ClubTestResultsLoading() {
  return (
    <div className="min-h-screen bg-background grid-pattern flex items-center justify-center px-4 py-12">
      <PageLoading
        title="Loading Results"
        description="Fetching test results..."
        variant="orbit"
      />
    </div>
  )
}
