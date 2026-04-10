import {
  ArrowUpRight,
  BusFront,
  CarFront,
  Footprints,
  Landmark,
  MapPinned,
  Trees,
  UtensilsCrossed,
} from "lucide-react";
import { useState } from "react";
import { siteConfig } from "../config/siteConfig";

type TravelMode = "walk" | "bus" | "car";
type CategoryFilter =
  | "all"
  | "restaurants"
  | "places"
  | "places-around"
  | "beaches"
  | "road-trips"
  | "valle-ditria";
type DistanceFilter = "all" | "1" | "5" | "15";

type RecommendationItem = {
  name: string;
  area: string;
  description: string;
  highlight: string;
  query: string;
  mapUrl?: string;
  roughDistance: string;
  estimatedTime: string;
  travelModes: TravelMode[];
};

const restaurants: RecommendationItem[] = [
  {
    name: "Toto & Raf Restaurant Brindisi",
    area: "Historic centre",
    description:
      "A very central restaurant choice for an easy sit-down meal close to Palazzo Pinto.",
    highlight: "Best for a nearby classic dinner option.",
    query: "Via Lauro 38 Brindisi",
    mapUrl: "https://maps.app.goo.gl/BABUQu14xRpAL4zbA",
    roughDistance: "0.2 km",
    estimatedTime: "About 3 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Cascipo",
    area: "Historic centre",
    description:
      "A reliable Italian option in the centre when you want a quick and easy dinner close to the B&B.",
    highlight: "Best for a classic central trattoria feel.",
    query: "Via San Benedetto 45 Brindisi",
    mapUrl: "https://maps.app.goo.gl/28hEjvDTS9e4xmsH8",
    roughDistance: "0.2 km",
    estimatedTime: "About 3 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Fao 37",
    area: "Piazza Mercato",
    description:
      "A fish-focused choice in the centre, useful when you want seafood in a lively old-town setting.",
    highlight: "Best for seafood around Piazza Mercato.",
    query: "Piazza Mercato 6 Brindisi",
    mapUrl: "https://maps.app.goo.gl/YC9g81C9WAhF2Vq49",
    roughDistance: "0.2 km",
    estimatedTime: "About 3 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Rendez-Vous Cafe",
    area: "Very close to Palazzo Pinto",
    description:
      "A practical nearby stop for drinks before dinner or for something easy after you return in the evening.",
    highlight: "Best for pre-dinner and after-dinner drinks.",
    query: "Rendez-Vous Cafe Brindisi",
    mapUrl: "https://g.page/rndvoobrindisi?share",
    roughDistance: "0.2 km",
    estimatedTime: "About 3 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Mama, trattoria di mare",
    area: "Historic centre",
    description:
      "A very close seafood option when you want something local and easy to reach directly from Palazzo Pinto.",
    highlight: "Best for a nearby fish-focused dinner.",
    query: "Mama trattoria di mare Brindisi",
    roughDistance: "0.3 km",
    estimatedTime: "About 4 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Ristorante La Nassa",
    area: "Waterfront side",
    description:
      "A well-known Italian seafood address near the waterfront and easy to reach from the historic centre.",
    highlight: "Best for a classic fish restaurant by the port side.",
    query: "Ristorante La Nassa Via Thaon De Revel Paolo 1 Brindisi",
    roughDistance: "0.4 km",
    estimatedTime: "About 5 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Antica Osteria La Sciabica",
    area: "Waterfront side",
    description:
      "A traditional osteria-style stop in the port area that fits well if you want a more local dinner atmosphere.",
    highlight: "Best for a traditional waterfront osteria dinner.",
    query: "Antica Osteria La Sciabica Via Thaon De Revel Paolo 29 Brindisi",
    roughDistance: "0.4 km",
    estimatedTime: "About 5 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Brunda",
    area: "Town centre",
    description:
      "A dependable choice if the priority is excellent pizza and an easy informal dinner nearby.",
    highlight: "Best for pizza.",
    query: "Brunda Brindisi",
    mapUrl: "https://maps.app.goo.gl/onXjjzX5s8gUAAtK8",
    roughDistance: "0.5 km",
    estimatedTime: "About 6 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Chocoloso",
    area: "Town centre",
    description:
      "The easy answer when you want ice cream while walking through the centre in the afternoon or after dinner.",
    highlight: "Best for ice cream.",
    query: "Chocoloso Brindisi",
    mapUrl: "https://maps.app.goo.gl/wGsDwEUhnhqM93PU9",
    roughDistance: "0.5 km",
    estimatedTime: "About 6 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Sapido • Ad un morso dal mare",
    area: "Waterfront side",
    description:
      "A strong waterfront stop when you want something easy and relaxed just a short walk from Palazzo Pinto.",
    highlight: "Perfect for an aperitivo fronte mare.",
    query: "Viale Regina Margherita 15 Brindisi",
    mapUrl: "https://maps.app.goo.gl/AueJAjQGRfzdSqhX7",
    roughDistance: "0.6 km",
    estimatedTime: "About 7 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Pantagruele",
    area: "Town centre",
    description:
      "A strong choice when you want excellent quality and very fresh fish in a more classic dinner setting.",
    highlight: "Best for fresh fish close to the B&B.",
    query: "Pantagruele Brindisi",
    mapUrl: "https://maps.app.goo.gl/KFJ9ncRXgtrAaKzU7",
    roughDistance: "0.7 km",
    estimatedTime: "About 9 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Numero Primo",
    area: "Seafront side",
    description:
      "A good stop for local wine tasting and an informal dinner with a sea view.",
    highlight: "Best for wine tasting and a relaxed evening table.",
    query: "Numero Primo Brindisi",
    mapUrl: "https://g.page/vinotecanumeroprimo?share",
    roughDistance: "0.8 km",
    estimatedTime: "About 10 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Il Porticciolo",
    area: "Sciaia / Casale side",
    description:
      "A practical waterfront-side restaurant option if you want a meal outside the immediate centre and are planning to go by bus or car.",
    highlight: "Best for a port-side restaurant reached by car or bus.",
    query: "Via Dardanelli 2 Brindisi",
    mapUrl: "https://maps.app.goo.gl/oHDMvMYrNUz2T4ao6",
    roughDistance: "3.1 km",
    estimatedTime: "About 10 minutes by car or 18 minutes by bus",
    travelModes: ["bus", "car"],
  },
  {
    name: "La Locanda del Porto",
    area: "Historic centre",
    description:
      "A very popular place for authentic local food, from pasta to meat, fish, vegetables, and also pizza.",
    highlight: "Best for a full local menu with broad choice.",
    query: "La Locanda del Porto Brindisi",
    mapUrl: "https://g.page/lalocandadelportobrindisi?share",
    roughDistance: "0.8 km",
    estimatedTime: "About 10 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Marea",
    area: "Waterfront area",
    description:
      "A fine dining option focused on fresh fish when you want a more polished dinner experience.",
    highlight: "Best for refined seafood dining.",
    query: "Marea Brindisi",
    mapUrl: "https://maps.app.goo.gl/GWdXqWktgGm1M8ND9",
    roughDistance: "1.0 km",
    estimatedTime: "About 12 minutes on foot",
    travelModes: ["walk"],
  },
];

