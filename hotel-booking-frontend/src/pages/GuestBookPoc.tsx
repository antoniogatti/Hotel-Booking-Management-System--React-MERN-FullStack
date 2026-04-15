import { forwardRef, type ReactNode, useEffect, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Feather,
  Maximize2,
  Minimize2,
  ScanSearch,
} from "lucide-react";

type FlipEvent = {
  data: number;
};

type FlipController = {
  flipNext: (corner?: "top" | "bottom") => void;
  flipPrev: (corner?: "top" | "bottom") => void;
};

type FlipBookHandle = {
  pageFlip: () => FlipController;
};

type GuestEntry = {
  id: string;
  guestName: string;
  stayLabel: string;
  message: string;
  note: string;
  imageSrc: string;
  imageAlt: string;
  accentClassName: string;
};

type GuestBookSheetProps = {
  children: ReactNode;
  className?: string;
};

const guestEntries: GuestEntry[] = [
  {
    id: "1",
    guestName: "Sofia & Marco",
    stayLabel: "Spring weekend in Brindisi",
    message:
      "A house full of grace. We arrived tired and left with the feeling of having visited dear friends.",
    note:
      "Replace this panel with a scanned guest-book page while keeping the surrounding paper frame.",
    imageSrc: "/home/home-story.png",
    imageAlt: "Historic illustration used as a placeholder for a guest book scan",
    accentClassName: "from-[#d7b983] via-[#c69062] to-[#9d5b41]",
  },
  {
    id: "2",
    guestName: "Helen, York",
    stayLabel: "One night before sailing",
    message:
      "The quiet atmosphere, breakfast on the terrace and the kindness of the team turned a stopover into a memory.",
    note:
      "A real version could show the handwritten scan on top and the transcription in the lower section.",
    imageSrc: "/staff/anna.png",
    imageAlt: "Portrait placeholder for a future digitised guest message",
    accentClassName: "from-[#c5d1b8] via-[#9fb08b] to-[#61755f]",
  },
  {
    id: "3",
    guestName: "Tomoko & Emi",
    stayLabel: "Three nights in early summer",
    message:
      "We loved the old-world details, the calm rooms and how easy it felt to explore Brindisi from here.",
    note:
      "Scanned pages can be cropped and lightly color-corrected, then exported as web-sized JPG or WebP files.",
    imageSrc: "/aleatico/Bedroom-1-scaled.jpg",
    imageAlt: "Bedroom placeholder for a guest book memory spread",
    accentClassName: "from-[#d4c2b2] via-[#bc9d83] to-[#7f5b4c]",
  },
  {
    id: "4",
    guestName: "Luc & Claire",
    stayLabel: "Late summer stay",
    message:
      "An elegant refuge. The building itself feels like part of the journey, not only the place you sleep.",
    note:
      "If you want, the last step later can add OCR or manual transcription for search and accessibility.",
    imageSrc: "/colazione/WhatsApp-Image-2021-08-13-at-15.27.29.jpeg",
    imageAlt: "Breakfast placeholder for a guest book spread",
    accentClassName: "from-[#f2d3b0] via-[#e6a66f] to-[#a65b39]",
  },
];

