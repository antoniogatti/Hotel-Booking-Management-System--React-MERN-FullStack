import type { ReactNode } from "react";
import { Car, Clock, Mail, MapPin, Plane, TrainFront } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { siteConfig } from "../config/siteConfig";

type TravelSection = {
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  summary: ReactNode;
  points: ReactNode[];
};

const travelSections: TravelSection[] = [
  {
    title: "By Air",
    Icon: Plane,
    summary: <span>Brindisi Airport is a short drive from Palazzo Pinto and is usually the <strong>fastest arrival option</strong>.</span>,
    points: [
      <span key="air-1">The journey from the airport to the property is typically around <strong>10-15 minutes by car</strong>.</span>,
      <span key="air-2">A <strong>city bus</strong> also runs from the airport to the <strong>town centre</strong>; the ticket is typically <strong>1.50 EUR</strong>.</span>,
      <span key="air-3">
        For official routes and timetable updates, see
        {" "}
        <a
          href="https://www.stpbrindisi.it/index.php/en/routes-timetables/various/bus-to-airport-town-centre-costa-morena"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-[#2b4463] underline underline-offset-2 hover:text-[#ea836c] transition-colors"
        >
          STP Brindisi - Bus to Airport – Town centre - Costa Morena
        </a>
        .
      </span>,
      <span key="air-4">If you are landing late, we recommend arranging your transfer before departure for a smoother arrival.</span>,
    ],
  },
  {
    title: "By Train",
    Icon: TrainFront,
    summary: <span>The property is well positioned for rail travellers and can be reached comfortably <strong>on foot from the station</strong>.</span>,
    points: [
      <span key="train-1">Brindisi train and bus station is about <strong>5 minutes away on foot</strong>.</span>,
      <span key="train-2">From the station, continue along Corso Umberto I toward the centre and turn into Via Masaniello.</span>,
      <span key="train-3">This is often the easiest option for guests arriving from Lecce, Bari, or elsewhere in Puglia.</span>,
    ],
  },
  {
    title: "By Car",
    Icon: Car,
    summary: <span>Palazzo Pinto is easy to reach by car, with practical <strong>street-parking options</strong> close to the B&amp;B.</span>,
    points: [
      <span key="car-1">The nearest access from the SS379 allows a straightforward drive into the city centre area.</span>,
      <span key="car-2">Via Masaniello is convenient for unloading luggage before moving the car to parking.</span>,
      <span key="car-3">Guests can usually park near the B&amp;B on <strong>white lines (free)</strong>, especially around <strong>Via Spalato</strong> and streets near <strong>Brindisi central station</strong>.</span>,
      <span key="car-4"><strong>Blue lines</strong> in central areas are paid parking, so always check nearby signs and payment instructions before leaving the car.</span>,
    ],
  },
  {
    title: "Parking",
    Icon: MapPin,
    summary: <span>If you arrive by car, both <strong>free</strong> and <strong>paid</strong> street parking are available near the city centre and station side.</span>,
    points: [
      <span key="park-1"><strong>White lines</strong>: free parking where available, including Via Spalato (Piazzale Spalato area) and around Brindisi central station.</span>,
      <span key="park-2"><strong>Blue lines</strong>: paid parking. Typical time window is <strong>08:00-21:00</strong> (often until <strong>24:00</strong> on pre-holiday evenings).</span>,
      <span key="park-3">A commonly displayed blue-line rate in Brindisi centre is <strong>1.00 EUR/hour</strong>.</span>,
      <span key="park-4">Road signs and on-street meters always prevail, so please verify local signage at the exact parking spot.</span>,
    ],
  },
];

const ReachUs = () => {
  const mapsQuery = encodeURIComponent(siteConfig.contact.address);
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const mapsEmbedLink = `https://www.google.com/maps?q=${mapsQuery}&output=embed`;

  return (
    <section className="bg-[#f7f7f7] min-h-[70vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-12 bg-white border border-[#e7e9df] rounded-[28px] p-6 sm:p-8 shadow-soft">
            <p className="uppercase tracking-[0.25em] text-[#ea836c] text-xs font-semibold mb-3">
              Palazzo Pinto B&B
            </p>
            <h1 className="text-3xl sm:text-5xl font-serif text-[#2b4463] leading-tight mb-4">
              Reach Us
            </h1>
            <p className="text-lg sm:text-xl font-serif text-[#2b4463] mb-4">
              <strong>Via Masaniello, 30</strong>
            </p>
            <div className="space-y-4 text-[#3f4d5f] leading-7 text-[15px] sm:text-base">
              <p>
                Palazzo Pinto is in a central but calm part of Brindisi, <strong>close to the station</strong> and well placed for arrivals by air, rail, or car.
              </p>
              <p>
                This page brings together practical information before travelling, including local access, parking guidance, and direct map access.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-[#f5f1ea] px-4 py-4 border border-[#ece2d3]">
                <div className="flex items-center gap-2 text-[#2b4463] mb-2">
                  <Clock className="w-4 h-4 text-[#ea836c]" />
                  <span className="text-xs uppercase tracking-[0.18em] font-semibold">Station</span>
                </div>
                <p className="text-2xl font-semibold text-[#2b4463]">5 min</p>
                <p className="text-sm text-[#5b6573]"><strong>5 min by foot</strong> from Brindisi train and bus station</p>
              </div>
              <div className="rounded-2xl bg-[#eef1e7] px-4 py-4 border border-[#dde4cf]">
                <div className="flex items-center gap-2 text-[#2b4463] mb-2">
                  <Plane className="w-4 h-4 text-[#ea836c]" />
                  <span className="text-xs uppercase tracking-[0.18em] font-semibold">Airport</span>
                </div>
                <p className="text-2xl font-semibold text-[#2b4463]">10-15 min</p>
                <p className="text-sm text-[#5b6573]"><strong>10-15 min by car</strong> from Brindisi Airport</p>
              </div>
              <div className="rounded-2xl bg-[#f5f7fb] px-4 py-4 border border-[#dfe5ef]">
                <div className="flex items-center gap-2 text-[#2b4463] mb-2">
                  <Car className="w-4 h-4 text-[#ea836c]" />
                  <span className="text-xs uppercase tracking-[0.18em] font-semibold">Road Access</span>
                </div>
                <p className="text-2xl font-semibold text-[#2b4463]">Parking</p>
                <p className="text-sm text-[#5b6573]"><strong>No private parking</strong> available in the facilities</p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={mapsLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#2b4463] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1f334a] transition-colors"
              >
                <MapPin className="w-4 h-4" />
                Open in Google Maps
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
          {travelSections.map(({ title, Icon, summary, points }) => (
            <article
              key={title}
              className="rounded-[24px] border border-[#e7e9df] bg-white p-6 shadow-soft"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef1e7] text-[#2b4463]">
                  <Icon className="w-5 h-5" />
                </span>
                <h2 className="text-xl font-serif text-[#2b4463]">{title}</h2>
              </div>
              <p className="text-[#3f4d5f] leading-7 mb-4">{summary}</p>
              <ul className="space-y-3 text-sm leading-6 text-[#556171]">
                {points.map((point, index) => (
                  <li key={`${title}-${index}`} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#ea836c] flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-10 space-y-6">
          <div className="rounded-[28px] overflow-hidden border border-[#e7e9df] bg-white shadow-soft">
            <iframe
              title="Palazzo Pinto map"
              src={mapsEmbedLink}
              className="w-full h-[420px] border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div className="rounded-[24px] border border-[#e7e9df] bg-white shadow-soft p-6 sm:p-7">
            <p className="text-xs uppercase tracking-[0.2em] text-[#ea836c] font-semibold mb-3">Direct Contact</p>
            <div className="space-y-4 text-[#2b4463]">
              <div className="flex items-start gap-3">
                <FaWhatsapp className="w-4 h-4 mt-1 text-[#ea836c]" />
                <div>
                  <p className="font-semibold">WhatsApp</p>
                  <a href={`https://wa.me/${siteConfig.contact.whatsapp}`} target="_blank" rel="noreferrer" className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors">
                    {siteConfig.contact.phone}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 mt-1 text-[#ea836c]" />
                <div>
                  <p className="font-semibold">Email</p>
                  <a href={`mailto:${siteConfig.contact.email}`} className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors break-all">
                    {siteConfig.contact.email}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReachUs;