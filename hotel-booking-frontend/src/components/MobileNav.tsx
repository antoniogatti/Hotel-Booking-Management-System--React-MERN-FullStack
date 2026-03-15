import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Separator } from "./ui/separator";
import MobileNavLinks from "./MobileNavLinks";

const MobileNav = () => {
  return (
    <Sheet>
      <SheetTrigger
        aria-label="Open menu"
        className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        <Menu className="h-6 w-6 text-[#2b4463]" />
      </SheetTrigger>
      <SheetContent className="flex flex-col bg-white" side="right">
        <SheetTitle className="text-left text-gray-900">Menu</SheetTitle>
        <Separator />
        <SheetDescription className="flex-1 pt-4 flex flex-col text-left">
          <MobileNavLinks />
        </SheetDescription>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;
