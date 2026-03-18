export const siteConfig = {
  app: {
    version: "1.6.0",
    releaseDate: "2026-03-18",
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
  links: {
    website: "https://palazzopintobnb.com/en/",
    rooms: "https://palazzopintobnb.com/en/rooms/",
    services: "https://palazzopintobnb.com/en/services/",
    contact: "/contact-us",
  },
  social: {
    facebook: "https://www.facebook.com/palazzopintobnb",
    instagram: "https://www.instagram.com/palazzopintobnb/",
    linkedin: "https://www.linkedin.com/company/palazzopintobnb/",
    youtube: "https://www.youtube.com/channel/UC69zTJR0w0HwbkQ5XLjBbMQ",
  },
} as const;
