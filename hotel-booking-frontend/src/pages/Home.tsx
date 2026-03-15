import { useQuery } from "react-query";
import * as apiClient from "../api-client";
import LatestDestinationCard from "../components/LastestDestinationCard";
import HomeSlideshowHero from "../components/HomeSlideshowHero";
import { Link } from "react-router-dom";
import { siteConfig } from "../config/siteConfig";

const Home = () => {
  const { data: hotels } = useQuery("fetchQuery", () =>
    apiClient.fetchHotels()
  );

  return (
    <>
      <HomeSlideshowHero />
      <div className="space-y-8">
        {/* Story + Rooms Section */}
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 items-center">
            <div>
              <p className="uppercase tracking-[0.2em] text-primary-700 text-sm mb-3 font-semibold">
                Since 1901
              </p>
              <h2 className="text-4xl md:text-5xl font-serif font-semibold text-gray-900 mb-4 leading-tight">
                {siteConfig.brand.fullName}
              </h2>
              <p className="text-gray-600 leading-relaxed text-lg">
                {siteConfig.property.story}
              </p>
            </div>
            <div className="bg-gradient-to-br from-primary-50 to-amber-50 border border-primary-100 rounded-2xl p-8 shadow-soft">
              <h3 className="text-2xl font-serif text-gray-900 mb-3">Our Rooms</h3>
              <p className="text-gray-700 mb-6">
                Explore elegant rooms and apartments inspired by local character,
                with modern comforts for short and extended stays.
              </p>
              <Link
                to={siteConfig.singlePropertyMode ? "/rooms" : "/search"}
                className="inline-flex items-center rounded-full bg-primary-700 text-white px-6 py-3 font-semibold hover:bg-primary-800 transition-colors"
              >
                View all rooms
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {hotels?.slice(0, 6).map((hotel) => (
              <LatestDestinationCard key={hotel._id} hotel={hotel} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
