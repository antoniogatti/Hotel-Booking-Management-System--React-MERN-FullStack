import { Car, Clock, Mail, MapPin, Phone, Plane, TrainFront } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { siteConfig } from "../config/siteConfig";

const travelSections = [
  {
    title: "By Air",
    Icon: Plane,
    summary: "Brindisi Airport is a short drive from Palazzo Pinto and is usually the fastest arrival option.",
    points: [
      "The journey from the airport to the property is typically around 10 to 15 minutes by car.",
      "Taxis are available outside arrivals, and airport shuttles stop near Brindisi station for guests who prefer public transport.",
      "If you are landing late, we recommend arranging your transfer before departure for a smoother arrival.",
    ],
  },
  {
    title: "By Train",
    Icon: TrainFront,
    summary: "The property is well positioned for rail travellers and can be reached comfortably on foot from the station.",
    points: [
      "Brindisi train and bus station is about 5 minutes away on foot.",
      "From the station, continue along Corso Umberto I toward the centre and turn into Via Masaniello.",
      "This is often the easiest option for guests arriving from Lecce, Bari, or elsewhere in Puglia.",
    ],
  },
  {
    title: "By Car",
    Icon: Car,
    summary: "Palazzo Pinto is easy to approach by car while still being in a central and quiet location.",
    points: [
      "The nearest access from the SS379 allows a straightforward drive into the city centre area.",
      "Via Masaniello is convenient for unloading luggage before moving the car to parking.",
      "If needed, contact us before arrival and we can help you choose the simplest approach.",
    ],
  },
  {
    title: "Parking",
    Icon: MapPin,
    summary: "Parking solutions are available in the surrounding area and can vary depending on the time of day.",
    points: [
      "Public options are usually available near the station side of the centre and in nearby streets.",
      "During busier periods, it is useful to plan your parking before arrival rather than searching at the last minute.",
      "If you want the most practical option for your stay, send us a message and we will guide you.",
    ],
  },
] as const;

