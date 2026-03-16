import { useNavigate } from "react-router-dom";
import { Mail, MapPin } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import useSearchContext from "../hooks/useSearchContext";
import MobileNav from "./MobileNav";
import MainNav from "./MainNav";
import { siteConfig } from "../config/siteConfig";

const Header = () => {
  const search = useSearchContext();
  const navigate = useNavigate();
  const mapsQuery = encodeURIComponent(
    `${siteConfig.brand.shortName}, ${siteConfig.contact.address}`
  );
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const handleLogoClick = () => {
    search.clearSearchValues();
    navigate("/");
  };

  return (
    <header className="bg-white border-b-2 border-[#aab09a] shadow-large sticky top-0 z-50 shrink-0">
      <div className="min-h-8 py-1 bg-[#eef1e7] border-b border-[#d6dbc9]">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 h-full w-full flex items-center justify-between gap-3 text-[11px] sm:text-xs text-[#6f7f67]">
          <a
            href={mapsLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 tracking-[0.03em] hover:text-[#ea836c] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eef1e7] rounded-sm"
            title="Open address in Google Maps"
            aria-label="Open address in Google Maps"
          >
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate uppercase">Google Maps</span>
          </a>

          <div className="hidden md:flex items-center gap-4">
            <a
              href={`https://wa.me/${siteConfig.contact.whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-[#ea836c] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eef1e7] rounded-sm"
              title="WhatsApp"
            >
              <FaWhatsapp className="h-3.5 w-3.5" />
              <span>{siteConfig.contact.phone}</span>
            </a>
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="inline-flex items-center gap-1.5 hover:text-[#ea836c] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eef1e7] rounded-sm"
              title="Email"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>{siteConfig.contact.email}</span>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 w-full h-[72px]">
        <div className="flex justify-between items-center h-full">
          <button
            onClick={handleLogoClick}
            className="flex items-center space-x-2 group"
            aria-label={`${siteConfig.brand.shortName} home`}
          >
            <img
              src="/common/immagineprofilo.png"
              alt={siteConfig.brand.fullName}
              className="h-12 w-auto object-contain rounded-md bg-[#f8f6f1] px-2 py-1 shadow-soft group-hover:shadow-medium transition-all duration-300"
            />
            <span className="text-[#2b4463] font-serif text-xl sm:text-2xl font-semibold tracking-[0.02em] leading-none">
              {siteConfig.brand.shortName}
            </span>
          </button>
          <div className="md:hidden">
            <MobileNav />
          </div>
          <div className="hidden md:flex items-center">
            <MainNav />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
