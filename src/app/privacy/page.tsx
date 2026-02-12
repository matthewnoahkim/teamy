import { PublicPageLayout } from '@/components/public-page-layout'
import Link from 'next/link'

export default function PrivacyPolicyPage() {
  return (
    <PublicPageLayout>
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-12">
        <div className="prose prose-slate dark:prose-invert max-w-none bg-card border border-border rounded-2xl p-8 md:p-12 shadow-card">
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: January 16, 2026</p>

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
              <strong>Teamy is FERPA and COPPA compliant.</strong> We are committed to protecting student privacy and complying with all applicable federal education privacy laws, including the Family Educational Rights and Privacy Act (FERPA) and the Children&apos;s Online Privacy Protection Act (COPPA).
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
              <li>Contact us at teamysite@gmail.com to exercise these rights</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">2.4 Information Collected from Children</h3>
            <p>
              When authorized by a school or with verifiable parental consent, we may collect from children under 13:
            </p>
            <ul>
              <li>Name and email address (through Google OAuth with school/parent authorization)</li>
              <li>Profile picture (optional)</li>
              <li>Team membership and event participation information</li>
              <li>Test submissions and scores (for educational purposes only)</li>
              <li>Attendance records</li>
            </ul>
            <p className="mt-4">
              We do not collect more information than is reasonably necessary for participation in the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">3. FERPA Compliance (Education Records)</h2>
            <h3 className="text-lg font-semibold mb-3 mt-6">3.1 Educational Records Protection</h3>
            <p>
              When Teamy is used by educational institutions, we act as a &quot;school official&quot; with &quot;legitimate educational interests&quot; as defined by FERPA. We protect education records in accordance with FERPA requirements.
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
            <p>We collect information that you provide directly to us, including:</p>
            <ul>
              <li>Account information (name, email address, profile picture) through Google OAuth</li>
              <li>Team and membership information</li>
              <li>Content you create (announcements, calendar events, test submissions)</li>
              <li>Financial data (expenses, purchase requests) if applicable</li>
              <li>Attendance records and check-in data</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">4.2 Automatically Collected Information</h3>
            <p>We automatically collect certain information when you use our Service:</p>
            <ul>
              <li>Usage data and interaction patterns</li>
              <li>Device information</li>
              <li>IP address and approximate location data</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
            <p className="mt-4">
              <strong>Note:</strong> We do not use tracking technologies to build advertising profiles of students or for behavioral advertising purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">5. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve our Service</li>
              <li>Authenticate users and manage accounts</li>
              <li>Send notifications and communications related to your teams</li>
              <li>Process and manage team activities</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-4">
              <strong>Student Data:</strong> Student information is used solely for educational purposes and to provide the Service. We do not use student personal information for advertising or marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">6. Information Sharing</h2>
            <p>We do not sell, rent, or trade your personal information. We may share your information only with:</p>
            <ul>
              <li><strong>Within Your Teams:</strong> Information you post is visible to members of your teams</li>
              <li><strong>Service Providers:</strong> Trusted third-party services (Google OAuth, email delivery) that are contractually obligated to protect your data and use it only for providing services to us</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>School Officials:</strong> With educational institutions for students under their authority, as permitted by FERPA</li>
            </ul>
            <p className="mt-4">
              <strong>Third-Party Service Providers:</strong> Any third-party service providers who handle student data are carefully vetted and contractually required to:
            </p>
            <ul>
              <li>Maintain the confidentiality and security of student data</li>
              <li>Use student data only for the purpose of providing services to us</li>
              <li>Comply with FERPA and COPPA requirements</li>
              <li>Return or securely destroy student data upon termination of services</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">7. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information, including:
            </p>
            <ul>
              <li>Encryption of data in transit (TLS/SSL) and at rest</li>
              <li>Regular security assessments and audits</li>
              <li>Access controls and authentication measures</li>
              <li>Secure data centers with physical security measures</li>
              <li>Employee training on data privacy and security</li>
              <li>Incident response procedures for data breaches</li>
            </ul>
            <p className="mt-4">
              <strong>Student Data Security:</strong> We take additional measures to protect student data, including restricting access to only those personnel with legitimate educational interests and implementing enhanced monitoring for unauthorized access attempts.
            </p>
            <p className="mt-4">
              In the event of a data breach involving student information, we will promptly notify affected educational institutions and comply with all applicable breach notification requirements.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of your personal information</li>
              <li><strong>Correction:</strong> Correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Portability:</strong> Export your data in a commonly used format</li>
              <li><strong>Opt-Out:</strong> Opt out of certain data collection practices</li>
            </ul>
            
            <h3 className="text-lg font-semibold mb-3 mt-6">8.1 Student and Parent Rights</h3>
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

            <h3 className="text-lg font-semibold mb-3 mt-6">8.2 Exercising Your Rights</h3>
            <p className="mt-4">
              To exercise these rights, please contact us at teamysite@gmail.com. For students, please have your parent/guardian or school administrator contact us on your behalf. We will respond to all legitimate requests within 30 days.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">9. International Users</h2>
            <p>
              We do not target, market to, or knowingly collect personal information from individuals outside the United States. If we become aware that we have collected information from a non-U.S. resident, we will delete it promptly.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">10. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify users of any material changes by:
            </p>
            <ul>
              <li>Posting the updated Privacy Policy on our website with a new &quot;Last Updated&quot; date</li>
              <li>Sending email notifications to registered users for significant changes</li>
              <li>For changes affecting student data, notifying educational institutions directly</li>
            </ul>
            <p className="mt-4">
              Your continued use of the Service after any changes indicates your acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-xl font-semibold mb-4">11. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, our privacy practices, or wish to exercise your rights, please contact us at:
            </p>
            <p className="mt-4">
              <strong>Email:</strong> teamysite@gmail.com
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