const placesInBrindisi: RecommendationItem[] = [
  {
    name: "Castello Svevo",
    area: "Historic centre",
    description:
      "A 13th-century fortress linked to Frederick II and one of the clearest historic landmarks to add to a city walk in Brindisi.",
    highlight: "Best for a central historic stop close to Palazzo Pinto.",
    query: "Castello Svevo di Brindisi",
    roughDistance: "0.6 km",
    estimatedTime: "About 8 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Santa Maria del Casale",
    area: "Airport side",
    description:
      "A worthwhile short excursion for guests interested in architecture and a quieter stop still closely tied to the Brindisi area.",
    highlight: "Best for a half-day historical detour within Brindisi.",
    query: "Santa Maria del Casale Brindisi",
    roughDistance: "2.1 km",
    estimatedTime: "About 8 minutes by car or 18 minutes by bus",
    travelModes: ["bus", "car"],
  },
  {
    name: "Forte a Mare / Castello Alfonsino",
    area: "Sant'Andrea Island side",
    description:
      "A striking sea fortress with a more dramatic arrival feel, usually best approached as a dedicated visit rather than a casual walk.",
    highlight: "Best for Brindisi's most scenic fortress visit.",
    query: "Castello Alfonsino Brindisi",
    roughDistance: "3.0 km",
    estimatedTime: "About 10 minutes by car",
    travelModes: ["car"],
  },
  {
    name: "Lungomare Regina Margherita",
    area: "Waterfront",
    description:
      "A classic Brindisi promenade for a waterfront walk, sea views, and an easy first feel for the city centre.",
    highlight: "Best for a simple stroll along the seafront.",
    query: "Viale Regina Margherita, Brindisi",
    roughDistance: "0.6 km",
    estimatedTime: "About 7 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Tempio di San Giovanni al Sepolcro",
    area: "Historic centre",
    description:
      "A compact but distinctive site that adds historical depth to a short city itinerary without requiring a full-day plan.",
    highlight: "Best for history in the heart of town.",
    query: "Tempio di San Giovanni al Sepolcro Brindisi",
    roughDistance: "0.2 km",
    estimatedTime: "About 3 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Colonne Romane",
    area: "Waterfront side",
    description:
      "A reliable central landmark near the port and a simple stop to include while walking through the historic part of Brindisi.",
    highlight: "Best for a quick waterfront landmark stop.",
    query: "Colonne Romane Brindisi",
    roughDistance: "0.6 km",
    estimatedTime: "About 8 minutes on foot",
    travelModes: ["walk"],
  },
];

