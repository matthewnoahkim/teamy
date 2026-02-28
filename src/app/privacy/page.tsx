import Link from 'next/link'
import { PublicPageLayout } from '@/components/public-page-layout'
import { LegalDocumentShell } from '@/components/legal-document-shell'

const sections = [
  { id: 'overview', title: '1. Overview' },
  { id: 'information-we-collect', title: '2. Information We Collect' },
  { id: 'how-we-use-information', title: '3. How We Use Information' },
  { id: 'information-sharing', title: '4. Information Sharing' },
  { id: 'cookies', title: '5. Cookies and Similar Technologies' },
  { id: 'data-retention', title: '6. Data Retention' },
  { id: 'security', title: '7. Security' },
  { id: 'children-and-student-data', title: '8. Children and Student Data' },
  { id: 'choices-and-requests', title: '9. Your Choices and Requests' },
  { id: 'international-access', title: '10. International Access' },
  { id: 'changes', title: '11. Changes to This Policy' },
  { id: 'contact', title: '12. Contact' },
]

export default function PrivacyPolicyPage() {
  return (
    <PublicPageLayout>
      <LegalDocumentShell title="Privacy Policy" lastUpdated="February 25, 2026" sections={sections}>
          <section id="overview" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">1. Overview</h2>
            <p>
              This Privacy Policy explains how Teamy (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) collects, uses, shares, and stores information when you use the Service.
            </p>
            <p className="mt-4">
              This policy should be read together with our{' '}
              <Link href="/terms" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                Terms of Service
              </Link>
              .
            </p>
          </section>

          <section id="information-we-collect" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">2. Information We Collect</h2>
            <h3 className="text-lg font-semibold mb-3 mt-6">2.1 Information You Provide</h3>
            <ul>
              <li>Account information from Google sign-in (such as name, email address, and profile image)</li>
              <li>Club, team, role, roster, and membership information</li>
              <li>Content you create in the Service (announcements, calendar entries, tests, submissions, files, attendance, forms, and similar content)</li>
              <li>Tournament and hosting information you submit</li>
              <li>Billing metadata needed to manage subscriptions</li>
              <li>Messages sent through contact forms or support channels</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">2.2 Information Collected Automatically</h3>
            <ul>
              <li>Basic request and device metadata (for example IP address, browser type, and user agent)</li>
              <li>Session and preference cookies (for example auth session, theme, and last visited club)</li>
              <li>Application and API logs used for operations, debugging, abuse prevention, and security</li>
              <li>Usage analytics data from infrastructure and analytics providers</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">2.3 Payment Information</h3>
            <p>
              Payments are handled by Stripe. We do not store full payment card numbers in our database. We store limited billing and subscription metadata needed to operate paid features.
            </p>
          </section>

          <section id="how-we-use-information" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">3. How We Use Information</h2>
            <p>We use information to:</p>
            <ul>
              <li>Operate and provide the Service</li>
              <li>Authenticate users and manage accounts</li>
              <li>Support collaboration, communication, and tournament workflows</li>
              <li>Process subscriptions and billing</li>
              <li>Provide optional AI-assisted features when requested by users</li>
              <li>Monitor reliability, detect abuse, and improve security</li>
              <li>Analyze product usage and improve features</li>
              <li>Respond to support requests and legal obligations</li>
            </ul>
          </section>

          <section id="information-sharing" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">4. Information Sharing</h2>
            <p>We do not sell personal information for money. We may share information in these cases:</p>
            <ul>
              <li><strong>Within your organization:</strong> Data is visible to authorized users based on product permissions and roles</li>
              <li><strong>Public pages you publish:</strong> Certain tournament or organizer information may be publicly visible if you choose to publish it</li>
              <li><strong>Service providers:</strong> Providers for hosting, authentication, payments, email, analytics, and optional AI processing</li>
              <li><strong>Legal reasons:</strong> To comply with law, legal process, or valid government requests</li>
              <li><strong>Safety and abuse prevention:</strong> To protect rights, safety, and platform integrity</li>
              <li><strong>Business transfers:</strong> In connection with a merger, acquisition, financing, or asset sale</li>
            </ul>
            <p className="mt-4">
              Uploaded files may be accessible to anyone with a direct link if sharing links are distributed outside your organization.
            </p>
          </section>

          <section id="cookies" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">5. Cookies and Similar Technologies</h2>
            <p>
              We use cookies and similar technologies for authentication, settings, analytics, and product performance. Most browsers allow you to control cookies, but disabling cookies may impact functionality.
            </p>
          </section>

          <section id="data-retention" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">6. Data Retention</h2>
            <p>
              We keep information for as long as reasonably necessary to provide the Service and for legitimate business or legal purposes. Retention periods vary by data type and use case.
            </p>
            <ul>
              <li>Account and workspace data is typically retained while accounts are active</li>
              <li>Operational and security logs are retained for limited periods</li>
              <li>Billing metadata may be retained for accounting, audit, and legal obligations</li>
            </ul>
          </section>

          <section id="security" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">7. Security</h2>
            <p>
              We use administrative, technical, and organizational measures designed to protect information, including transport encryption and authentication controls.
            </p>
            <p className="mt-4">
              No method of transmission or storage is completely secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section id="children-and-student-data" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">8. Children and Student Data</h2>
            <p>
              Teamy may be used by schools, teams, and youth organizations. Organizations that use Teamy are responsible for providing required notices, permissions, and consents for their users, including minors, as required by applicable law.
            </p>
            <p className="mt-4">
              If you believe information from a child was provided without required authorization, contact us and we will review and address the request.
            </p>
          </section>

          <section id="choices-and-requests" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">9. Your Choices and Requests</h2>
            <p>
              Depending on your location and relationship to the data, you may request access, correction, export, or deletion of certain information.
            </p>
            <p className="mt-4">
              To submit a request, contact us at{' '}
              <a href="mailto:teamysite@gmail.com" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                teamysite@gmail.com
              </a>
              . We may need to verify your identity or authority before acting on a request.
            </p>
          </section>

          <section id="international-access" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">10. International Access</h2>
            <p>
              The Service is operated from the United States. If you access it from outside the U.S., your information may be processed and stored in the U.S. and other countries where our providers operate.
            </p>
          </section>

          <section id="changes" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post the current version on this page and update the &quot;Last updated&quot; date.
            </p>
          </section>

          <section id="contact" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">12. Contact</h2>
            <p>
              Questions about this Privacy Policy or privacy requests can be sent to:
            </p>
            <p className="mt-4">
              <strong>Email:</strong>{' '}
              <a href="mailto:teamysite@gmail.com" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                teamysite@gmail.com
              </a>
            </p>
          </section>
      </LegalDocumentShell>
    </PublicPageLayout>
  )
}
