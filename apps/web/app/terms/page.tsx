import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using Link Hub, your content and your account.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="These terms explain the rules for using Link Hub. By creating an account, you agree to them."
    >
      <section>
        <h2>1. Your account</h2>
        <p>
          You must provide accurate information, keep your password secure and be old enough to use
          the service in your jurisdiction. You are responsible for activity under your account.
          One person or organization may not create accounts to evade limits or moderation.
        </p>
      </section>

      <section>
        <h2>2. Your content</h2>
        <p>
          You keep ownership of the links, text and images you add. You grant Link Hub a limited
          licence to host, display and process that content so we can operate the service. Do not
          upload content you do not have the right to share.
        </p>
      </section>

      <section>
        <h2>3. Acceptable use</h2>
        <p>You may not use Link Hub to:</p>
        <ul>
          <li>Distribute malware, phishing pages, fraud or illegal content.</li>
          <li>Harass, threaten or impersonate another person or organization.</li>
          <li>Scrape, overload or attempt to bypass the service&apos;s security or rate limits.</li>
          <li>Send unsolicited bulk messages or manipulate analytics.</li>
        </ul>
        <p>
          We may remove content or suspend accounts that violate these rules. Where practical, we
          will explain why.
        </p>
      </section>

      <section>
        <h2>4. Analytics</h2>
        <p>
          Recorded clicks are estimates. Known bots and rapid repeat taps are filtered, and days use
          UTC boundaries. Analytics are provided for information, not as a guarantee of audience
          size or commercial performance.
        </p>
      </section>

      <section>
        <h2>5. Exports and deletion</h2>
        <p>
          You can export your data at any time. You can schedule account deletion from your profile;
          your public page goes offline immediately and you have 30 days to restore the account by
          signing in. After the grace period, the account and its data are permanently removed,
          except where we must retain records by law.
        </p>
      </section>

      <section>
        <h2>6. Availability and changes</h2>
        <p>
          We work to keep Link Hub available, but the service is provided &ldquo;as is&rdquo; without
          warranties. We may change features, limits or these terms. Material changes will be
          announced before they take effect. You can stop using the service at any time.
        </p>
      </section>

      <section>
        <h2>7. Liability</h2>
        <p>
          To the maximum extent permitted by law, Link Hub is not liable for indirect, incidental or
          consequential damages, or for lost profits, data or goodwill. Nothing in these terms
          limits rights that cannot be limited by law.
        </p>
      </section>

      <section>
        <h2>8. Contact</h2>
        <p>
          Questions about these terms? Use the{" "}
          <Link href="/contact?topic=support">contact form</Link>. See also our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