const placesAroundBrindisi: RecommendationItem[] = [
];

const beachesAndCoastalTours: RecommendationItem[] = [
  {
    name: "Brindisi Harbour Boat Departures",
    area: "Port side departure point",
    description:
      "If you want a coastal tour by boat, the harbour side near Scalinata Virgilio is the most practical place to start checking local departures.",
    highlight: "Best for starting a harbour or coastal boat outing.",
    query: "Scalinata Virgilio Brindisi",
    roughDistance: "0.6 km",
    estimatedTime: "About 7 minutes on foot",
    travelModes: ["walk"],
  },
  {
    name: "Punta Penne Beach",
    area: "Closest beach side",
    description:
      "A practical beach option when you want to reach the coast quickly without turning the outing into a full-day trip.",
    highlight: "Best for the nearest beach escape from Palazzo Pinto.",
    query: "Punta Penne beach Brindisi",
    roughDistance: "5.3 km",
    estimatedTime: "About 12 minutes by car",
    travelModes: ["bus", "car"],
  },
  {
    name: "Guna Beach",
    area: "Apani coastline",
    description:
      "A stylish beach-club option when you want a more serviced beach day with a stronger lido atmosphere.",
    highlight: "Best for a beach club day north of Brindisi.",
    query: "Guna Beach Brindisi",
    roughDistance: "11.9 km",
    estimatedTime: "About 20 minutes by car",
    travelModes: ["bus", "car"],
  },
  {
    name: "Apani Beach",
    area: "North coastal stretch",
    description:
      "A more open and natural coastal setting if you want a quieter beach atmosphere beyond the city edge.",
    highlight: "Best for a wider beach and a wilder coastal feel.",
    query: "Apani beach Brindisi",
    roughDistance: "13.1 km",
    estimatedTime: "About 22 minutes by car",
    travelModes: ["bus", "car"],
  },
  {
    name: "Lido San Benedetto",
    area: "Apani coastline",
    description:
      "Another good choice on the north coastal stretch if you want a straightforward beach stop outside the centre.",
    highlight: "Best for an easy lido-style beach option.",
    query: "Lido San Benedetto Brindisi",
    roughDistance: "About 13 km",
    estimatedTime: "About 20 to 25 minutes by car",
    travelModes: ["bus", "car"],
  },
  {
    name: "Torre Guaceto Nature Reserve",
    area: "Protected coastline",
    description:
      "A strong choice for combining beach time, coastal scenery, and protected natural landscape in a single outing.",
    highlight: "Best for beaches plus nature reserve views.",
    query: "Torre Guaceto Nature Reserve",
    roughDistance: "14.9 km",
    estimatedTime: "About 25 minutes by car",
    travelModes: ["bus", "car"],
  },
];

