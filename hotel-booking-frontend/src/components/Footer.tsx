import {
  Mail,
  Phone,
  MapPin,
  MessageCircle,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
} from "lucide-react";
import { Link } from "react-router-dom";
import { siteConfig } from "../config/siteConfig";

const Footer = () => {
  return (
    <footer className="bg-gradient-to-r from-primary-900 to-primary-950 text-white">
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <img
              src={siteConfig.brand.logoPath}
              alt={siteConfig.brand.fullName}
              className="h-16 w-auto object-contain rounded-md bg-white/95 px-2 py-1"
            />
            <p className="text-gray-300 leading-relaxed">
              {siteConfig.brand.tagline}. Boutique hospitality in {siteConfig.property.city}.
            </p>
            <div className="flex space-x-4">
              <a
                href={`https://wa.me/${siteConfig.contact.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="text-gray-300 hover:text-white transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
              <a
                href={siteConfig.social.facebook}
                target="_blank"
                rel="noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href={siteConfig.social.youtube}
                target="_blank"
                rel="noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
              >
                <Youtube className="w-5 h-5" />
              </a>
              <a
                href={siteConfig.social.instagram}
                target="_blank"
                rel="noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href={siteConfig.social.linkedin}
                target="_blank"
                rel="noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Explore</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-300 hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to={siteConfig.singlePropertyMode ? "/rooms" : "/search"}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Rooms
                </Link>
              </li>
              <li>
                <a
                  href={siteConfig.links.services}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Services
                </a>
              </li>
              <li>
                <a
                  href={siteConfig.links.contact}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Contact Us
                </a>
              </li>
            </ul>
          </div>

          {/* Stay */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Stay With Us</h3>
            <ul className="space-y-2">
              <li>
                <span className="text-gray-300">Historic boutique mansion</span>
              </li>
              <li>
                <span className="text-gray-300">5 minutes from station</span>
              </li>
              <li>
                <span className="text-gray-300">Quiet central location</span>
              </li>
              <li>
                <a
                  href={siteConfig.links.rooms}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  View original room gallery
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Contact Us</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-primary-300" />
                <a
                  href={`mailto:${siteConfig.contact.email}`}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {siteConfig.contact.email}
                </a>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-primary-300" />
                <a
                  href={`https://wa.me/${siteConfig.contact.whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {siteConfig.contact.phone}
                </a>
              </div>
              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-primary-300" />
                <span className="text-gray-300">{siteConfig.contact.address}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-primary-700 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-300 text-sm">
            © 2026 {siteConfig.brand.shortName}. All rights reserved.
          </p>
          <div className="flex items-center gap-6 mt-4 md:mt-0">
            <p className="text-gray-300 text-sm">
              Version {siteConfig.app.version}
            </p>
            <a
              href={siteConfig.links.website}
              target="_blank"
              rel="noreferrer"
              className="text-gray-300 hover:text-white text-sm transition-colors"
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
