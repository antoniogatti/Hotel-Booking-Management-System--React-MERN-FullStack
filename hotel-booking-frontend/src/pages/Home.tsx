import HomeSlideshowHero from "../components/HomeSlideshowHero";

const Home = () => {
  const storyParagraphs = [
    "Palazzo Pinto is a prestigious residence where the sounds, scents and emotions of the past echo. Built in 1901, the house has been created thanks to the pioneering adventures and efforts of his original owner Giuseppe, a brilliant wine exporter that lived between Brindisi and El Cairo, where his commercial activities were based.",
    "Situated in the heart of Brindisi, Palazzo Pinto is nowadays a charmingly renovated boutique mansion that Giuseppe's grand-daughter converted in a modern and welcoming guest house provided with all kinds of comforts and facilities.",
    "Moreover, Palazzo Pinto is strategically located in a quiet position just 5 walking minutes from Central Station and few steps away from the most charming treasures and landmarks of the city.",
    "Brindisi is the perfect spot to start exploring the secular Mediterranean culture and the beauty of Puglian territory.",
  ];

  const staffMembers = [
    {
      name: "Maurizio",
      description:
        "Maurizio welcomes our guests with care, helping each arrival feel relaxed, smooth and genuinely personal.",
      imageSrc: "/staff/maurizio.png",
    },
    {
      name: "Anna",
      description:
        "Anna curates the rooms, their details and decoration, and takes care of the rooftop breakfast experience.",
      imageSrc: "/staff/anna.png",
    },
    {
      name: "Lucia",
      description:
        "Lucia looks after bookings, marketing and sales, making sure every stay begins with clarity and attention.",
      imageSrc: "/staff/lucia.png",
    },
    {
      name: "Antonio",
      description:
        "Antonio manages administration and the technical side of the business, keeping everything running reliably behind the scenes.",
      imageSrc: "/staff/antonio.png",
    },
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

      <section className="bg-[#f7f7f7] border-b border-[#ececec]">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
          <div className="max-w-3xl">
            <p className="uppercase tracking-[0.28em] text-[#ea836c] text-xs sm:text-sm font-semibold mb-4">
              OUR STAFF
            </p>
            <h2 className="text-[#2f3f57] font-serif text-3xl sm:text-4xl font-semibold leading-tight mb-4">
              The people who welcome you to Palazzo Pinto
            </h2>
            <p className="text-[#536276] text-base leading-8">
              A small team caring for every detail of your stay, from the first welcome to the day-to-day running of the house.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-12 justify-items-center md:justify-items-stretch">
            {staffMembers.map((member) => (
              <article
                key={member.name}
                className="w-full max-w-[540px] rounded-[22px] border border-[#e8e3d8] bg-white shadow-[0_16px_32px_rgba(47,63,87,0.08)] p-5 sm:p-6"
              >
                <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
                  <img
                    src={member.imageSrc}
                    alt={`${member.name} at Palazzo Pinto`}
                    className="w-[180px] h-[220px] shrink-0 rounded-[16px] object-cover shadow-[0_12px_24px_rgba(0,0,0,0.12)]"
                  />

                  <div className="max-w-[30ch] sm:max-w-none">
                    <h3 className="text-[#2f3f57] font-serif text-3xl font-semibold leading-none mb-3">
                      {member.name}
                    </h3>
                    <p className="text-[#536276] text-base leading-7">{member.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default Home;
