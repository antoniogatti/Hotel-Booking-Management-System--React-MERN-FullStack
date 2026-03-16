import { siteConfig } from "../config/siteConfig";

const TermsConditions = () => {
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-white border border-[#e7e9df] rounded-2xl shadow-soft p-6 sm:p-8 lg:p-10 space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2b4463]">
            Terms and Conditions
          </h1>
          <p className="text-sm text-[#6b7280]">Last updated: March 16, 2026</p>
          <p className="text-[#374151] leading-7">
            These terms regulate reservations and stays at {siteConfig.brand.shortName}. By booking
            or staying with us, guests agree to the following conditions.
          </p>
        </header>

        <div className="space-y-6 text-[#374151] leading-7">
          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">1. Booking</h2>
            <p>
              The B&amp;B confirms each booking by sending a reservation code via email.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">2. Cancellation</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Cancellations must be received at least 7 days before arrival to receive a refund.
              </li>
              <li>
                For cancellations received within 7 days of arrival, the full amount paid is charged.
              </li>
              <li>No refunds are provided for early departures.</li>
              <li>
                In case of no-show without previous communication, the full amount paid is charged.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">3. Parking</h2>
            <p>
              Palazzo Pinto does not provide private parking on-site. Street parking is available and
              regulated by municipal rules. Private parking may be arranged in advance, subject to
              availability.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">4. Accessibility</h2>
            <p>
              The B&amp;B does not have wheelchair ramps or a lift. Rooms are located on the first
              floor and are reached via stairs.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">5. Check-In and Documents</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Check-in is from 2:00 p.m. to 8:00 p.m.</li>
              <li>Late check-ins must be requested before arrival day.</li>
              <li>
                A valid identity document is required for all guests at check-in (passport, national
                ID card, or driving licence).
              </li>
              <li>
                If documents are not compliant with legal requirements, access may be denied.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">6. Local Tax</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Low season (January-March): EUR 1.50 per night, up to 7 nights.</li>
              <li>High season (April-December): EUR 2.50 per night, up to 7 nights.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">7. Payment</h2>
            <p>
              At check-in, after registration, the full stay amount is due by cash or card. An invoice
              is issued for the payment and stay details.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">8. Stay Rules</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>It is prohibited to alter furniture, equipment, or room devices.</li>
              <li>
                Guests should use toilets correctly and not throw objects into the WC; use bins for
                rubbish.
              </li>
              <li>
                Lights, TV, and air-conditioning should be switched off when leaving the room.
              </li>
              <li>
                Cooking in rooms is prohibited, except where a dedicated apartment kitchen is provided.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">9. Keys</h2>
            <p>
              Guests receive room and access keys. Lost keys incur a EUR 300 charge to replace all
              relevant locks.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">10. Breakfast</h2>
            <p>
              Breakfast service is available with room provisions and fresh items served in the morning.
              Additional fresh options may be requested in advance, subject to availability.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">11. Additional Guests</h2>
            <p>
              Unregistered additional guests are not allowed in rooms. Visits by friends/family must be
              communicated in advance, are limited in duration, and may incur additional charges.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">12. Cleaning</h2>
            <p>
              Daily room cleaning is generally performed between 10:00 a.m. and 2:00 p.m. Bed linen and
              towels are normally replaced every 3 days. Extra daily replacement is available at an
              additional fee.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">13. Liability and Damages</h2>
            <p>
              Guests are responsible for damages or breakages caused during the stay. The B&amp;B is not
              liable for loss, theft, or damage to personal belongings, vehicles, or possessions.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">14. Noise, Smoking, and Pets</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Noise must be minimized, especially during designated quiet hours.</li>
              <li>
                Smoking is prohibited indoors; evidence of indoor smoking may incur a EUR 250 cleaning
                fee.
              </li>
              <li>Pets are not allowed in the premises.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">15. Check-Out</h2>
            <p>
              Check-out is at 10:00 a.m. Late check-out may be available upon request with additional
              fees, depending on departure time and room availability.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">16. Luggage Storage</h2>
            <p>
              Luggage storage is available for a limited period (typically 10 to 12 hours). The B&amp;B is
              not responsible for loss or damage to stored items.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-[#2b4463]">17. Contact</h2>
            <p>
              For booking terms questions, please contact us at
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

export default TermsConditions;
