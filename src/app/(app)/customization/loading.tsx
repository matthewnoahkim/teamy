import { PageLoading } from '@/components/ui/loading-spinner'

export default function CustomizationLoading() {
  return (
    <div className="min-h-screen bg-background grid-pattern flex items-center justify-center px-4 py-12">
      <PageLoading
        title="Loading Customization"
        description="Fetching your preferences..."
        variant="orbit"
      />
    </div>
  )
}
