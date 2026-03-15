import { siteConfig } from "../config/siteConfig";

const PrivacyCookiePolicy = () => {
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-white border border-[#e7e9df] rounded-2xl shadow-soft p-6 sm:p-8 lg:p-10 space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2b4463]">
            Privacy and Cookie Policy
          </h1>
          <p className="text-sm text-[#6b7280]">
            Last updated: March 15, 2026
          </p>
          <p className="text-[#374151] leading-7">
            This policy explains how {siteConfig.brand.shortName} collects, uses,
            and protects personal data, and how cookies are used on this website.
          </p>
        </header>

        <div className="space-y-6 text-[#374151] leading-7">
          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">1. Data Controller</h2>
            <p>
              {siteConfig.brand.shortName} is the data controller for information
              collected through this website.
            </p>
            <p>
              Contact email: <a className="text-[#ea836c] underline" href={`mailto:${siteConfig.contact.email}`}>{siteConfig.contact.email}</a>
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">2. Personal Data We Process</h2>
            <p>We may process the following categories of personal data:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Identity and account information (name, email, authentication details).</li>
              <li>Booking-related information (dates, guest counts, preferences).</li>
              <li>Technical data (browser type, device, anonymized analytics where consented).</li>
              <li>Communication data when you contact us.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">3. Purpose and Legal Basis</h2>
            <p>We process personal data to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide booking and account services (contract necessity).</li>
              <li>Maintain security and prevent misuse (legitimate interests).</li>
              <li>Comply with legal obligations.</li>
              <li>Run optional analytics/marketing only where consent is given.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">4. Cookies We Use</h2>
            <p>This website uses three cookie categories:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Necessary:</strong> Required for core site functionality and security.</li>
              <li><strong>Analytics:</strong> Helps us understand usage and improve performance.</li>
              <li><strong>Marketing:</strong> Supports optional promotional and social integrations.</li>
            </ul>
            <p>
              Necessary cookies are always active. Optional categories can be managed at any time
              through the cookie settings panel.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">5. Retention</h2>
            <p>
              We retain personal data only as long as needed for the purposes above,
              including legal, accounting, and dispute-resolution requirements.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">6. Your Rights</h2>
            <p>Depending on applicable law, you may have rights to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access your personal data.</li>
              <li>Correct inaccurate information.</li>
              <li>Request deletion of data where applicable.</li>
              <li>Restrict or object to certain processing.</li>
              <li>Withdraw consent for optional cookies at any time.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">7. Contact</h2>
            <p>
              For privacy requests or cookie questions, contact us at
              <a className="text-[#ea836c] underline ml-1" href={`mailto:${siteConfig.contact.email}`}>
                {siteConfig.contact.email}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </section>
  );
};

export default PrivacyCookiePolicy;
