import { Menu, X } from "lucide-react";
import { Separator } from "./ui/separator";
import MobileNavLinks from "./MobileNavLinks";
import { useEffect, useState } from "react";

const MobileNav = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={isOpen}
        aria-controls="mobile-site-nav"
        className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        onClick={() => setIsOpen(true)}
      >
        <Menu className="h-6 w-6 text-[#2b4463]" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" aria-hidden={!isOpen}>
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />

          <aside
            id="mobile-site-nav"
            aria-label="Mobile navigation"
            className="absolute inset-y-0 right-0 flex w-[min(22rem,85vw)] flex-col bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-left text-lg font-semibold text-gray-900">Menu</h2>
              <button
                type="button"
                aria-label="Close menu"
                className="rounded-sm p-1 text-gray-500 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a]"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Separator className="mt-4" />
            <div className="flex-1 pt-4 text-left">
              <MobileNavLinks onNavigate={() => setIsOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      <div className="sr-only" aria-live="polite">
        {isOpen ? "Navigation menu open" : "Navigation menu closed"}
      </div>
    </>
  );
};

export default MobileNav;