const valleDItriaTour: RecommendationItem[] = [
  {
    name: "Oria",
    area: "Historic hill town",
    description:
      "A characterful inland stop with a medieval centre and strong historic identity, useful if you want something a bit less expected on the way into the valley.",
    highlight: "Best for a quieter historic-town stop before Valle d'Itria proper.",
    query: "Oria Brindisi",
    roughDistance: "29.8 km",
    estimatedTime: "About 35 minutes by car",
    travelModes: ["car"],
  },
  {
    name: "Ostuni",
    area: "White city",
    description:
      "The classic Valle d'Itria stop for white-stone lanes, panoramic terraces, and an easy historic-centre walk.",
    highlight: "Best for the signature white-town atmosphere.",
    query: "Ostuni",
    roughDistance: "32.5 km",
    estimatedTime: "About 40 minutes by car",
    travelModes: ["car"],
  },
  {
    name: "Ceglie Messapica",
    area: "Food town",
    description:
      "A strong pick if you want a smaller historic town with a good food reputation and a quieter pace than the coast.",
    highlight: "Best for combining old town and local food culture.",
    query: "Ceglie Messapica",
    roughDistance: "35.9 km",
    estimatedTime: "About 45 minutes by car",
    travelModes: ["car"],
  },
  {
    name: "Cisternino",
    area: "Hill town",
    description:
      "A compact hill town that works very well for a slow walk, a meal stop, and classic Valle d'Itria views.",
    highlight: "Best for a relaxed hill-town lunch stop.",
    query: "Cisternino",
    roughDistance: "45.2 km",
    estimatedTime: "About 55 minutes by car",
    travelModes: ["car"],
  },
  {
    name: "Locorotondo",
    area: "Panoramic old town",
    description:
      "Known for its circular historic centre and polished white streets, this is one of the prettiest stops in the area.",
    highlight: "Best for postcard-style Valle d'Itria views.",
    query: "Locorotondo",
    roughDistance: "53.6 km",
    estimatedTime: "About 1 hour by car",
    travelModes: ["car"],
  },
  {
    name: "Alberobello",
    area: "Trulli town",
    description:
      "The best-known stop in the valley, ideal when you want the iconic trulli streets and a classic Puglia day trip.",
    highlight: "Best for the iconic trulli experience.",
    query: "Alberobello",
    roughDistance: "61.7 km",
    estimatedTime: "About 1 hour 10 minutes by car",
    travelModes: ["car"],
  },
];

