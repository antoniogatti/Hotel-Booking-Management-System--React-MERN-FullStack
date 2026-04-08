export type RoomSlug = "verdeca" | "malvasia" | "aleatico" | "fuocorosa";

export type CustomRoomSlug = "verdeca" | "malvasia" | "aleatico" | "fuocorosa";

export type RoomCatalogEntry = {
  slug: RoomSlug;
  hotelName: string;
  pageName: string;
  subtitle: string;
  folder: string;
  images: string[];
  floorLabel: string;
  minimumNights: number;
  maxAdults: number;
  maxChildren: number;
  bedType: string;
  area: string;
  description: string;
  shortDescription: string;
  services: string[];
  originalUrl: string;
  pricePerNight: number;
  type: string[];
  facilities: string[];
  customPage: boolean;
};

export const roomCatalog: Record<RoomSlug, RoomCatalogEntry> = {
  verdeca: {
    slug: "verdeca",
    hotelName: "Verdeca - Double Room",
    pageName: "VERDECA Room",
    subtitle: "Double Room with Private Balcony",
    folder: "verdeca",
    images: [
      "/verdeca/IMG_9335.jpg",
      "/verdeca/IMG_9338.jpg",
      "/verdeca/IMG_9340.jpg",
      "/verdeca/IMG_9344.jpg",
      "/verdeca/IMG_9356.jpg",
      "/verdeca/IMG_9371.jpg",
      "/verdeca/IMG_9384.jpg",
      "/verdeca/IMG_9947-copia.jpg",
      "/verdeca/IMG_20210410_110709.jpg",
      "/verdeca/IMG_20210410_1117131.jpg",
      "/verdeca/Z62_1312-scaled.jpg",
    ],
    floorLabel: "1st Floor",
    minimumNights: 2,
    maxAdults: 2,
    maxChildren: 0,
    bedType: "Ottoman Bed (Queen)",
    area: "22 m²",
    description:
      "VERDECA is a bright and welcoming room designed for guests who appreciate comfort, calm, and tasteful simplicity. The generous queen ottoman bed, soft natural light, and private balcony create an atmosphere that feels both relaxed and refined, making it especially suitable for couples looking for an easy and pleasant stay in Brindisi.\n\nThe room combines elegant proportions with practical comforts. The private bathroom is fitted with a spacious shower, while fresh towels, a hair dryer, and a courtesy kit are provided for daily ease. A Nespresso coffee machine and mini fridge make it easy to enjoy a quiet moment in the room, whether at the start of the day or after returning from the city.\n\nA 40\" TV, wardrobe, reliable Wi-Fi, and a carefully arranged layout complete the experience. VERDECA is ideal for guests who prefer a room that feels restful, well kept, and thoughtfully equipped rather than overly formal or impersonal.",
    shortDescription:
      "A bright and welcoming room with queen ottoman bed, private balcony, and a calm, refined atmosphere suited to a comfortable stay in Brindisi.",
    services: [
      "Wi-Fi",
      "Hair Dryer",
      "Breakfast",
      "Coffee Maker",
      "Mini Fridge",
      "TV",
      "Air Conditioner / Heater",
      "Private Balcony",
    ],
    originalUrl: "/rooms/verdeca",
    pricePerNight: 110,
    type: ["Boutique", "Romantic"],
    facilities: ["Free WiFi", "Non-Smoking Rooms"],
    customPage: true,
  },
  malvasia: {
    slug: "malvasia",
    hotelName: "Malvasia - Double Room",
    pageName: "MALVASIA Room",
    subtitle: "Double Room with Private Balcony",
    folder: "malvasia",
    images: [
      "/malvasia/IMG_9420.jpg",
      "/malvasia/IMG_9421.jpg",
      "/malvasia/IMG_9422.jpg",
      "/malvasia/IMG_9424.jpg",
      "/malvasia/IMG_9425.jpg",
      "/malvasia/IMG_9442.jpg",
      "/malvasia/IMG_9455.jpg",
      "/malvasia/IMG_9584.jpg",
      "/malvasia/IMG_9596.jpg",
      "/malvasia/IMG_9614.jpg",
      "/malvasia/IMG_9958.jpg",
      "/malvasia/IMG_20210410_124809.jpg",
      "/malvasia/IMG_20210416_101728.jpg",
      "/malvasia/IMG_20210416_101728-1.jpg",
      "/malvasia/IMG_20210416_102546-2.jpg",
      "/malvasia/Z62_1377-scaled.jpg",
    ],
    floorLabel: "1st Floor",
    minimumNights: 2,
    maxAdults: 2,
    maxChildren: 0,
    bedType: "Ottoman Bed (Queen)",
    area: "18 m²",
    description:
      "MALVASIA is an intimate and comfortable room with a warm, welcoming character that immediately feels easy to settle into. It is particularly suited to guests who value a quieter style of hospitality, where comfort comes from good proportions, thoughtful amenities, and a pleasant sense of privacy.\n\nThe queen ottoman bed and private balcony give the room an airy, restful quality, while the ensuite bathroom with large shower adds everyday comfort. Soft towels, a hair dryer, and a courtesy kit are all provided, allowing the room to feel complete and carefully prepared rather than purely functional.\n\nA Nespresso coffee machine, mini fridge, 43\" TV, and dependable Wi-Fi round out the stay. MALVASIA is a very good choice for couples or solo travellers who want an elegant, uncomplicated room that feels calm from morning to evening.",
    shortDescription:
      "A warm and comfortable room with private balcony, queen ottoman bed, and thoughtful amenities for a calm and easy stay.",
    services: [
      "Wi-Fi",
      "Hair Dryer",
      "Breakfast",
      "Coffee Maker",
      "Mini Fridge",
      "TV",
      "Air Conditioner / Heater",
      "Private Balcony",
    ],
    originalUrl: "/rooms/malvasia",
    pricePerNight: 100,
    type: ["Boutique", "Romantic"],
    facilities: ["Free WiFi", "Non-Smoking Rooms"],
    customPage: true,
  },
  aleatico: {
    slug: "aleatico",
    hotelName: "Aleatico - King Studio with sofa bed",
    pageName: "ALEATICO Apartment",
    subtitle: "Spacious Apartment with Full Kitchen",
    folder: "aleatico",
    images: [
      "/aleatico/Bedroom-7.jpg",
      "/aleatico/Bedroom.jpg",
      "/aleatico/Bedroom-1-scaled.jpg",
      "/aleatico/Bedroom-2.jpg",
      "/aleatico/Bedroom-3.jpg",
      "/aleatico/Bedroom-4.jpg",
      "/aleatico/Bedroom-8.jpg",
      "/aleatico/Living--scaled.jpg",
      "/aleatico/Living-1-scaled.jpg",
      "/aleatico/Living-2.jpg",
      "/aleatico/Living-3.jpg",
      "/aleatico/Z62_1395-1-scaled.jpg",
      "/aleatico/Z62_1402-1-scaled.jpg",
      "/aleatico/Z62_1408-1-scaled.jpg",
      "/aleatico/Z62_1428-1-scaled.jpg",
      "/aleatico/Z62_1436-1-scaled.jpg",
      "/aleatico/Z62_1444-1-scaled.jpg",
      "/aleatico/Z62_1447-1-scaled.jpg",
      "/aleatico/Z62_1468-1-scaled.jpg",
      "/aleatico/Z62_1471-1-scaled.jpg",
      "/aleatico/Z62_1484-1-scaled.jpg",
      "/aleatico/Z62_1489-1-scaled.jpg",
      "/aleatico/Z62_1491-1-scaled.jpg",
      "/aleatico/Z62_1495-1-scaled.jpg",
      "/aleatico/Z62_1501-1-scaled.jpg",
      "/aleatico/Z62_1518-1-scaled.jpg",
      "/aleatico/Z62_1528-1-scaled.jpg",
      "/aleatico/Z62_1539-scaled.jpg",
      "/aleatico/Z62_1545-scaled.jpg",
      "/aleatico/Z62_1312-scaled.jpg",
    ],
    floorLabel: "1st Floor",
    minimumNights: 3,
    maxAdults: 2,
    maxChildren: 2,
    bedType: "Queen Bed + Sofa Bed",
    area: "60 m²",
    description:
      "ALEATICO is a spacious apartment with a calm residential feel, created for guests who appreciate extra room, privacy, and the freedom to enjoy their stay at their own pace. The layout is generous and practical, with a separate bedroom, a comfortable living area, a dining space, and a fully equipped kitchen that makes the apartment especially appealing for longer visits or slower, more independent stays.\n\nThe bedroom offers a restful queen bed, while the living room includes a sofa bed to accommodate additional guests when needed. The private bathroom is fitted with a shower and is complemented by fresh towels, a hair dryer, and a courtesy kit. Throughout the apartment, the furnishings aim to feel comfortable and welcoming rather than temporary, giving the space the character of a true holiday residence.\n\nModern conveniences include a refrigerator, dishwasher, washing machine, iron, coffee maker, TV, and reliable Wi-Fi. ALEATICO is ideal for guests who want the comfort of a well-prepared apartment and the flexibility to enjoy Brindisi without rushing.",
    shortDescription:
      "A spacious apartment with separate bedroom, kitchen, dining area, and living room, ideal for guests who prefer comfort and independence.",
    services: [
      "Wi-Fi",
      "Kitchen",
      "Fridge",
      "Hair Dryer",
      "Coffee Maker",
      "TV",
      "Private Balcony",
    ],
    originalUrl: "/rooms/aleatico",
    pricePerNight: 130,
    type: ["Boutique", "Self Catering", "Family"],
    facilities: ["Free WiFi", "Family Rooms", "Non-Smoking Rooms"],
    customPage: true,
  },
  fuocorosa: {
    slug: "fuocorosa",
    hotelName: "Fuocorosa - Apartment",
    pageName: "FUOCOROSA Apartment",
    subtitle: "Ground Floor Apartment with Kitchen",
    folder: "fuocorosa",
    images: [
      "/fuocorosa/Z62_0998-scaled.jpg",
      "/fuocorosa/Z62_0885-scaled.jpg",
      "/fuocorosa/Z62_0913-scaled.jpg",
      "/fuocorosa/Z62_0952-scaled.jpg",
      "/fuocorosa/Z62_0959-scaled.jpg",
      "/fuocorosa/Z62_0970-scaled.jpg",
      "/fuocorosa/Z62_0975-scaled.jpg",
      "/fuocorosa/Z62_0978-scaled.jpg",
      "/fuocorosa/Z62_0982-scaled.jpg",
      "/fuocorosa/Z62_1016-scaled.jpg",
      "/fuocorosa/Z62_1032-scaled.jpg",
      "/fuocorosa/Z62_1044-scaled.jpg",
      "/fuocorosa/Z62_1058-scaled.jpg",
      "/fuocorosa/Z62_1060-scaled.jpg",
      "/fuocorosa/Z62_1062-scaled.jpg",
      "/fuocorosa/Z62_1068-scaled.jpg",
      "/fuocorosa/Z62_1071-scaled.jpg",
      "/fuocorosa/Z62_1077-scaled.jpg",
      "/fuocorosa/Z62_1084-scaled.jpg",
      "/fuocorosa/Z62_1089-scaled.jpg",
      "/fuocorosa/Z62_1114-scaled.jpg",
      "/fuocorosa/Z62_1129-scaled.jpg",
      "/fuocorosa/Z62_1132-scaled.jpg",
      "/fuocorosa/Z62_1142-scaled.jpg",
      "/fuocorosa/Z62_1159-scaled.jpg",
      "/fuocorosa/Z62_1171-scaled.jpg",
      "/fuocorosa/Z62_1177-scaled.jpg",
      "/fuocorosa/Z62_1181-scaled.jpg",
      "/fuocorosa/Z62_1197-scaled.jpg",
      "/fuocorosa/Z62_1201-scaled.jpg",
      "/fuocorosa/Z62_1222-scaled.jpg",
      "/fuocorosa/Z62_1227-scaled.jpg",
      "/fuocorosa/Z62_1233-scaled.jpg",
      "/fuocorosa/Z62_1237-scaled.jpg",
      "/fuocorosa/Z62_1241-scaled.jpg",
      "/fuocorosa/Z62_1253-scaled.jpg",
      "/fuocorosa/Z62_1263-scaled.jpg",
      "/fuocorosa/Z62_1266-scaled.jpg",
      "/fuocorosa/Z62_1292-scaled.jpg",
      "/fuocorosa/Z62_1360-scaled.jpg",
    ],
    floorLabel: "Ground Floor",
    minimumNights: 4,
    maxAdults: 2,
    maxChildren: 2,
    bedType: "Queen Bed + Sofa Bed",
    area: "60 m²",
    description:
      "FUOCOROSA is a spacious apartment with a comfortable, easygoing character, well suited to guests who value independence, generous interiors, and a relaxed sense of home. Its layout makes daily living simple and pleasant, with clearly defined spaces for sleeping, dining, and unwinding after a day out in Brindisi.\n\nThe apartment includes a separate bedroom with queen bed, a living room with sofa bed, an equipped kitchen, dining area, and a private bathroom with shower. The proportions of the rooms make it especially comfortable for longer stays, whether for a couple, a small family, or guests who simply prefer not to feel confined to a single room.\n\nTowels, hair dryer, courtesy kit, refrigerator, dishwasher, washing machine, iron, coffee maker, TV, and reliable Wi-Fi are all provided. FUOCOROSA is an excellent choice for guests who want practical comfort, more personal space, and accommodation that feels relaxed and fully usable throughout the stay.",
    shortDescription:
      "A spacious apartment with separate bedroom, equipped kitchen, and comfortable living area, ideal for guests who appreciate space and ease.",
    services: [
      "Wi-Fi",
      "Kitchen",
      "Fridge",
      "Hair Dryer",
      "Coffee Maker",
      "TV",
    ],
    originalUrl: "/rooms/fuocorosa",
    pricePerNight: 140,
    type: ["Boutique", "Self Catering", "Family"],
    facilities: ["Free WiFi", "Parking", "Family Rooms", "Non-Smoking Rooms"],
    customPage: true,
  },
};

export const customRoomPageSlugs = ["verdeca", "malvasia", "aleatico", "fuocorosa"] as const;

export const roomPageCatalog: Record<CustomRoomSlug, RoomCatalogEntry> = {
  verdeca: roomCatalog.verdeca,
  malvasia: roomCatalog.malvasia,
  aleatico: roomCatalog.aleatico,
  fuocorosa: roomCatalog.fuocorosa,
};

export const isCustomRoomSlug = (slug: string): slug is CustomRoomSlug =>
  customRoomPageSlugs.includes(slug as CustomRoomSlug);

export const getRoomSlugForHotel = (hotel: {
  slug?: string;
  name: string;
}): CustomRoomSlug | null => {
  if (hotel.slug && isCustomRoomSlug(hotel.slug)) {
    return hotel.slug;
  }

  for (const slug of customRoomPageSlugs) {
    if (roomCatalog[slug].hotelName.toLowerCase() === hotel.name.toLowerCase()) {
      return slug;
    }
  }

  return null;
};