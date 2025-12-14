import { PublicPageLayout } from '@/components/public-page-layout'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TermsOfServicePage() {
  return (
    <PublicPageLayout>
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-12">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-medium">Back to home</span>
        </Link>

        <div className="prose prose-slate dark:prose-invert max-w-none bg-card border border-border rounded-2xl p-8 md:p-12 shadow-card">
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Teamy (&quot;the Service&quot;), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">2. Description of Service</h2>
            <p>
              Teamy is a web-based platform designed to help teams manage their activities, including but not limited to:
            </p>
            <ul>
              <li>Team and member management</li>
              <li>Event scheduling and calendar management</li>
              <li>Announcements and communication</li>
              <li>Attendance tracking</li>
              <li>Financial management</li>
              <li>Test administration and grading</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">3. User Accounts</h2>
            <p>
              To use the Service, you must create an account using Google OAuth. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">4. User Content</h2>
            <p>
              Users may upload and share content through the Service, including text, images, documents, and other materials (&quot;User Content&quot;). You are solely responsible for all User Content you upload, post, or share.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">Prohibited Content</h3>
            <p>You agree not to upload, post, or share any content that:</p>
            <ul>
              <li>Is sexually explicit, suggestive, or pornographic</li>
              <li>Depicts or targets minors in an inappropriate manner</li>
              <li>Contains hate speech, harassment, or threats</li>
              <li>Includes violence, gore, or self-harm content</li>
              <li>Is illegal, infringing, or violates any applicable law or regulation</li>
              <li>Contains malware, phishing attempts, stolen data, or harmful code</li>
              <li>Violates privacy rights or shares personal information without consent</li>
              <li>Is abusive, discriminatory, or otherwise objectionable</li>
              <li>Violates competition rules (e.g., copyrighted tests, exams)</li>
            </ul>
            <p className="mt-4">
              Uploading prohibited content may result in content removal, account suspension, or permanent ban, at our sole discretion.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">Monitoring and Enforcement</h3>
            <p>
              We do not pre-screen or approve User Content and are not liable for any User Content posted on the Service. However, we reserve the right (but are not obligated) to:
            </p>
            <ul>
              <li>Review, monitor, or remove content that violates these Terms</li>
              <li>Suspend or terminate accounts that violate these Terms</li>
              <li>Report illegal content to the proper authorities</li>
            </ul>
            <p className="mt-4">
              If you encounter inappropriate or illegal content, please report it immediately at{' '}
              <a href="mailto:support@teamy.site" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                support@teamy.site
              </a>.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">Liability</h3>
            <p>
              By using the Service, you acknowledge that we are not responsible for User Content created by others and you agree not to hold us liable for any damages arising from such content.
            </p>
            <p className="mt-4">
              You understand that all User Content is the responsibility of the user who posted it.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">5. Acceptable Use</h2>
            <p>In addition to the content restrictions above, you agree not to:</p>
            <ul>
              <li>Use the Service for any illegal purpose or in violation of any laws</li>
              <li>Transmit any harmful code, viruses, or malicious software</li>
              <li>Attempt to gain unauthorized access to the Service or related systems</li>
              <li>Interfere with or disrupt the Service or servers connected to the Service</li>
              <li>Harass, abuse, or harm other users</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">6. Privacy</h2>
            <p>
              Your use of the Service is also governed by our{' '}
              <Link href="/privacy" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                Privacy Policy
              </Link>
              . Please review our Privacy Policy to understand our practices regarding your information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">7. Geographic Restrictions</h2>
            <p>
              This service is intended for use only by individuals located in the United States. By accessing or using the service, you represent and warrant that you are a U.S. resident. We do not permit access to users outside the United States.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">8. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">9. Contact Information</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at:
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
