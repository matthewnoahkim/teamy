import { PageLoading } from '@/components/ui/loading-spinner'

export default function ESLoading() {
  return (
    <div className="min-h-screen bg-background grid-pattern flex items-center justify-center px-4 py-12">
      <PageLoading
        title="Loading ES Portal"
        description="Fetching your events..."
        variant="orbit"
      />
    </div>
  )
}
