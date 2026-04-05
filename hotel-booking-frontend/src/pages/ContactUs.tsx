import { useEffect, useState } from "react";
import { useMutation } from "react-query";
import { useForm } from "react-hook-form";
import { Car, Clock, Mail, MapPin, Phone, Plane, TrainFront } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import axios from "axios";
import { Link } from "react-router-dom";
import { submitContactForm } from "../api-client";
import { siteConfig } from "../config/siteConfig";
import { useToast } from "../hooks/use-toast";

type ContactFormValues = {
  name: string;
  email: string;
  phone?: string;
  message: string;
  privacyAccepted: boolean;
};

const parkingReferenceImage =
  "https://palazzopintobnb.com/wp-content/uploads/2021/09/WhatsApp-Image-2021-09-15-at-11.14.48-537x1024.jpeg";

const travelSections = [
  {
    title: "By Airplane",
    Icon: Plane,
    summary: "Brindisi-Salento Airport is only 10 to 15 minutes by car from Palazzo Pinto.",
    points: [
      "Taxis are available outside the arrivals area. The trip into the city usually has a fixed fare of about EUR 25. Taxi service: +39 0831 597901.",
      "A lower-cost option is the airport shuttle to Piazza Crispi / Railway Station. From there, walk along Corso Umberto I, cross Piazza Cairoli, then turn left into Via Masaniello.",
      "The shuttle generally runs every day from early morning until late evening at roughly 30-minute intervals.",
    ],
  },
  {
    title: "By Train",
    Icon: TrainFront,
    summary: "Palazzo Pinto is in a quiet central position, about 5 minutes on foot from Brindisi train and bus station.",
    points: [
      "After leaving the station, continue along Corso Umberto I towards the city centre.",
      "At Piazza Cairoli, turn left into Via Masaniello to reach the property.",
      "This is usually the easiest arrival option for guests travelling through Puglia by rail.",
    ],
  },
  {
    title: "By Car",
    Icon: Car,
    summary: "The property can be reached in around 10 to 15 minutes from the nearest exit of the Strada Statale 379 (Lecce-Bari).",
    points: [
      "Follow signs for Brindisi centre and the railway station area.",
      "Via Masaniello is well positioned for a smooth arrival without needing to cross the whole historic centre by car.",
      "If you prefer, contact us before arrival and we can help you choose the easiest approach based on your direction of travel.",
    ],
  },
  {
    title: "Parking",
    Icon: MapPin,
    summary: "Parking is available in the surrounding area and we are happy to help you choose the most practical solution before arrival.",
    points: [
      "Short-stay and public parking options can usually be found near the property and around the station side of the centre.",
      "Availability can vary by time of day and season, so we recommend contacting us shortly before arrival for the latest advice.",
      "If you are arriving with luggage or need a simpler drop-off plan, we can suggest the most convenient approach.",
    ],
  },
] as const;

