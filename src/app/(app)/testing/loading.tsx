import { PageLoading } from '@/components/ui/loading-spinner'

export default function TestingLoading() {
  return (
    <div className="min-h-screen bg-background grid-pattern flex items-center justify-center px-4 py-12">
      <PageLoading
        title="Loading Testing Portal"
        description="Fetching your tests..."
        variant="orbit"
      />
    </div>
  )
}
