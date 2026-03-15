import HomeSlideshowHero from "../components/HomeSlideshowHero";

const Home = () => {
  const storyParagraphs = [
    "Palazzo Pinto Bed and Breakfast is a prestigious residence where the sounds, scents and emotions of the past echo. Built in 1901, the house has been created thanks to the pioneering adventures and efforts of his original owner Giuseppe, a brilliant wine exporter that lived between Brindisi and El Cairo, where his commercial activities were based.",
    "Situated in the heart of Brindisi, Palazzo Pinto is nowadays a charmingly renovated boutique mansion that Giuseppe's grand-daughter converted in a modern and welcoming guest house provided with all kinds of comforts and facilities.",
    "Moreover, Palazzo Pinto B&B is strategically located in a quiet position just 5 walking minutes from Central Station and few steps away from the most charming treasures and landmarks of the city.",
    "Brindisi is the perfect spot to start exploring the secular Mediterranean culture and the beauty of Puglian territory.",
  ];

  return (
    <>
      <HomeSlideshowHero />
      <section className="bg-[#f7f7f7] border-t border-[#ececec] border-b border-[#ececec]">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            <div className="lg:col-span-8">
              <p className="uppercase tracking-[0.28em] text-[#ea836c] text-xs sm:text-sm font-semibold mb-10">
                WHERE THE SOUNDS, SCENTS AND EMOTIONS OF THE PAST ECHO
              </p>

              <div className="space-y-4 text-[#2f3f57] text-base leading-8">
                {storyParagraphs.map((paragraph, index) => (
                  <p key={`story-${index}`}>{paragraph}</p>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 lg:pt-20">
              <img
                src="/home/home-story.png"
                alt="Palazzo Pinto historic story"
                className="w-full max-w-[360px] mx-auto lg:mx-0 object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.18)]"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Home;
