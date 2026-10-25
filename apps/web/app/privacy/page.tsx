import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Link Hub collects, why, how long it is kept and the choices you have.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="This policy explains what Link Hub collects, why we need it, how long we keep it and the control you have."
    >
      <section>
        <h2>1. What we collect</h2>
        <ul>
          <li>
            <strong>Account data:</strong> your email address, password hash, verification state and
            session records.
          </li>
          <li>
            <strong>Profile data:</strong> your username, display name, headline, bio, avatar URL,
            social links and appearance settings.
          </li>
          <li>
            <strong>Content:</strong> the links and categories you add, including titles,
            descriptions, destinations and visibility settings.
          </li>
          <li>
            <strong>Analytics:</strong> recorded clicks with the link, UTC day, referrer domain,
            device class and country code.
          </li>
          <li>
            <strong>Operational data:</strong> security logs needed to run the service and respond to
            abuse.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. What we do not collect</h2>
        <p>
          We do not store visitor IP addresses. A short-lived HMAC hash derived from the request is
          used to filter repeat taps and is cleared on a daily schedule. Country information comes
          from a trusted proxy header and is stored only as a two-letter country code, never with an
          IP address.
        </p>
      </section>

      <section>
        <h2>3. Why we use it</h2>
        <ul>
          <li>To create and secure your account and keep you signed in.</li>
          <li>To render your public profile and let visitors open your links.</li>
          <li>To show you click totals, trends, sources, devices and countries.</li>
          <li>To send verification, password-reset and account-deletion emails.</li>
          <li>To prevent abuse, enforce limits and keep the service reliable.</li>
        </ul>
      </section>

      <section>
        <h2>4. Cookies and sessions</h2>
        <p>
          Link Hub uses a session cookie to keep you signed in. It is HTTP-only in production and
          expires after 7 days. We do not use advertising cookies or third-party tracking pixels.
        </p>
      </section>

      <section>
        <h2>5. How long we keep it</h2>
        <ul>
          <li>
            <strong>Raw click events:</strong> up to 90 days, then purged after daily rollups.
          </li>
          <li>
            <strong>Daily click totals:</strong> for the life of the link, so your history remains
            after raw events are purged.
          </li>
          <li>
            <strong>Sessions:</strong> 7 days, or until you sign out.
          </li>
          <li>
            <strong>Verification and reset tokens:</strong> 24 hours and 1 hour respectively, then
            pruned.
          </li>
          <li>
            <strong>Deleted accounts:</strong> 30 days of grace, then permanently removed.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Sharing</h2>
        <p>
          We do not sell personal data. We share data only with service providers that help us host
          the application and deliver email, under contracts that limit their use of it, or where
          required by law. Analytics shown on your dashboard are about aggregate recorded clicks, not
          identifiable visitors.
        </p>
      </section>

      <section>
        <h2>7. Your choices</h2>
        <ul>
          <li>Export your profile, links, categories and daily analytics at any time.</li>
          <li>Unpublish your profile instantly from the Profile page.</li>
          <li>Change your email or password in Settings.</li>
          <li>Sign out one session or every other session in Settings.</li>
          <li>Delete your account and restore it during the 30-day grace period.</li>
        </ul>
      </section>

      <section>
        <h2>8. Security and children</h2>
        <p>
          Passwords are stored as hashes, sessions are rotated on password change, and access to
          owned resources is scoped to the signed-in user. Link Hub is not directed at children under
          13, and we do not knowingly collect their data.
        </p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>
          For privacy questions or requests, email{" "}
          <a href="mailto:privacy@linkhub.app">privacy@linkhub.app</a>. See also our{" "}
          <Link href="/terms">Terms of Service</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
