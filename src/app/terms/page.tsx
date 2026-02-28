import Link from 'next/link'
import { PublicPageLayout } from '@/components/public-page-layout'
import { LegalDocumentShell } from '@/components/legal-document-shell'

const sections = [
  { id: 'acceptance', title: '1. Acceptance of Terms' },
  { id: 'description-of-service', title: '2. Description of Service' },
  { id: 'accounts-and-eligibility', title: '3. Accounts and Eligibility' },
  { id: 'user-content-and-conduct', title: '4. User Content and Conduct' },
  { id: 'privacy-and-legal', title: '5. Privacy and Legal Responsibilities' },
  { id: 'subscriptions-and-payments', title: '6. Subscriptions and Payments' },
  { id: 'third-party-services', title: '7. Third-Party Services' },
  { id: 'intellectual-property', title: '8. Intellectual Property' },
  { id: 'service-availability', title: '9. Service Availability' },
  { id: 'warranties', title: '10. Disclaimer of Warranties' },
  { id: 'limitation-of-liability', title: '11. Limitation of Liability' },
  { id: 'indemnification', title: '12. Indemnification' },
  { id: 'termination', title: '13. Termination' },
  { id: 'governing-law', title: '14. Governing Law' },
  { id: 'changes-to-terms', title: '15. Changes to These Terms' },
  { id: 'contact', title: '16. Contact' },
]

export default function TermsOfServicePage() {
  return (
    <PublicPageLayout>
      <LegalDocumentShell title="Terms of Service" lastUpdated="February 25, 2026" sections={sections}>
          <section id="acceptance" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Teamy (&quot;Service&quot;), you agree to these Terms of Service. If you do not agree, do not use the Service.
            </p>
            <p className="mt-4">
              These Terms are provided for contractual clarity and are not legal advice. You are responsible for obtaining your own legal advice for your specific situation.
            </p>
          </section>

          <section id="description-of-service" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">2. Description of Service</h2>
            <p>
              Teamy is a web platform for Science Olympiad organizations and related activities. Features may include:
            </p>
            <ul>
              <li>Club, roster, and role management</li>
              <li>Announcements, calendar, attendance, and files</li>
              <li>Tests, grading workflows, and optional AI-assisted tools</li>
              <li>Tournament hosting, registration, and event operations</li>
              <li>Billing and subscription features</li>
            </ul>
            <p className="mt-4">
              Features may change over time. We may add, remove, or modify features without notice.
            </p>
          </section>

          <section id="accounts-and-eligibility" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">3. Accounts and Eligibility</h2>
            <h3 className="text-lg font-semibold mb-3 mt-6">3.1 Account Access</h3>
            <p>
              Accounts are accessed through Google OAuth. You are responsible for activity under your account and for keeping your account access secure.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">3.2 Eligibility</h3>
            <p>
              You may use the Service only if you can form a binding agreement under applicable law. If you are under the age of legal majority in your jurisdiction, you may use the Service only with permission and supervision from a parent, guardian, teacher, coach, or other authorized adult.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">3.3 Organizational Authority</h3>
            <p>
              If you use the Service on behalf of a school, team, district, nonprofit, or other organization, you represent that you are authorized to bind that organization to these Terms.
            </p>
          </section>

          <section id="user-content-and-conduct" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">4. User Content and Conduct</h2>
            <p>
              You are responsible for all content you create, upload, share, or otherwise make available through the Service (&quot;User Content&quot;).
            </p>
            <p className="mt-4">
              You agree not to use the Service to upload, post, transmit, or distribute content that:
            </p>
            <ul>
              <li>Is illegal, infringing, or violates another person&apos;s rights</li>
              <li>Contains malware, phishing, or other harmful code</li>
              <li>Contains harassment, threats, hate speech, or sexual exploitation</li>
              <li>Discloses sensitive personal information without authorization</li>
              <li>Attempts to bypass security or access controls</li>
            </ul>
            <p className="mt-4">
              We may remove content or suspend accounts that violate these Terms.
            </p>
          </section>

          <section id="privacy-and-legal" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">5. Privacy and Legal Responsibilities</h2>
            <p>
              Your use of the Service is also governed by our{' '}
              <Link href="/privacy" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                Privacy Policy
              </Link>
              .
            </p>
            <p className="mt-4">
              You are responsible for complying with laws and regulations that apply to your use of the Service, including laws related to student data, minors, privacy, records, and data disclosure obligations.
            </p>
            <p className="mt-4">
              We provide software tools. We do not represent that your use of the Service by itself makes you compliant with any specific law or regulatory framework.
            </p>
          </section>

          <section id="subscriptions-and-payments" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">6. Subscriptions and Payments</h2>
            <p>
              Some features may require payment. By purchasing a paid feature, you agree to pay the fees shown at checkout.
            </p>
            <p className="mt-4">
              Payments are processed by Stripe. We do not store full payment card numbers on our servers.
            </p>
            <p className="mt-4">
              Unless otherwise stated, fees are non-refundable.
            </p>
          </section>

          <section id="third-party-services" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">7. Third-Party Services</h2>
            <p>
              The Service relies on third-party providers, including providers for authentication, hosting, email delivery, payment processing, analytics, and optional AI features.
            </p>
            <p className="mt-4">
              Your use of third-party services is also subject to those providers&apos; terms and privacy policies.
            </p>
          </section>

          <section id="intellectual-property" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">8. Intellectual Property</h2>
            <p>
              We retain all rights in the Service and its underlying software, content, and branding. You retain ownership of your User Content.
            </p>
            <p className="mt-4">
              You grant us a non-exclusive, worldwide, royalty-free license to host, store, reproduce, and display User Content solely to operate, secure, and improve the Service.
            </p>
          </section>

          <section id="service-availability" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">9. Service Availability</h2>
            <p>
              We may modify, suspend, or discontinue all or part of the Service at any time. We do not guarantee uninterrupted or error-free operation.
            </p>
          </section>

          <section id="warranties" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">10. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE,&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </section>

          <section id="limitation-of-liability" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">11. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, TEAMY WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUES, DATA, OR GOODWILL.
            </p>
            <p className="mt-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, TEAMY&apos;S TOTAL LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO TEAMY IN THE 12 MONTHS BEFORE THE CLAIM OR (B) USD $100.
            </p>
          </section>

          <section id="indemnification" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">12. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Teamy and its affiliates, officers, directors, employees, and agents from claims, liabilities, damages, losses, and expenses (including reasonable attorneys&apos; fees) arising from your use of the Service, User Content, or violation of these Terms.
            </p>
          </section>

          <section id="termination" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">13. Termination</h2>
            <p>
              We may suspend or terminate access to the Service at any time for any reason, including suspected violations of these Terms or unlawful activity.
            </p>
            <p className="mt-4">
              You may request account deletion by contacting us. We may retain certain information as required by law, for security, fraud prevention, dispute resolution, or backup integrity.
            </p>
          </section>

          <section id="governing-law" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">14. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the United States, without regard to conflict-of-law principles.
            </p>
          </section>

          <section id="changes-to-terms" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">15. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. The current version will be posted on this page with an updated &quot;Last updated&quot; date. Continued use of the Service after changes means you accept the revised Terms.
            </p>
          </section>

          <section id="contact" className="mb-8 scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold mb-4">16. Contact</h2>
            <p>
              Questions about these Terms can be sent to:
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