const GuestBookSheet = forwardRef<HTMLDivElement, GuestBookSheetProps>(
  ({ children, className = "" }, ref) => {
    return (
      <div
        ref={ref}
        className={`relative h-full w-full overflow-hidden rounded-[8px] border border-[#d5cab7] bg-[#f7f0e2] text-[#2f3f57] ${className}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.86),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.16),transparent_26%,rgba(120,87,42,0.05)_100%)]" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#c9b69b]/40 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#b89f78]/10 to-transparent" />
        {children}
      </div>
    );
  },
);

GuestBookSheet.displayName = "GuestBookSheet";

const GuestBookPoc = () => {
  const bookRef = useRef<FlipBookHandle | null>(null);
  const fullscreenHostRef = useRef<HTMLDivElement | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const totalPages = guestEntries.length + 3;
  const isAtStart = currentPage === 0;
  const isAtEnd = currentPage >= totalPages - 1;
  const bookWidth = isFullscreen ? 560 : 440;
  const bookHeight = isFullscreen ? 790 : 620;
  const bookMinWidth = isFullscreen ? 320 : 280;
  const bookMaxWidth = isFullscreen ? 760 : 440;
  const bookMinHeight = isFullscreen ? 451 : 360;
  const bookMaxHeight = isFullscreen ? 1070 : 620;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === fullscreenHostRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handlePrevious = () => {
    if (!isAtStart) {
      bookRef.current?.pageFlip().flipPrev("top");
    }
  };

  const handleNext = () => {
    if (!isAtEnd) {
      bookRef.current?.pageFlip().flipNext("top");
    }
  };

  const handleFullscreenToggle = async () => {
    if (!fullscreenHostRef.current) {
      return;
    }

    if (document.fullscreenElement === fullscreenHostRef.current) {
      await document.exitFullscreen();
      return;
    }

    await fullscreenHostRef.current.requestFullscreen();
  };

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[#ddd3c2] bg-[linear-gradient(180deg,#fbf8f1_0%,#f2ecdf_100%)] shadow-[0_28px_70px_rgba(47,63,87,0.14)]">
      <div className="pointer-events-none absolute left-[-8%] top-[-8%] h-64 w-64 rounded-full bg-[#d6b784]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-8%] h-72 w-72 rounded-full bg-[#9fb08b]/20 blur-3xl" />

      <div className="relative grid gap-10 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-12 lg:px-10 lg:py-10">
        <div className="flex flex-col justify-between gap-8">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#9d7151]">
              Digital Guest Book Prototype
            </p>
            <h1 className="font-serif text-4xl font-semibold leading-tight text-[#2b4463] sm:text-5xl">
              A page-turning home for your handwritten memories.
            </h1>
            <p className="mt-5 max-w-[34ch] text-base leading-8 text-[#536276]">
              This proof of concept uses a realistic flip-book interaction, a decorative cover and placeholder guest pages. Later, each page can be swapped with a photo of the real guest book.
            </p>
          </div>

          <div className="grid gap-4">
            <article className="rounded-[22px] border border-[#e4d9c8] bg-white/80 p-5 shadow-[0_18px_35px_rgba(47,63,87,0.08)] backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-full bg-[#f5ede1] p-3 text-[#9d7151]">
                  <ScanSearch size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#2f3f57]">Best workflow</h2>
                  <p className="mt-2 text-sm leading-7 text-[#5e6f84]">
                    Photograph each spread in even light, crop it, export a web-sized file, then place it in the book as a full-page image.
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-[22px] border border-[#e4d9c8] bg-white/80 p-5 shadow-[0_18px_35px_rgba(47,63,87,0.08)] backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-full bg-[#eef3ec] p-3 text-[#6f8362]">
                  <Feather size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#2f3f57]">Readable and authentic</h2>
                  <p className="mt-2 text-sm leading-7 text-[#5e6f84]">
                    You can keep the original handwriting visible and optionally add typed transcription below each page later.
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-[22px] border border-[#e4d9c8] bg-white/80 p-5 shadow-[0_18px_35px_rgba(47,63,87,0.08)] backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-full bg-[#eef1f7] p-3 text-[#2b4463]">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#2f3f57]">Route for testing</h2>
                  <p className="mt-2 text-sm leading-7 text-[#5e6f84]">
                    Open <span className="rounded bg-[#f7f2e8] px-2 py-1 font-semibold text-[#7b5b41]">/guest-book-poc</span> and use the arrows or click the page edge.
                  </p>
                </div>
              </div>
            </article>
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-center justify-center gap-5">
          <div
            ref={fullscreenHostRef}
            className={
              isFullscreen
                ? "flex h-full min-h-screen w-full flex-col justify-center bg-[radial-gradient(circle_at_top,#fff9f0_0%,#ead8bc_38%,#c89a68_100%)] px-4 py-6 sm:px-8"
                : "w-full"
            }
          >
            <div className="mb-4 flex items-center justify-end">
              <button
                type="button"
                onClick={handleFullscreenToggle}
                className="inline-flex items-center gap-2 rounded-full border border-[#d8ccb8] bg-white/90 px-4 py-2.5 text-sm font-semibold text-[#2f3f57] shadow-[0_12px_24px_rgba(47,63,87,0.08)] transition hover:border-[#c4a178] hover:text-[#9d7151]"
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              </button>
            </div>

            <div className="w-full rounded-[28px] border border-[#d8ccb7] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(248,243,234,0.92))] px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_18px_40px_rgba(47,63,87,0.12)] sm:px-5 sm:py-6">
            <HTMLFlipBook
              key={isFullscreen ? "fullscreen" : "default"}
              ref={bookRef}
              width={bookWidth}
              height={bookHeight}
              minWidth={bookMinWidth}
              maxWidth={bookMaxWidth}
              minHeight={bookMinHeight}
              maxHeight={bookMaxHeight}
              size="stretch"
              startPage={currentPage}
              drawShadow
              flippingTime={900}
              usePortrait
              startZIndex={0}
              autoSize
              maxShadowOpacity={0.22}
              showCover
              mobileScrollSupport
              clickEventForward
              useMouseEvents
              swipeDistance={24}
              showPageCorners
              disableFlipByClick={false}
              className="mx-auto"
              style={{ margin: "0 auto" }}
              onFlip={(event: FlipEvent) => setCurrentPage(event.data)}
            >
              <GuestBookSheet className="bg-[linear-gradient(165deg,#efe2ca_0%,#d8ba8d_46%,#b27d55_100%)] text-[#2f3f57]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.5),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.16),transparent_44%),linear-gradient(180deg,rgba(116,71,35,0.05),rgba(68,39,18,0.16))]" />
                <div className="relative flex h-full flex-col items-center justify-between px-8 py-10 text-center">
                  <div className="rounded-full border border-[#f6efe4] px-4 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.34em] text-[#7b5b41] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                    Palazzo Pinto
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.36em] text-[#8c613e]">Guest memories</p>
                    <h2 className="mt-5 font-serif text-5xl font-semibold leading-none sm:text-6xl">
                      Guest Book
                    </h2>
                    <p className="mx-auto mt-5 max-w-[18ch] text-base leading-7 text-[#43546a]">
                      A digital keepsake built from the pages guests once signed by hand.
                    </p>
                  </div>
                  <div className="w-full">
                    <img
                      src="/common/LOGOPAYOFF_PalazzoPinto.png"
                      alt="Palazzo Pinto logo"
                      className="mx-auto w-full max-w-[220px] object-contain drop-shadow-[0_10px_18px_rgba(255,255,255,0.18)]"
                    />
                    <p className="mt-6 text-xs uppercase tracking-[0.3em] text-[#5d4638]">
                      Prototype cover
                    </p>
                  </div>
                </div>
              </GuestBookSheet>

              <GuestBookSheet>
                <div className="relative flex h-full flex-col px-8 py-9">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9d7151]">
                    Inside cover
                  </p>
                  <h2 className="mt-5 max-w-[12ch] font-serif text-4xl font-semibold leading-tight text-[#2f3f57]">
                    This is where your scanned pages start to feel alive.
                  </h2>
                  <p className="mt-5 max-w-[28ch] text-base leading-8 text-[#55667a]">
                    The right side turns like a book, the cover behaves like a hard page, and each interior page can hold a full scan or a scan plus transcription.
                  </p>

                  <div className="mt-8 grid gap-3">
                    {[
                      "Use one photo or scan per page.",
                      "Keep page lighting and crop consistent.",
                      "Start with 8 to 12 pages before digitising the full book.",
                    ].map((item) => (
                      <div
                        key={item}
                        className="rounded-[18px] border border-[#e4d8c6] bg-white/80 px-4 py-3 text-sm leading-7 text-[#5e6f84]"
                      >
                        {item}
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-[#e3d8c7] pt-5 text-xs uppercase tracking-[0.28em] text-[#9c8a74]">
                    <span>Click page edge</span>
                    <span>01</span>
                  </div>
                </div>
              </GuestBookSheet>

              {guestEntries.map((entry, index) => (
                <GuestBookSheet key={entry.id}>
                  <div className="relative flex h-full flex-col px-7 py-7">
                    <div className={`absolute left-0 top-0 h-2 w-full bg-gradient-to-r ${entry.accentClassName}`} />
                    <div className="grid h-full grid-rows-[auto_1fr_auto] gap-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#9d7151]">
                          {entry.stayLabel}
                        </p>
                        <h2 className="mt-3 font-serif text-[2rem] font-semibold leading-none text-[#2f3f57]">
                          {entry.guestName}
                        </h2>
                      </div>

                      <div className="grid gap-5">
                        <div className="overflow-hidden rounded-[22px] border border-[#dccfb9] bg-[#eadfce] shadow-[0_12px_24px_rgba(47,63,87,0.08)]">
                          <img
                            src={entry.imageSrc}
                            alt={entry.imageAlt}
                            className="h-[220px] w-full object-cover sepia-[0.18]"
                          />
                        </div>

                        <div className="rounded-[22px] border border-[#e2d5c2] bg-[rgba(255,255,255,0.72)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                          <p className="font-serif text-[1.85rem] italic leading-[1.2] text-[#3c526f]">
                            “{entry.message}”
                          </p>
                          <p className="mt-4 text-sm leading-7 text-[#66768a]">{entry.note}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-[#e3d8c7] pt-4 text-xs uppercase tracking-[0.28em] text-[#9c8a74]">
                        <span>Guest page</span>
                        <span>{String(index + 2).padStart(2, "0")}</span>
                      </div>
                    </div>
                  </div>
                </GuestBookSheet>
              ))}

              <GuestBookSheet className="bg-[linear-gradient(180deg,#efe7d8_0%,#f6f0e3_100%)]">
                <div className="relative flex h-full flex-col justify-between px-8 py-9">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9d7151]">
                      Next iteration
                    </p>
                    <h2 className="mt-4 max-w-[12ch] font-serif text-4xl font-semibold leading-tight text-[#2f3f57]">
                      Ready for real guest-book pages.
                    </h2>
                    <div className="mt-6 space-y-4 text-base leading-8 text-[#55667a]">
                      <p>Swap each placeholder image with a photographed page.</p>
                      <p>Add a typed transcript if you want readable text and search later.</p>
                      <p>Keep this route private while refining, then move it into the public navigation when the scans are ready.</p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[#d9ccb7] bg-white/75 p-5 shadow-[0_16px_28px_rgba(47,63,87,0.08)]">
                    <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#9c8a74]">
                      Suggested real content structure
                    </p>
                    <p className="mt-3 text-sm leading-7 text-[#5e6f84]">
                      Cover, inside note, 8 to 12 highlighted pages, then an archive or gallery view for the full collection.
                    </p>
                  </div>
                </div>
              </GuestBookSheet>
            </HTMLFlipBook>
          </div>
          </div>

          <div className="flex w-full max-w-[880px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="rounded-full border border-[#d7ccb8] bg-white/80 px-4 py-2 text-sm font-semibold text-[#516275] shadow-[0_10px_24px_rgba(47,63,87,0.08)]">
              Page {currentPage + 1} of {totalPages}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={isAtStart}
                className="inline-flex items-center gap-2 rounded-full border border-[#d8ccb8] bg-white px-5 py-3 text-sm font-semibold text-[#2f3f57] shadow-[0_12px_24px_rgba(47,63,87,0.08)] transition hover:border-[#c4a178] hover:text-[#9d7151] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ArrowLeft size={16} />
                Previous
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={isAtEnd}
                className="inline-flex items-center gap-2 rounded-full border border-[#2b4463] bg-[#2b4463] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(47,63,87,0.15)] transition hover:bg-[#213550] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Next
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GuestBookPoc;