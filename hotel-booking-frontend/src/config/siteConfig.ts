export const siteConfig = {
  app: {
    version: "1.11.1",
    releaseDate: "2026-04-15",
  },
  singlePropertyMode: true,
  brand: {
    shortName: "Palazzo Pinto B&B",
    fullName: "Palazzo Pinto B&B",
    tagline: "Where the sounds, scents and emotions of the past echo",
    logoPath: "/common/LOGO+PAYOFF_PalazzoPinto.svg",
  },
  property: {
    city: "Brindisi",
    country: "Italy",
    story:
      "A charmingly renovated boutique mansion in the heart of Brindisi, just a short walk from the central station and city landmarks.",
    ctaLabel: "Check Availability",
  },
  contact: {
    phone: "+39 0831 1785476",
    whatsapp: "3908311785476",
    email: "info@palazzopintobnb.com",
    address: "Via Masaniello, 30 72100 Brindisi",
  },
  business: {
    vatNumber: "02654480744",
    cin: "IT074001B400055036",
  },
  links: {
    website: "/",
    rooms: "/rooms",
    services: "/contact-us",
    contact: "/contact-us",
  },
  social: {
    facebook: "https://www.facebook.com/palazzopintobnb",
    instagram: "https://www.instagram.com/palazzopintobnb/",
    linkedin: "https://www.linkedin.com/company/palazzopintobnb/",
    youtube: "https://www.youtube.com/channel/UC69zTJR0w0HwbkQ5XLjBbMQ",
  },
} as const;
