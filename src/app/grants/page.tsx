import { PublicPageLayout } from '@/components/public-page-layout'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { GrantForm } from '@/components/grant-form'

export default function GrantsPage() {
  return (
    <PublicPageLayout>
      <div className="py-12 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              Grants
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              All of our profit will be donated back to Science Olympiad teams through grants.
            </p>
          </div>

          {/* Eligibility & How It Works - Combined */}
          <div className="p-8 rounded-2xl bg-card border border-border shadow-card mb-8">
            <h2 className="font-heading text-xl font-bold text-foreground mb-4">Eligibility & How It Works</h2>
            
            <div className="space-y-3 text-muted-foreground mb-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-teamy-primary flex-shrink-0 mt-0.5" />
                <span>You must be a club admin on Teamy.</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-teamy-primary flex-shrink-0 mt-0.5" />
                <span>Your club must be active on Teamy for at least 1 month.</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-teamy-primary flex-shrink-0 mt-0.5" />
                <span>Priority will go towards underfunded or developing clubs.</span>
              </div>
            </div>

            <div className="border-t pt-4 text-sm text-muted-foreground space-y-2">
              <p>1. Submit your grant application through the form below.</p>
              <p>2. Our team will review your application and verify the information.</p>
              <p>3. If approved, we will contact you to arrange the grant disbursement.</p>
              <p>4. Grants are distributed based on available funds and need.</p>
            </div>
          </div>

          {/* Grant Application Form */}
          <div className="p-8 rounded-2xl bg-card border border-border shadow-card">
            <h2 className="font-heading text-xl font-bold text-foreground mb-6">Grant Application</h2>
            <GrantForm />
          </div>

          {/* Questions Link */}
          <div className="mt-8 text-center">
            <p className="text-muted-foreground">
              Have questions about the grant program?{' '}
              <Link href="/contact" className="text-teamy-primary hover:underline font-semibold">
                Click here to contact us
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  )
}
