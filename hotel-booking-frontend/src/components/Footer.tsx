import {
  Mail,
  MapPin,
  MessageCircle,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Link } from "react-router-dom";
import { siteConfig } from "../config/siteConfig";

const Footer = () => {
  const mapsQuery = encodeURIComponent(siteConfig.contact.address);
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return (
    <footer className="bg-[#c7cabd] text-[#2b4463] border-t border-[#b6baa8]">
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <img
              src="/common/LOGO_PalazzoPinto.svg"
              alt={siteConfig.brand.fullName}
              className="h-16 w-auto object-contain rounded-md bg-[#f2eee6] px-2 py-1"
            />
            <p className="text-[#2b4463]/90 leading-relaxed">
              {siteConfig.brand.tagline}. Boutique hospitality in {siteConfig.property.city}.
            </p>
            <div className="flex space-x-4">
              <a
                href={`https://wa.me/${siteConfig.contact.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="text-[#2b4463]/80 hover:text-[#ea836c] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#c7cabd] rounded-sm"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
              <a
                href={siteConfig.social.facebook}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="text-[#2b4463]/80 hover:text-[#ea836c] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#c7cabd] rounded-sm"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href={siteConfig.social.youtube}
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="text-[#2b4463]/80 hover:text-[#ea836c] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#c7cabd] rounded-sm"
              >
                <Youtube className="w-5 h-5" />
              </a>
              <a
                href={siteConfig.social.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="text-[#2b4463]/80 hover:text-[#ea836c] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#c7cabd] rounded-sm"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href={siteConfig.social.linkedin}
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
                className="text-[#2b4463]/80 hover:text-[#ea836c] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#c7cabd] rounded-sm"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#2b4463]">Explore</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to={siteConfig.singlePropertyMode ? "/rooms" : "/search"}
                  className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors"
                >
                  Rooms
                </Link>
              </li>
              <li>
                <a
                  href={siteConfig.links.services}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors"
                >
                  Services
                </a>
              </li>
              <li>
                <Link
                  to="/contact-us"
                  className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Stay */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#2b4463]">Stay With Us</h3>
            <ul className="space-y-2">
              <li>
                <span className="text-[#2b4463]/85">Historic boutique mansion</span>
              </li>
              <li>
                <span className="text-[#2b4463]/85">5 minutes from station</span>
              </li>
              <li>
                <span className="text-[#2b4463]/85">Quiet central location</span>
              </li>
              <li>
                <a
                  href={siteConfig.links.rooms}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors"
                >
                  View original room gallery
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#2b4463]">Contact Us</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-[#ea836c]" />
                <a
                  href={`mailto:${siteConfig.contact.email}`}
                  className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#c7cabd] rounded-sm"
                >
                  {siteConfig.contact.email}
                </a>
              </div>
              <div className="flex items-center space-x-3">
                <FaWhatsapp className="w-5 h-5 text-[#ea836c]" />
                <a
                  href={`https://wa.me/${siteConfig.contact.whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#c7cabd] rounded-sm"
                >
                  {siteConfig.contact.phone}
                </a>
              </div>
              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-[#ea836c]" />
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#c7cabd] rounded-sm"
                >
                  {siteConfig.contact.address}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-[#aab09a] mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-[#2b4463]/80 text-sm">
            © 2026 {siteConfig.brand.shortName}. All rights reserved.
          </p>
          <div className="flex items-center gap-6 mt-4 md:mt-0">
            <p className="text-[#2b4463]/80 text-sm">
              Version {siteConfig.app.version}
            </p>
            <Link
              to="/privacy-cookie-policy"
              className="text-[#2b4463]/85 hover:text-[#ea836c] text-sm transition-colors"
            >
              Privacy & Cookies
            </Link>
            <Link
              to="/terms-conditions"
              className="text-[#2b4463]/85 hover:text-[#ea836c] text-sm transition-colors"
            >
              Terms & Conditions
            </Link>
            <a
              href={siteConfig.links.website}
              target="_blank"
              rel="noreferrer"
              className="text-[#2b4463]/85 hover:text-[#ea836c] text-sm transition-colors"
            >
              Official Website
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
