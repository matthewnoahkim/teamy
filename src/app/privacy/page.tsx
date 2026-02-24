import Link from 'next/link'
import { PublicPageLayout } from '@/components/public-page-layout'

export default function PrivacyPolicyPage() {
  return (
    <PublicPageLayout>
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-12">
        <div className="prose prose-slate dark:prose-invert max-w-none bg-card border border-border rounded-2xl p-8 md:p-12 shadow-card">
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: February 24, 2026</p>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">1. Introduction</h2>
            <p>
              Teamy (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our team management platform. This Privacy Policy should be read in conjunction with our{' '}
              <Link href="/terms" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                Terms of Service
              </Link>
              .
            </p>
            <p className="mt-4">
              When the Service is used in educational settings, we aim to handle data in a way that is consistent with the Family Educational Rights and Privacy Act (FERPA) and the Children&apos;s Online Privacy Protection Act (COPPA). We do not sign separate agreements with schools; educational institutions remain responsible for their own compliance with applicable laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">2. COPPA Compliance (Children Under 13)</h2>
            <h3 className="text-lg font-semibold mb-3 mt-6">2.1 Age Requirements</h3>
            <p>
              Our Service is not directed to children under 13 years of age, and we do not knowingly collect personal information from children under 13 without verifiable parental consent as required by COPPA.
            </p>
            
            <h3 className="text-lg font-semibold mb-3 mt-6">2.2 School Authorization</h3>
            <p>
              When Teamy is used in an educational context (such as Science Olympiad teams), schools and educational institutions may provide consent on behalf of parents for the collection of personal information from students under 13, as permitted under COPPA. In such cases:
            </p>
            <ul>
              <li>The school or educational institution acts as the parent&apos;s agent in providing consent</li>
              <li>We collect only the minimum information necessary to provide the Service</li>
              <li>Parents retain the right to review their child&apos;s information and request deletion</li>
              <li>We do not use student information for targeted advertising or marketing</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">2.3 Parental Rights</h3>
            <p>
              Parents have the right to:
            </p>
            <ul>
              <li>Review the personal information collected from their child</li>
              <li>Request that we delete their child&apos;s personal information</li>
              <li>Refuse to allow further collection or use of their child&apos;s information</li>
              <li>Contact us at{' '}
                <a href="mailto:teamysite@gmail.com" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                  teamysite@gmail.com
                </a>{' '}
                to exercise these rights
              </li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">2.4 Information Collected from Children</h3>
            <p>
              When use by a child under 13 is authorized (e.g., by school or parent), the same types of data as for other users may be collected in the course of using the Service: name, email, and profile picture from Google sign-in; club/team membership; content they create (e.g., test submissions, attendance check-ins). We do not collect more than is reasonably necessary to provide the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">3. FERPA Compliance (Education Records)</h2>
            <h3 className="text-lg font-semibold mb-3 mt-6">3.1 Educational Records Protection</h3>
            <p>
              When the Service is used by schools, we handle data in a manner intended to be consistent with FERPA. We do not sign separate &quot;school official&quot; agreements. Schools remain responsible for their own FERPA compliance and for determining who has access to education records within the Service.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">3.2 Use of Education Records</h3>
            <p>
              Education records and personally identifiable information from education records may only be used for:
            </p>
            <ul>
              <li>Providing the Service to the educational institution</li>
              <li>Supporting the educational institution&apos;s team management and educational activities</li>
              <li>Maintaining, developing, and improving the Service for educational purposes</li>
            </ul>
            <p className="mt-4">
              We will not:
            </p>
            <ul>
              <li>Sell or rent student education records</li>
              <li>Use education records for targeted advertising or marketing to students</li>
              <li>Create profiles of students for non-educational purposes</li>
              <li>Disclose education records except as permitted by FERPA or with appropriate consent</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">3.3 Educational Institution Control</h3>
            <p>
              Educational institutions maintain control over their students&apos; education records and may:
            </p>
            <ul>
              <li>Access, review, and export all education records</li>
              <li>Request correction of inaccurate records</li>
              <li>Request deletion of records upon termination of service</li>
              <li>Determine access permissions within their organization</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">3.4 Data Retention and Deletion</h3>
            <p>
              We retain education records only as long as necessary to provide the Service or as required by law. Upon request by the educational institution or at the end of the service relationship, we will securely delete or return all education records as directed by the institution.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">4. Information We Collect</h2>
            <h3 className="text-lg font-semibold mb-3 mt-6">4.1 Information You Provide</h3>
            <p>We collect information you provide when using the Service, including:</p>
            <ul>
              <li>Account information (name, email address, profile picture) when you sign in with Google OAuth</li>
              <li>Club and team membership, roles, and related data you add</li>
              <li>Content you create (announcements, calendar events, test answers, form responses, etc.)</li>
              <li>Expenses, event budgets, and purchase requests you submit</li>
              <li>Attendance check-ins</li>
              <li>Information you submit through our contact form (name, email, subject, message) - we use this to respond and do not store it in our primary database; it may be sent to our internal notification systems</li>
              <li>Tournament hosting requests and tournament-related information</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">4.2 Automatically Collected Information</h3>
            <p>When you use the Service we or our hosting/analytics providers may receive:</p>
            <ul>
              <li>Usage data (e.g., page views) via Vercel Analytics</li>
              <li>Information your browser sends (e.g., IP address, user agent) as part of normal web requests</li>
              <li>Session and preference data stored in cookies (e.g., sign-in session, theme preference, last-visited club)</li>
              <li>Logs of API requests and certain in-app actions for operation and security</li>
            </ul>
            <p className="mt-4">
              We do not use this data to build advertising profiles or for behavioral advertising.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">4.3 Payment Information</h3>
            <p>
              Payments are processed by Stripe. We do not store your full credit card number. We store your Stripe customer ID, subscription status, and related billing metadata (e.g., subscription type, end date) to manage your account. For how Stripe handles payment data, see{' '}
              <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                Stripe&apos;s Privacy Policy
              </a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">5. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, operate, and improve the Service</li>
              <li>Authenticate you and manage your account (e.g., via Google OAuth, session cookies)</li>
              <li>Send emails and in-app communications related to your clubs, tournaments, and use of the Service (e.g., via Resend)</li>
              <li>Process payments and manage subscriptions (via Stripe)</li>
              <li>Provide optional AI-assisted features (test grading, roster suggestions, document import/parsing, and AI chat). When you use these, the relevant content (e.g., test responses, member/roster data, document text) is sent to OpenAI&apos;s API for processing. Per OpenAI&apos;s policy, API data is not used to train their models. See{' '}
                <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                  OpenAI&apos;s Privacy Policy
                </a>.
              </li>
              <li>Respond to contact form and other inquiries</li>
              <li>Comply with law and protect our rights (e.g., fraud prevention, security)</li>
              <li>Understand usage (e.g., via Vercel Analytics) to improve the Service</li>
            </ul>
            <p className="mt-4">
              <strong>Student Data:</strong> Student information is used solely for educational purposes and to provide the Service. We do not use student personal information for advertising or marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">6. Information Sharing</h2>
            <p>We do not sell or rent your personal information. We may share it only as follows:</p>
            <ul>
              <li><strong>Public tournament pages:</strong> Approved and published tournaments may display organizer-provided information (such as director name and email) for registration and communication purposes</li>
              <li><strong>Within the Service:</strong> Content you create (e.g., announcements, roster data) is visible to other members of your clubs/teams and, where applicable, to tournament staff and participants as needed for tournament operation</li>
              <li><strong>Uploaded files:</strong> Files uploaded to the Service are hosted at URL paths and may be accessible to anyone who has the link</li>
              <li><strong>Service providers we use to run the Service:</strong> Google (sign-in), Stripe (payments), Resend (transactional email), OpenAI (AI features), Vercel (hosting and analytics). They process data on our behalf to provide these services</li>
              <li><strong>Contact form:</strong> Submissions may be sent to our internal notification systems (e.g., webhooks) so we can respond; we do not store them in our main database</li>
              <li><strong>Law and safety:</strong> When required by law, court order, or to protect our or others&apos; rights and safety</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">7. Data Security</h2>
            <p>
              We use practices intended to protect your information, including:
            </p>
            <ul>
              <li>Encryption in transit (HTTPS) and, where applicable, at rest (e.g., database)</li>
              <li>Authentication via Google OAuth and session management (e.g., secure cookies)</li>
              <li>Access control so that data is visible only to authorized users (e.g., club members, tournament staff) as designed by the product</li>
              <li>Input validation and rate limiting on APIs where implemented</li>
              <li>Hashing of sensitive codes (e.g., invite codes, attendance codes) where applicable</li>
              <li>Content Security Policy and other security headers where configured</li>
              <li>Logging of certain operations (e.g., test changes, API use) for operation and security</li>
            </ul>
            <p className="mt-4">
              We do not guarantee that the Service or our systems are immune to unauthorized access, and we do not maintain a formal incident-response program beyond responding to issues as we become aware of them. In the event of a data breach, we will comply with applicable breach notification laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">8. Data Retention</h2>
            <p>
              We retain data for as long as needed to provide the Service and as required by law. In practice:
            </p>
            <ul>
              <li><strong>Account and user-generated data:</strong> Kept while your account is active; you may request deletion by contacting us</li>
              <li><strong>Logs (e.g., API, actions):</strong> Kept for a limited time for operation and security</li>
              <li><strong>Payment-related data:</strong> Subscription and billing metadata retained as needed; we rely on Stripe for payment processing and their retention policies apply to payment details</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">9. Your Rights</h2>
            <p>You may:</p>
            <ul>
              <li><strong>Access/correction:</strong> Request a copy of your data or correction of inaccuracies by contacting us</li>
              <li><strong>Deletion:</strong> Request deletion of your account and associated data; we will do so as reasonably practicable and where not prevented by law</li>
              <li><strong>Portability:</strong> Request an export of your data where feasible; we do not guarantee a specific format</li>
            </ul>
            
            <h3 className="text-lg font-semibold mb-3 mt-6">9.1 Student and Parent Rights</h3>
            <p>
              For students and their parents/guardians, additional rights include:
            </p>
            <ul>
              <li>Review education records and personal information</li>
              <li>Request correction of inaccurate education records</li>
              <li>Limit disclosure of directory information</li>
              <li>File complaints with the U.S. Department of Education regarding FERPA violations</li>
              <li>Withdraw consent for collection of information from children under 13 (where applicable)</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">9.2 Exercising Your Rights</h3>
            <p className="mt-4">
              To exercise these rights, please contact us at{' '}
              <a href="mailto:teamysite@gmail.com" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                teamysite@gmail.com
              </a>
              . For students, a parent/guardian or school administrator may contact us on their behalf. We aim to respond to legitimate requests within a reasonable time (e.g., 30 days).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">10. Cookies and Tracking</h2>
            <p>
              We use cookies to keep you signed in (session cookie), remember preferences (e.g., theme, last-visited club), and for analytics (e.g., Vercel Analytics). We do not use cookies for third-party advertising or cross-site tracking. You can change cookie settings in your browser.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">11. International Users</h2>
            <p>
              Our Service is operated from the United States and is primarily intended for U.S.-based teams. If you access the Service from outside the United States, your information may be processed and stored in the United States.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">12. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. The current version will be posted here with an updated &quot;Last updated&quot; date. We may notify users of significant changes by email when practicable. Continued use of the Service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">13. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, our privacy practices, or wish to exercise your rights, please contact us at:
            </p>
            <p className="mt-4">
              <strong>Email:</strong>{' '}
              <a href="mailto:teamysite@gmail.com" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                teamysite@gmail.com
              </a>
            </p>
            <p className="mt-4">
              For FERPA-related inquiries, educational institutions may contact us directly. For COPPA-related inquiries, parents may contact us to review, modify, or delete their child&apos;s information.
            </p>
            <p className="mt-4">
              To file a complaint regarding FERPA compliance, you may contact:
            </p>
            <p className="mt-2">
              Family Policy Compliance Office<br />
              U.S. Department of Education<br />
              400 Maryland Avenue, SW<br />
              Washington, DC 20202
            </p>
          </section>
        </div>
      </div>
    </PublicPageLayout>
  )
}