const salentoRoadTrip: RecommendationItem[] = [
  {
    name: "Lecce",
    area: "Baroque city start",
    description:
      "A strong first or final stop for the Salento route, especially if you want baroque architecture, shopping streets, and an easy urban break between coastal legs.",
    highlight: "Best for starting or closing a longer Salento day trip.",
    query: "Lecce",
    roughDistance: "59.0 km",
    estimatedTime: "About 1 hour by car",
    travelModes: ["car"],
  },
  {
    name: "Torre dell'Orso",
    area: "Lecce coast",
    description:
      "Known for clear water and the iconic Two Sisters sea stacks, it is one of the classic coastal stops southbound from Lecce.",
    highlight: "Best for a classic Adriatic beach stop.",
    query: "Torre dell'Orso Lecce",
    roughDistance: "57.6 km",
    estimatedTime: "About 1 hour by car",
    travelModes: ["car"],
  },
  {
    name: "Alimini Lakes & Beaches",
    area: "North of Otranto",
    description:
      "A natural area with long sandy beaches and pine forest surroundings, good for a broader coastal detour.",
    highlight: "Best for combining beach and nature scenery.",
    query: "Laghi Alimini Otranto",
    roughDistance: "68.6 km",
    estimatedTime: "About 1 hour 10 minutes by car",
    travelModes: ["car"],
  },
  {
    name: "Otranto",
    area: "Seaside town",
    description:
      "A beautiful historic coastal town that works well as an anchor stop for beaches, old-town walks, and lunch by the sea.",
    highlight: "Best for a full seaside-town day trip.",
    query: "Otranto",
    roughDistance: "71.7 km",
    estimatedTime: "About 1 hour 15 minutes by car",
    travelModes: ["car"],
  },
  {
    name: "Porto Badisco",
    area: "South of Otranto",
    description:
      "A compact and scenic bay with a more intimate coastal feel, ideal if you prefer coves over larger beach stretches.",
    highlight: "Best for a smaller scenic bay stop.",
    query: "Porto Badisco Otranto",
    roughDistance: "77.0 km",
    estimatedTime: "About 1 hour 20 minutes by car",
    travelModes: ["car"],
  },
  {
    name: "Castro Marina",
    area: "Sea caves and boat trips",
    description:
      "A strong base for crystal-clear water, sea caves, and boat excursions including the wider Castro coast.",
    highlight: "Best for boat trips and sea caves.",
    query: "Castro Marina Lecce",
    roughDistance: "81.6 km",
    estimatedTime: "About 1 hour 25 minutes by car",
    travelModes: ["car"],
  },
  {
    name: "Gallipoli",
    area: "Ionian side",
    description:
      "A lively stop with an island old town, beaches, and a different atmosphere from the Adriatic coast.",
    highlight: "Best for combining historic town and nightlife energy.",
    query: "Gallipoli",
    roughDistance: "64.6 km",
    estimatedTime: "About 1 hour 10 minutes by car",
    travelModes: ["car"],
  },
  {
    name: "Galatina",
    area: "Inland Salento",
    description:
      "A good inland cultural stop for the Basilica of Santa Caterina and a more traditional Salento town atmosphere.",
    highlight: "Best for art, churches, and inland Salento culture.",
    query: "Galatina",
    roughDistance: "54.8 km",
    estimatedTime: "About 1 hour by car",
    travelModes: ["car"],
  },
  {
    name: "Pescoluse",
    area: "Maldive del Salento",
    description:
      "White sand and shallow turquoise water make this one of the easiest picks for a full beach-focused family day.",
    highlight: "Best for long sandy beach time.",
    query: "Pescoluse Lecce",
    roughDistance: "92.6 km",
    estimatedTime: "About 1 hour 35 minutes by car",
    travelModes: ["car"],
  },
  {
    name: "Santa Maria di Leuca",
    area: "Far south Salento",
    description:
      "A landmark southern stop where Adriatic and Ionian imagery meet, with lighthouse views and coastal cave excursions.",
    highlight: "Best for a far-south coastal finale.",
    query: "Santa Maria di Leuca",
    roughDistance: "99.5 km",
    estimatedTime: "About 1 hour 45 minutes by car",
    travelModes: ["car"],
  },
];