const ContactUs = () => {
  const { toast } = useToast();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const savedDraft = (() => {
    const raw = sessionStorage.getItem("contactFormDraft");
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as Partial<ContactFormValues>;
    } catch {
      return null;
    }
  })();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ContactFormValues>({
    defaultValues: {
      name: savedDraft?.name || "",
      email: savedDraft?.email || "",
      phone: savedDraft?.phone || "",
      message: savedDraft?.message || "",
      privacyAccepted: savedDraft?.privacyAccepted || false,
    },
  });

  const draftValues = watch();

  useEffect(() => {
    sessionStorage.setItem("contactFormDraft", JSON.stringify(draftValues));
  }, [draftValues]);

  const mutation = useMutation(submitContactForm, {
    onSuccess: () => {
      setSubmissionError(null);
      toast({
        title: "Message sent",
        description:
          "Thank you for contacting us. We sent a confirmation to your email.",
      });
      sessionStorage.removeItem("contactFormDraft");
      reset();
    },
    onError: (error) => {
      const apiMessage =
        axios.isAxiosError(error) &&
        error.response?.data &&
        typeof error.response.data.message === "string"
          ? error.response.data.message
          : "We could not send your message right now. Please try again shortly.";

      setSubmissionError(apiMessage);

      toast({
        title: "Sending failed",
        description: apiMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ContactFormValues) => {
    mutation.mutate(values);
  };

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
                Palazzo Pinto is strategically located in a quiet part of central Brindisi,
                just a short walk from the train station and bus station.
              </p>
              <p>
                From Brindisi-Salento Airport the journey usually takes about 10 to 15 minutes by car,
                and the property is also convenient if you are arriving from the Strada Statale 379
                coming from Lecce or Bari.
              </p>
              <p>
                If you would like help planning the easiest arrival, we are always happy to assist before your stay.
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
                <p className="text-sm text-[#5b6573]">by car from Brindisi-Salento Airport</p>
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
                alt="Historic Palazzo Pinto building in Brindisi"
                className="h-[320px] w-full object-cover"
              />
              <div className="px-5 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#ea836c] font-semibold mb-2">Historic Setting</p>
                <p className="text-sm text-[#495463] leading-6">
                  Staying at Palazzo Pinto means arriving in the historic heart of Brindisi,
                  close to transport links while preserving the calm atmosphere of a residential street.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-[#e7e9df] bg-white shadow-soft">
              <img
                src={parkingReferenceImage}
                alt="Parking reference near Palazzo Pinto"
                className="h-[220px] w-full object-cover"
              />
              <div className="px-5 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#ea836c] font-semibold mb-2">Parking Reference</p>
                <p className="text-sm text-[#495463] leading-6">
                  We included the original parking reference image from the previous site version to keep the arrival guidance familiar.
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
          <div className="lg:col-span-5 rounded-[28px] overflow-hidden border border-[#e7e9df] bg-white shadow-soft">
            <iframe
              title="Palazzo Pinto map"
              src={mapsEmbedLink}
              className="w-full h-[420px] border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="p-6 border-t border-[#eef1e7]">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 mt-1 text-[#ea836c]" />
                <div>
                  <p className="font-semibold text-[#2b4463]">Address</p>
                  <a
                    href={mapsLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors"
                  >
                    {siteConfig.contact.address}
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-[#e7e9df] rounded-[28px] p-6 sm:p-8 shadow-soft">
            <p className="uppercase tracking-[0.25em] text-[#ea836c] text-xs font-semibold mb-3">
              Need help with your arrival?
            </p>
            <h2 className="text-3xl font-serif text-[#2b4463] leading-tight mb-4">
              Send Us a Message
            </h2>
            <p className="text-[#3f4d5f] leading-7 mb-8">
              If you need help choosing the easiest transfer, parking solution, or walking route,
              send us a message and we will gladly assist.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              {submissionError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submissionError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#2b4463] mb-1" htmlFor="contact-name">
                    Full Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    className="w-full rounded-lg border border-[#d9ddd0] px-3 py-2.5 text-[#2f3945] focus:outline-none focus:ring-2 focus:ring-[#aab09a]"
                    {...register("name", {
                      required: "Name is required",
                      minLength: { value: 2, message: "Name is too short" },
                    })}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#2b4463] mb-1" htmlFor="contact-email">
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    className="w-full rounded-lg border border-[#d9ddd0] px-3 py-2.5 text-[#2f3945] focus:outline-none focus:ring-2 focus:ring-[#aab09a]"
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Enter a valid email",
                      },
                    })}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#2b4463] mb-1" htmlFor="contact-phone">
                  Phone (optional)
                </label>
                <input
                  id="contact-phone"
                  type="tel"
                  className="w-full rounded-lg border border-[#d9ddd0] px-3 py-2.5 text-[#2f3945] focus:outline-none focus:ring-2 focus:ring-[#aab09a]"
                  {...register("phone")}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#2b4463] mb-1" htmlFor="contact-message">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  rows={6}
                  className="w-full rounded-lg border border-[#d9ddd0] px-3 py-2.5 text-[#2f3945] focus:outline-none focus:ring-2 focus:ring-[#aab09a]"
                  {...register("message", {
                    required: "Message is required",
                    minLength: {
                      value: 10,
                      message: "Message must be at least 10 characters",
                    },
                  })}
                />
                {errors.message && (
                  <p className="text-sm text-red-600 mt-1">{errors.message.message}</p>
                )}
              </div>

              <div>
                <label className="flex items-start gap-3 text-sm text-[#2f3945]" htmlFor="contact-privacy">
                  <input
                    id="contact-privacy"
                    type="checkbox"
                    className="mt-1"
                    {...register("privacyAccepted", {
                      required: "You must accept the privacy policy",
                    })}
                  />
                  <span>
                    I agree to the processing of my personal data for this contact request. Read the{" "}
                    <Link
                      to="/privacy-cookie-policy"
                      className="underline font-medium text-[#2b4463] hover:text-[#1f334a]"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                {errors.privacyAccepted && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.privacyAccepted.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={mutation.isLoading}
                className="inline-flex items-center justify-center rounded-lg bg-[#ea836c] text-white px-6 py-3 font-semibold hover:bg-[#db755f] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {mutation.isLoading ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactUs;
