import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import useSearchContext from "../hooks/useSearchContext";
import { siteConfig } from "../config/siteConfig";

type Slide = {
  src: string;
  alt: string;
};

const HomeSlideshowHero = () => {
  const navigate = useNavigate();
  const search = useSearchContext();

  const slides: Slide[] = useMemo(
    () => [
      {
        src: "/home/sildeshow/BR-14.jpg",
        alt: "Palazzo Pinto coastal landmark",
      },
      {
        src: "/home/sildeshow/IMG_2226-copia.jpg",
        alt: "Historic architecture near Palazzo Pinto",
      },
      {
        src: "/home/sildeshow/IMG_8900.jpg",
        alt: "Palazzo Pinto interior ambiance",
      },
      {
        src: "/home/sildeshow/regata2018.jpg",
        alt: "Brindisi waterfront atmosphere",
      },
    ],
    []
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [checkIn, setCheckIn] = useState<Date>(search.checkIn);
  const [checkOut, setCheckOut] = useState<Date>(search.checkOut);
  const [guests, setGuests] = useState<number>(Math.max(1, search.adultCount));

  useEffect(() => {
    if (slides.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  const minDate = new Date();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const normalizedCheckOut = checkOut < checkIn ? checkIn : checkOut;

    search.saveSearchValues("", checkIn, normalizedCheckOut, guests, 0);

    if (siteConfig.singlePropertyMode) {
      navigate("/rooms");
      return;
    }

    navigate("/search");
  };

  return (
    <section className="relative w-full overflow-visible bg-[#c7cabd]">
      <div className="relative h-[56vh] min-h-[430px] sm:h-[62vh] lg:h-[70vh]">
        {slides.map((slide, index) => (
          <img
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ${
              index === activeIndex ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}

        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/45" />

        <div className="relative z-10 mx-auto flex h-full max-w-8xl items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="mb-2 text-sm uppercase tracking-[0.35em] text-[#f4d6cd] sm:text-base">
              Palazzo Pinto
            </p>
            <h1 className="font-serif text-5xl font-semibold leading-none text-white sm:text-6xl lg:text-7xl">
              Welcome
            </h1>
            <p className="mt-5 text-lg font-medium text-white/95 sm:text-2xl">
              {siteConfig.brand.tagline}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Previous slide"
          onClick={() =>
            setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length)
          }
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/85 px-3 py-2 text-lg text-[#2b4463] shadow-md hover:bg-white"
        >
          &#8592;
        </button>
        <button
          type="button"
          aria-label="Next slide"
          onClick={() => setActiveIndex((prev) => (prev + 1) % slides.length)}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/85 px-3 py-2 text-lg text-[#2b4463] shadow-md hover:bg-white"
        >
          &#8594;
        </button>

        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
          {slides.map((slide, index) => (
            <button
              key={`${slide.src}-dot`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`h-2.5 w-2.5 rounded-full transition-all ${
                index === activeIndex ? "w-7 bg-[#ea836c]" : "bg-white/75"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="relative z-20 mx-auto -mt-10 max-w-5xl px-4 pb-6 sm:px-6 lg:px-8">
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-md bg-white p-4 shadow-large md:grid-cols-[1.1fr_1.1fr_0.9fr_1fr] md:gap-4 md:p-5"
        >
          <DatePicker
            selected={checkIn}
            onChange={(date) => setCheckIn((date as Date) || minDate)}
            selectsStart
            startDate={checkIn}
            endDate={checkOut}
            minDate={minDate}
            placeholderText="Check In"
            className="h-12 w-full rounded-sm border border-[#d9ddd3] px-3 text-sm text-[#2b4463] outline-none focus:border-[#ea836c]"
            wrapperClassName="w-full"
            dateFormat="dd/MM/yyyy"
          />

          <DatePicker
            selected={checkOut}
            onChange={(date) => setCheckOut((date as Date) || checkIn)}
            selectsEnd
            startDate={checkIn}
            endDate={checkOut}
            minDate={checkIn}
            placeholderText="Check Out"
            className="h-12 w-full rounded-sm border border-[#d9ddd3] px-3 text-sm text-[#2b4463] outline-none focus:border-[#ea836c]"
            wrapperClassName="w-full"
            dateFormat="dd/MM/yyyy"
          />

          <select
            value={guests}
            onChange={(event) => setGuests(parseInt(event.target.value, 10))}
            className="h-12 w-full rounded-sm border border-[#d9ddd3] bg-white px-3 text-sm text-[#2b4463] outline-none focus:border-[#ea836c]"
          >
            {Array.from({ length: 8 }, (_, i) => i + 1).map((count) => (
              <option key={count} value={count}>
                Guests {count}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="h-12 rounded-sm bg-[#ea836c] px-6 text-sm font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#db755f]"
          >
            Check Availability
          </button>
        </form>
      </div>
    </section>
  );
};

export default HomeSlideshowHero;