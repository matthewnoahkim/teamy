import { PublicPageLayout } from '@/components/public-page-layout'
import { Construction } from 'lucide-react'

export default function HelpCenterPage() {
  return (
    <PublicPageLayout>
      <div className="py-12 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="mb-8">
            <Construction className="h-16 w-16 text-teamy-primary mx-auto mb-6" />
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              Help Center
            </h1>
            <p className="text-xl text-muted-foreground">
              Under Construction
            </p>
          </div>
          <div className="p-8 rounded-2xl bg-card border border-border shadow-card">
            <p className="text-muted-foreground">
              We&apos;re building a comprehensive help center to assist you with all your questions.
              Check back soon!
            </p>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  )
}

