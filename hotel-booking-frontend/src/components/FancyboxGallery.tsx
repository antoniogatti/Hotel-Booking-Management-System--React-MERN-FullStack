import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { Fancybox } from "@fancyapps/ui/dist/fancybox/";
import "@fancyapps/ui/dist/fancybox/fancybox.css";

type FancyboxGalleryProps = {
  images: string[];
  title: string;
};

const FancyboxGallery = ({ images, title }: FancyboxGalleryProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const groupName = useMemo(
    () => `room-gallery-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    [title]
  );

  const total = images.length;

  const goPrev = () => {
    if (total === 0) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  };

  const goNext = () => {
    if (total === 0) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = touchStartX.current;
    const endX = event.changedTouches[0]?.clientX;

    if (startX == null || endX == null) return;

    const delta = endX - startX;
    if (Math.abs(delta) < 40) return;

    if (delta > 0) {
      goPrev();
      return;
    }

    goNext();
  };

  useEffect(() => {
    const selector = `[data-fancybox=\"${groupName}\"]`;

    Fancybox.bind(selector);

    return () => {
      Fancybox.unbind(selector);
      Fancybox.close();
    };
  }, [groupName]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        setCurrentIndex((prev) => (prev - 1 + total) % total);
      }

      if (event.key === "ArrowRight") {
        setCurrentIndex((prev) => (prev + 1) % total);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [total]);

  if (total === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-md bg-stone-100"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <a
          href={currentImage}
          data-fancybox={groupName}
          data-caption={`${title} - Photo ${currentIndex + 1}`}
          className="block h-[220px] sm:h-[300px] lg:h-[380px]"
        >
          <img
            src={currentImage}
            alt={`${title} gallery ${currentIndex + 1}`}
            className="h-full w-full object-cover object-center"
          />
        </a>

        {/* Hidden anchors let Fancybox navigate the full set without rendering all slides visually. */}
        <div className="hidden">
          {images.map((image, i) => (
            <a
              key={`${image}-${i}`}
              href={image}
              data-fancybox={groupName}
              data-caption={`${title} - Photo ${i + 1}`}
            >
              {`Photo ${i + 1}`}
            </a>
          ))}
        </div>

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-sm font-medium text-stone-800 shadow-sm transition hover:bg-white"
            >
              <span aria-hidden="true">&#8592;</span>
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-sm font-medium text-stone-800 shadow-sm transition hover:bg-white"
            >
              <span aria-hidden="true">&#8594;</span>
            </button>
          </>
        )}

        <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
          {currentIndex + 1} / {total}
        </span>
      </div>

      {total > 1 && (
        <div className="w-full overflow-x-auto pb-1">
          <div className="flex min-w-max items-center gap-2">
            {images.map((image, i) => (
              <button
                type="button"
                key={`thumb-${i}-${image}`}
                onClick={() => setCurrentIndex(i)}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded border transition ${
                  i === currentIndex
                    ? "border-stone-800 ring-1 ring-stone-800"
                    : "border-stone-300 opacity-85 hover:opacity-100"
                }`}
                aria-label={`Show photo ${i + 1}`}
              >
                <img
                  src={image}
                  alt={`${title} thumbnail ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default FancyboxGallery;
