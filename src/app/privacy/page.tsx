import { PublicPageLayout } from '@/components/public-page-layout'
import Link from 'next/link'

export default function PrivacyPolicyPage() {
  return (
    <PublicPageLayout>
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-12">
        <div className="prose prose-slate dark:prose-invert max-w-none bg-card border border-border rounded-2xl p-8 md:p-12 shadow-card">
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">1. Introduction</h2>
            <p>
              Teamy (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our team management platform. This Privacy Policy should be read in conjunction with our{' '}
              <Link href="/terms" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                Terms of Service
              </Link>
              .
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">2. Information We Collect</h2>
            <h3 className="text-lg font-semibold mb-3 mt-6">2.1 Information You Provide</h3>
            <p>We collect information that you provide directly to us, including:</p>
            <ul>
              <li>Account information (name, email address, profile picture) through Google OAuth</li>
              <li>Team and membership information</li>
              <li>Content you create (announcements, calendar events, test submissions)</li>
              <li>Financial data (expenses, purchase requests) if applicable</li>
              <li>Attendance records and check-in data</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">2.2 Automatically Collected Information</h3>
            <p>We automatically collect certain information when you use our Service:</p>
            <ul>
              <li>Usage data and interaction patterns</li>
              <li>Device information</li>
              <li>IP address and approximate location data</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve our Service</li>
              <li>Authenticate users and manage accounts</li>
              <li>Send notifications and communications related to your teams</li>
              <li>Process and manage team activities</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">4. Information Sharing</h2>
            <p>We do not sell, rent, or trade your personal information. We may share your information only with:</p>
            <ul>
              <li><strong>Within Your Teams:</strong> Information you post is visible to members of your teams</li>
              <li><strong>Service Providers:</strong> Trusted third-party services (Google OAuth, email delivery)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">5. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information, including encryption of data in transit and at rest, regular security assessments, and access controls.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of your personal information</li>
              <li><strong>Correction:</strong> Correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Portability:</strong> Export your data</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, please contact us at support@teamy.site.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">7. International Users</h2>
            <p>
              We do not target, market to, or knowingly collect personal information from individuals outside the United States. If we become aware that we have collected information from a non-U.S. resident, we will delete it promptly.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">8. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="mt-4">
              <strong>Email:</strong> support@teamy.site
            </p>
          </section>
        </div>
      </div>
    </PublicPageLayout>
  )
}