const ReachUs = () => {
  const mapsQuery = encodeURIComponent(siteConfig.contact.address);
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const mapsEmbedLink = `https://www.google.com/maps?q=${mapsQuery}&output=embed`;

  return (
    <section className="bg-[#f7f7f7] min-h-[70vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 bg-white border border-[#e7e9df] rounded-[28px] p-6 sm:p-8 shadow-soft">
            <p className="uppercase tracking-[0.25em] text-[#ea836c] text-xs font-semibold mb-3">
              Palazzo Pinto B&B
            </p>
            <h1 className="text-3xl sm:text-5xl font-serif text-[#2b4463] leading-tight mb-4">
              Reach Us
            </h1>
            <div className="space-y-4 text-[#3f4d5f] leading-7 text-[15px] sm:text-base">
              <p>
                Palazzo Pinto is in a central but calm part of Brindisi, close to the station and well placed for arrivals by air, rail, or car.
              </p>
              <p>
                This page brings together the practical information you may want before travelling, including local access, parking guidance, and direct map access.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-[#f5f1ea] px-4 py-4 border border-[#ece2d3]">
                <div className="flex items-center gap-2 text-[#2b4463] mb-2">
                  <Clock className="w-4 h-4 text-[#ea836c]" />
                  <span className="text-xs uppercase tracking-[0.18em] font-semibold">Station</span>
                </div>
                <p className="text-2xl font-semibold text-[#2b4463]">5 min</p>
                <p className="text-sm text-[#5b6573]">walk from Brindisi train and bus station</p>
              </div>
              <div className="rounded-2xl bg-[#eef1e7] px-4 py-4 border border-[#dde4cf]">
                <div className="flex items-center gap-2 text-[#2b4463] mb-2">
                  <Plane className="w-4 h-4 text-[#ea836c]" />
                  <span className="text-xs uppercase tracking-[0.18em] font-semibold">Airport</span>
                </div>
                <p className="text-2xl font-semibold text-[#2b4463]">10-15 min</p>
                <p className="text-sm text-[#5b6573]">by car from Brindisi Airport</p>
              </div>
              <div className="rounded-2xl bg-[#f5f7fb] px-4 py-4 border border-[#dfe5ef]">
                <div className="flex items-center gap-2 text-[#2b4463] mb-2">
                  <Car className="w-4 h-4 text-[#ea836c]" />
                  <span className="text-xs uppercase tracking-[0.18em] font-semibold">Road Access</span>
                </div>
                <p className="text-2xl font-semibold text-[#2b4463]">Easy</p>
                <p className="text-sm text-[#5b6573]">from the nearest SS379 exit</p>
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

          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 overflow-hidden rounded-[28px] border border-[#e7e9df] bg-white shadow-soft">
              <img
                src="/home/home-story.png"
                alt="Historic Palazzo Pinto building"
                className="h-[320px] w-full object-cover"
              />
              <div className="px-5 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#ea836c] font-semibold mb-2">Historic Setting</p>
                <p className="text-sm text-[#495463] leading-6">
                  The property sits in the historic fabric of Brindisi, giving you central access without the feel of a busy transit corridor.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-[#e7e9df] bg-white shadow-soft">
              <img
                src="/home/sildeshow/IMG_8900.jpg"
                alt="Brindisi city view"
                className="h-[220px] w-full object-cover"
              />
              <div className="px-5 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#ea836c] font-semibold mb-2">Arrival Atmosphere</p>
                <p className="text-sm text-[#495463] leading-6">
                  Once you arrive, you are already close to the centre, the waterfront, and the main points that make Brindisi easy to explore on foot.
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#e7e9df] bg-white shadow-soft p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-[#ea836c] font-semibold mb-3">Direct Contact</p>
              <div className="space-y-4 text-[#2b4463]">
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 mt-1 text-[#ea836c]" />
                  <div>
                    <p className="font-semibold">Phone</p>
                    <a href={`tel:${siteConfig.contact.phone.replace(/\s+/g, "")}`} className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors">
                      {siteConfig.contact.phone}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FaWhatsapp className="w-4 h-4 mt-1 text-[#ea836c]" />
                  <div>
                    <p className="font-semibold">WhatsApp</p>
                    <a href={`https://wa.me/${siteConfig.contact.whatsapp}`} target="_blank" rel="noreferrer" className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors">
                      Message us directly
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
                {points.map((point) => (
                  <li key={point} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#ea836c] flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 rounded-[28px] overflow-hidden border border-[#e7e9df] bg-white shadow-soft">
            <iframe
              title="Palazzo Pinto map"
              src={mapsEmbedLink}
              className="w-full h-[420px] border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div className="lg:col-span-5 bg-white border border-[#e7e9df] rounded-[28px] p-6 sm:p-8 shadow-soft">
            <p className="uppercase tracking-[0.25em] text-[#ea836c] text-xs font-semibold mb-3">
              Address
            </p>
            <h2 className="text-3xl font-serif text-[#2b4463] leading-tight mb-4">
              Via Masaniello, 30
            </h2>
            <p className="text-[#3f4d5f] leading-7 mb-6">
              Keep this page handy while travelling if you would like a quick route reference once you reach Brindisi.
            </p>

            <div className="space-y-5 text-[#2b4463] mb-8">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 mt-1 text-[#ea836c]" />
                <div>
                  <p className="font-semibold">Address</p>
                  <a href={mapsLink} target="_blank" rel="noreferrer" className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors">
                    {siteConfig.contact.address}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 mt-1 text-[#ea836c]" />
                <div>
                  <p className="font-semibold">Phone</p>
                  <a href={`tel:${siteConfig.contact.phone.replace(/\s+/g, "")}`} className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors">
                    {siteConfig.contact.phone}
                  </a>
                </div>
              </div>
            </div>

            <a
              href={mapsLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-[#ea836c] text-white px-6 py-3 font-semibold hover:bg-[#db755f] transition-colors"
            >
              Open in Google Maps
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReachUs;