import { PublicPageLayout } from '@/components/public-page-layout'
import Link from 'next/link'

export default function TermsOfServicePage() {
  return (
    <PublicPageLayout>
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-12">
        <div className="prose prose-slate dark:prose-invert max-w-none bg-card border border-border rounded-2xl p-8 md:p-12 shadow-card">
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Last updated: January 16, 2026</p>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Teamy (&quot;the Service&quot;), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
            <p className="mt-4">
              <strong>For Educational Institutions:</strong> By using this Service on behalf of an educational institution, you represent that you have the authority to bind the institution to these Terms and that the institution agrees to comply with all applicable laws, including FERPA and COPPA.
            </p>
            <p className="mt-4">
              <strong>For Parents/Guardians:</strong> If you are a parent or guardian authorizing a child under 13 to use this Service, you consent to the collection, use, and disclosure of your child&apos;s information as described in our Privacy Policy and these Terms.
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
            
            <h3 className="text-lg font-semibold mb-3 mt-6">3.1 Account Creation</h3>
            <p>
              To use the Service, you must create an account using Google OAuth. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">3.2 Age Requirements and Parental Consent</h3>
            <p>
              <strong>Users 13 and Older:</strong> If you are 13 years of age or older, you may register for an account.
            </p>
            <p className="mt-4">
              <strong>Users Under 13:</strong> If you are under 13 years of age, you may only use this Service if:
            </p>
            <ul>
              <li>Your school or educational institution has authorized your use of the Service and provided consent on behalf of your parent/guardian as permitted under COPPA; or</li>
              <li>Your parent or legal guardian has provided verifiable consent for your use of the Service</li>
            </ul>
            <p className="mt-4">
              We comply with the Children&apos;s Online Privacy Protection Act (COPPA) and do not knowingly collect personal information from children under 13 without proper authorization or parental consent.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">3.3 Account Security</h3>
            <p>
              You agree to:
            </p>
            <ul>
              <li>Provide accurate and complete information when creating your account</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access to your account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">4. User Content</h2>
            <p>
              Users may upload and share content through the Service, including text, images, documents, and other materials (&quot;User Content&quot;). You are solely responsible for all User Content you upload, post, or share.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">4.1 Student Privacy in User Content</h3>
            <p>
              <strong>For Coaches, Teachers, and Team Leaders:</strong> When posting User Content that may contain student information, you agree to:
            </p>
            <ul>
              <li>Comply with FERPA requirements regarding the disclosure of education records</li>
              <li>Obtain appropriate consent before sharing personally identifiable student information</li>
              <li>Only share student information with authorized individuals who have legitimate educational interests</li>
              <li>Not post student education records or personally identifiable information in public areas</li>
              <li>Follow your institution&apos;s policies regarding student data privacy</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">4.2 Prohibited Content</h3>
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
              <li>Violates FERPA, COPPA, or other education privacy laws</li>
            </ul>
            <p className="mt-4">
              Uploading prohibited content may result in content removal, account suspension, or permanent ban, at our sole discretion.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">4.3 Monitoring and Enforcement</h3>
            <p>
              We do not pre-screen or approve User Content and are not liable for any User Content posted on the Service. However, we reserve the right (but are not obligated) to:
            </p>
            <ul>
              <li>Review, monitor, or remove content that violates these Terms</li>
              <li>Suspend or terminate accounts that violate these Terms</li>
              <li>Report illegal content or FERPA/COPPA violations to the proper authorities</li>
              <li>Notify educational institutions of policy violations by their users</li>
            </ul>
            <p className="mt-4">
              If you encounter inappropriate or illegal content, please report it immediately at{' '}
              <a href="mailto:teamysite@gmail.com" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                teamysite@gmail.com
              </a>.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">4.4 Liability</h3>
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
            <h2 className="font-heading text-xl font-semibold mb-4">6. Privacy and Data Protection</h2>
            <p>
              Your use of the Service is also governed by our{' '}
              <Link href="/privacy" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                Privacy Policy
              </Link>
              . Please review our Privacy Policy to understand our practices regarding your information.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">6.1 FERPA Compliance</h3>
            <p>
              When used by educational institutions, Teamy acts as a &quot;school official&quot; with &quot;legitimate educational interests&quot; under the Family Educational Rights and Privacy Act (FERPA). We agree to:
            </p>
            <ul>
              <li>Use education records only for authorized educational purposes</li>
              <li>Not disclose education records except as permitted by FERPA</li>
              <li>Maintain the confidentiality and security of education records</li>
              <li>Allow educational institutions to review, correct, and delete education records</li>
              <li>Return or destroy education records upon termination of service</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">6.2 COPPA Compliance</h3>
            <p>
              We comply with the Children&apos;s Online Privacy Protection Act (COPPA) by:
            </p>
            <ul>
              <li>Not knowingly collecting personal information from children under 13 without proper authorization</li>
              <li>Obtaining school authorization or verifiable parental consent before collecting information from children under 13</li>
              <li>Allowing parents to review, modify, or delete their child&apos;s information</li>
              <li>Not using student information for advertising or marketing purposes</li>
              <li>Collecting only the minimum information necessary to provide the Service</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">6.3 Educational Institution Responsibilities</h3>
            <p>
              Educational institutions using this Service agree to:
            </p>
            <ul>
              <li>Obtain necessary parental consent for students under 13, or provide school-based consent as permitted by COPPA</li>
              <li>Ensure compliance with their own FERPA obligations</li>
              <li>Notify parents of the use of third-party services as required</li>
              <li>Maintain appropriate data governance policies</li>
              <li>Train staff on proper handling of student data</li>
            </ul>
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
            <p className="mt-4">
              While we strive to maintain FERPA and COPPA compliance, we make no warranties regarding the absolute security of data or the prevention of unauthorized access. Educational institutions and users are responsible for implementing their own security measures and policies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">9. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL TEAMY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
            </p>
            <p className="mt-4">
              Educational institutions remain responsible for ensuring their own compliance with FERPA, COPPA, and other applicable laws. Our provision of a compliant platform does not transfer or eliminate the institution&apos;s legal obligations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">10. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to the Service at any time, with or without cause, including for violations of these Terms or applicable laws.
            </p>
            
            <h3 className="text-lg font-semibold mb-3 mt-6">10.1 Data Upon Termination</h3>
            <p>
              Upon termination of service:
            </p>
            <ul>
              <li>You may request export of your data within 30 days</li>
              <li>We will delete or return education records as directed by educational institutions</li>
              <li>Student data will be securely deleted in accordance with FERPA and COPPA requirements</li>
              <li>Some data may be retained as required by law or for legitimate business purposes</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">11. Changes to Terms</h2>
            <p>
              We may modify these Terms at any time. We will notify users of material changes by:
            </p>
            <ul>
              <li>Posting updated Terms on our website with a new &quot;Last Updated&quot; date</li>
              <li>Sending email notifications for significant changes</li>
              <li>For changes affecting student data or FERPA/COPPA compliance, providing advance notice to educational institutions</li>
            </ul>
            <p className="mt-4">
              Your continued use of the Service after changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">12. Contact Information</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <p className="mt-4">
              <strong>Email:</strong> teamysite@gmail.com
            </p>
            <p className="mt-4">
              For questions regarding FERPA or COPPA compliance, educational institutions and parents may contact us at the same email address.
            </p>
          </section>
        </div>
      </div>
    </PublicPageLayout>
  )
}