const buildMapsLink = (item: RecommendationItem) =>
  item.mapUrl ||
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.query)}`;

const getDistanceKm = (value: string) => {
  const numericValue = Number.parseFloat(value);

  return Number.isNaN(numericValue) ? Number.POSITIVE_INFINITY : numericValue;
};

const matchesDistanceFilter = (
  item: RecommendationItem,
  distanceFilter: DistanceFilter
) => {
  if (distanceFilter === "all") {
    return true;
  }

  return getDistanceKm(item.roughDistance) <= Number(distanceFilter);
};

const sortByDistance = (items: RecommendationItem[]) =>
  [...items].sort(
    (leftItem, rightItem) =>
      getDistanceKm(leftItem.roughDistance) - getDistanceKm(rightItem.roughDistance)
  );

const travelModeConfig: Record<TravelMode, { label: string; Icon: typeof Footprints }> = {
  walk: {
    label: "Walking distance",
    Icon: Footprints,
  },
  bus: {
    label: "Bus",
    Icon: BusFront,
  },
  car: {
    label: "Car",
    Icon: CarFront,
  },
};

const RecommendationSection = ({
  id,
  title,
  Icon,
  accentClass,
  items,
}: {
  id: string;
  title: string;
  Icon: typeof UtensilsCrossed;
  accentClass: string;
  items: RecommendationItem[];
}) => {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="flex items-center gap-3 mb-3">
        <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${accentClass}`}>
          <Icon className="h-5 w-5 text-[#2b4463]" />
        </span>
        <div>
          <h2 className="text-3xl font-serif text-[#2b4463]">{title}</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-6">
        {items.map((item) => (
          <article
            key={item.name}
            className="rounded-[24px] border border-[#e7e9df] bg-white p-6 shadow-soft flex flex-col"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b8797]">
                  {item.area}
                </p>
                <h3 className="mt-2 text-2xl font-serif text-[#2b4463] leading-tight">
                  {item.name}
                </h3>
              </div>
              <span className="rounded-full border border-[#dde4cf] bg-[#f4f7ee] px-3 py-1 text-xs font-semibold text-[#607055]">
                Recommended
              </span>
            </div>

            <p className="text-[#495463] leading-7 text-sm sm:text-[15px] flex-1">
              {item.description}
            </p>

            <div className="mt-5 rounded-2xl border border-[#e2e7f0] bg-[#f8fbff] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6c7c90] mb-2">
                Calculated from Via Masaniello 30, Brindisi
              </p>
              <p className="text-sm font-semibold text-[#2b4463]">{item.roughDistance} away from Palazzo Pinto</p>
              <p className="mt-1 text-sm text-[#556171]">{item.estimatedTime}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.travelModes.map((mode) => {
                  const { label, Icon: TravelIcon } = travelModeConfig[mode];

                  return (
                    <span
                      key={mode}
                      className="inline-flex items-center gap-2 rounded-full border border-[#dfe5ef] bg-white px-3 py-1.5 text-xs font-semibold text-[#2b4463]"
                    >
                      <TravelIcon className="h-3.5 w-3.5" />
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-[#f8f6f1] px-4 py-3 border border-[#ece4d8]">
              <p className="text-sm font-semibold text-[#2b4463]">{item.highlight}</p>
            </div>

            <a
              href={buildMapsLink(item)}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center justify-between gap-3 rounded-xl border border-[#dfe5ef] px-4 py-3 text-sm font-semibold text-[#2b4463] hover:border-[#ea836c] hover:text-[#ea836c] transition-colors"
            >
              Open in Google Maps
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
};

const OurRecommendations = () => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>("all");

  const filteredRestaurants = sortByDistance(
    restaurants.filter((item) => matchesDistanceFilter(item, distanceFilter))
  );
  const filteredPlacesInBrindisi = sortByDistance(
    placesInBrindisi.filter((item) => matchesDistanceFilter(item, distanceFilter))
  );
  const filteredPlacesAroundBrindisi = sortByDistance(
    placesAroundBrindisi.filter((item) => matchesDistanceFilter(item, distanceFilter))
  );
  const filteredBeachesAndCoastalTours = sortByDistance(
    beachesAndCoastalTours.filter((item) => matchesDistanceFilter(item, distanceFilter))
  );
  const filteredValleDItriaTour = sortByDistance(
    valleDItriaTour.filter((item) => matchesDistanceFilter(item, distanceFilter))
  );
  const filteredSalentoRoadTrip = sortByDistance(
    salentoRoadTrip.filter((item) => matchesDistanceFilter(item, distanceFilter))
  );

  const showRestaurants =
    categoryFilter === "all" || categoryFilter === "restaurants";
  const showPlacesInBrindisi = categoryFilter === "all" || categoryFilter === "places";
  const showPlacesAroundBrindisi =
    categoryFilter === "all" || categoryFilter === "places-around";
  const showBeachesAndCoastalTours =
    categoryFilter === "all" || categoryFilter === "beaches";
  const showValleDItriaTour =
    categoryFilter === "all" || categoryFilter === "valle-ditria";
  const showSalentoRoadTrip =
    categoryFilter === "all" || categoryFilter === "road-trips";

  return (
    <section className="min-h-[70vh] bg-[#f7f7f7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div>
          <div className="rounded-[30px] border border-[#e7e9df] bg-white p-7 sm:p-10 shadow-soft">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#ea836c] mb-3">
                Palazzo Pinto Curated Guide
              </p>
              <h1 className="text-4xl sm:text-5xl font-serif text-[#2b4463] leading-tight mb-5">
                Our Recommendations
              </h1>
              <div className="space-y-4 text-[#3f4d5f] leading-7 text-[15px] sm:text-base max-w-2xl">
                <p>
                  These are a few nearby places we suggest when you want to eat well and explore {siteConfig.property.city} without overplanning the day.
                </p>
                <p>
                  You can use it for nearby meals, Brindisi historic sites, beaches, and longer coastal road trips through Salento.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#restaurants"
                  className="inline-flex items-center gap-2 rounded-full bg-[#2b4463] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1f334a] transition-colors"
                >
                  <UtensilsCrossed className="h-4 w-4" />
                  Restaurants
                </a>
                <a
                  href="#places"
                  className="inline-flex items-center gap-2 rounded-full border border-[#d7dec9] bg-[#eef1e7] px-5 py-3 text-sm font-semibold text-[#2b4463] hover:border-[#ea836c] hover:text-[#ea836c] transition-colors"
                >
                  <MapPinned className="h-4 w-4" />
                  Places in Brindisi
                </a>
                <a
                  href="#places-around-brindisi"
                  className="inline-flex items-center gap-2 rounded-full border border-[#dfe5ef] bg-[#eef5fb] px-5 py-3 text-sm font-semibold text-[#2b4463] hover:border-[#ea836c] hover:text-[#ea836c] transition-colors"
                >
                  <Landmark className="h-4 w-4" />
                  Places around Brindisi
                </a>
                <a
                  href="#beaches-and-coastal-tours"
                  className="inline-flex items-center gap-2 rounded-full border border-[#ece4d8] bg-[#f8f6f1] px-5 py-3 text-sm font-semibold text-[#2b4463] hover:border-[#ea836c] hover:text-[#ea836c] transition-colors"
                >
                  <MapPinned className="h-4 w-4" />
                  Beaches and Coastal Tours
                </a>
                <a
                  href="#valle-ditria-tour"
                  className="inline-flex items-center gap-2 rounded-full border border-[#dfe5ef] bg-[#eef5fb] px-5 py-3 text-sm font-semibold text-[#2b4463] hover:border-[#ea836c] hover:text-[#ea836c] transition-colors"
                >
                  <Landmark className="h-4 w-4" />
                  Valle d'Itria Tour
                </a>
                <a
                  href="#salento-road-trip"
                  className="inline-flex items-center gap-2 rounded-full border border-[#dfe5ef] bg-white px-5 py-3 text-sm font-semibold text-[#2b4463] hover:border-[#ea836c] hover:text-[#ea836c] transition-colors"
                >
                  <CarFront className="h-4 w-4" />
                  Salento Road Trip
                </a>
              </div>

              <div className="mt-8 rounded-[24px] border border-[#e7e9df] bg-[#fbfcfe] p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ea836c] mb-2">
                      Friendly Filter
                    </p>
                    <h2 className="text-2xl font-serif text-[#2b4463]">Find the right recommendation faster</h2>
                    <p className="mt-2 text-sm text-[#556171]">
                      Filter by category and rough distance from Palazzo Pinto.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter("all");
                      setDistanceFilter("all");
                    }}
                    className="inline-flex items-center justify-center rounded-full border border-[#dfe5ef] bg-white px-4 py-2 text-sm font-semibold text-[#2b4463] hover:border-[#ea836c] hover:text-[#ea836c] transition-colors"
                  >
                    Reset filters
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#6c7c90]">
                      Category
                    </span>
                    <select
                      value={categoryFilter}
                      onChange={(event) =>
                        setCategoryFilter(event.target.value as CategoryFilter)
                      }
                      className="w-full rounded-2xl border border-[#dfe5ef] bg-white px-4 py-3 text-sm font-semibold text-[#2b4463] focus:outline-none focus:ring-2 focus:ring-[#aab09a]"
                    >
                      <option value="all">All categories</option>
                      <option value="restaurants">Restaurants</option>
                      <option value="places">Places in Brindisi</option>
                      <option value="places-around">Places around Brindisi</option>
                      <option value="beaches">Beaches and Coastal Tours</option>
                      <option value="valle-ditria">Valle d'Itria Tour</option>
                      <option value="road-trips">Salento Road Trip</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#6c7c90]">
                      Distance
                    </span>
                    <select
                      value={distanceFilter}
                      onChange={(event) =>
                        setDistanceFilter(event.target.value as DistanceFilter)
                      }
                      className="w-full rounded-2xl border border-[#dfe5ef] bg-white px-4 py-3 text-sm font-semibold text-[#2b4463] focus:outline-none focus:ring-2 focus:ring-[#aab09a]"
                    >
                      <option value="all">Any distance</option>
                      <option value="1">Up to 1 km</option>
                      <option value="5">Up to 5 km</option>
                      <option value="15">Up to 15 km</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="mt-10 space-y-12">
          {showRestaurants && filteredRestaurants.length > 0 && (
            <RecommendationSection
              id="restaurants"
              title="Restaurants"
              Icon={UtensilsCrossed}
              accentClass="bg-[#eef1e7]"
              items={filteredRestaurants}
            />
          )}

          {showPlacesInBrindisi && filteredPlacesInBrindisi.length > 0 && (
            <RecommendationSection
              id="places"
              title="Places in Brindisi"
              Icon={Landmark}
              accentClass="bg-[#eef5fb]"
              items={filteredPlacesInBrindisi}
            />
          )}

          {showPlacesAroundBrindisi && filteredPlacesAroundBrindisi.length > 0 && (
            <RecommendationSection
              id="places-around-brindisi"
              title="Places around Brindisi"
              Icon={MapPinned}
              accentClass="bg-[#f5f1ea]"
              items={filteredPlacesAroundBrindisi}
            />
          )}

          {showBeachesAndCoastalTours && filteredBeachesAndCoastalTours.length > 0 && (
            <section className="space-y-5">
              <div className="rounded-[24px] border border-[#ece4d8] bg-[#f8f6f1] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ea836c] mb-2">
                  Accessible Via Car And Bus
                </p>
                <p className="text-sm text-[#556171] leading-6">
                  A practical group of coastal ideas for guests who want beaches and sea outings that can be reached from Palazzo Pinto by car or public transport planning.
                </p>
              </div>

              <RecommendationSection
                id="beaches-and-coastal-tours"
                title="Beaches and Coastal Tours"
                Icon={Trees}
                accentClass="bg-[#f8f6f1]"
                items={filteredBeachesAndCoastalTours}
              />
            </section>
          )}

          {showValleDItriaTour && filteredValleDItriaTour.length > 0 && (
            <section className="space-y-5">
              <div className="rounded-[24px] border border-[#dfe5ef] bg-[#f8fbff] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ea836c] mb-2">
                  By Car Valley Tour
                </p>
                <p className="text-sm text-[#556171] leading-6">
                  A simple inland route through the white towns and food stops of Valle d'Itria, ideal for a full-day drive from Brindisi.
                </p>
              </div>

              <RecommendationSection
                id="valle-ditria-tour"
                title="Valle d'Itria Tour"
                Icon={Landmark}
                accentClass="bg-[#eef5fb]"
                items={filteredValleDItriaTour}
              />
            </section>
          )}

          {showSalentoRoadTrip && filteredSalentoRoadTrip.length > 0 && (
            <section className="space-y-5">
              <div className="rounded-[24px] border border-[#dfe5ef] bg-[#f8fbff] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ea836c] mb-2">
                  By Car Day Trip
                </p>
                <p className="text-sm text-[#556171] leading-6">
                  A good choice for a full-day or two-day drive through some of the best coastal towns, beaches, and sea views in Salento.
                </p>
              </div>

              <RecommendationSection
                id="salento-road-trip"
                title="Salento Road Trip"
                Icon={CarFront}
                accentClass="bg-[#eef5fb]"
                items={filteredSalentoRoadTrip}
              />
            </section>
          )}

          {((showRestaurants && filteredRestaurants.length === 0) ||
            (showPlacesInBrindisi && filteredPlacesInBrindisi.length === 0) ||
            (showPlacesAroundBrindisi && filteredPlacesAroundBrindisi.length === 0) ||
            (showBeachesAndCoastalTours && filteredBeachesAndCoastalTours.length === 0) ||
            (showValleDItriaTour && filteredValleDItriaTour.length === 0) ||
            (showSalentoRoadTrip && filteredSalentoRoadTrip.length === 0)) &&
            filteredRestaurants.length +
              filteredPlacesInBrindisi.length +
              filteredPlacesAroundBrindisi.length +
              filteredBeachesAndCoastalTours.length +
              filteredValleDItriaTour.length +
              filteredSalentoRoadTrip.length ===
              0 && (
              <div className="rounded-[24px] border border-[#e7e9df] bg-white px-6 py-8 text-center shadow-soft">
                <h2 className="text-2xl font-serif text-[#2b4463]">No matches for this filter</h2>
                <p className="mt-2 text-sm text-[#556171]">
                  Try a wider distance or switch back to all categories.
                </p>
              </div>
            )}
        </div>
      </div>
    </section>
  );
};

export default OurRecommendations;