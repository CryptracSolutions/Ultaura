'use client';

import Image from 'next/image';

const badges = [
  { src: '/badges/1-hipaa-compliant.png', alt: 'HIPAA Compliant', height: 120 },
  { src: '/badges/2-soc2-compliant.png', alt: 'SOC 2 Compliant', height: 120 },
  { src: '/badges/3-aarp-logo.png', alt: 'AARP', height: 80 },
  { src: '/badges/4-ncoa-logo.png', alt: 'National Council on Aging', height: 80 },
  { src: '/badges/5-age-friendly-badge.png', alt: 'Age Friendly', height: 120 },
  { src: '/badges/6-certified-provider.png', alt: 'Certified Provider', height: 120 },
];

export function BadgeStrip() {
  return (
    <section className="py-12 overflow-hidden">
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        .marquee-track {
          animation: marquee 40s linear infinite;
        }
      `}</style>

      <div className="text-center mb-8">
        <p className="text-sm text-muted-foreground tracking-wide uppercase">
          Trusted by families and care providers nationwide
        </p>
      </div>

      <div className="relative flex overflow-hidden">
        {/* First set of badges */}
        <div className="marquee-track flex shrink-0 gap-32 items-center pr-32">
          {badges.map((badge, index) => (
            <Image
              key={index}
              src={badge.src}
              alt={badge.alt}
              width={0}
              height={badge.height}
              sizes="100vw"
              quality={100}
              className="w-auto hover:scale-105 transition-transform duration-300"
              style={{ height: badge.height }}
            />
          ))}
        </div>
        {/* Duplicate set for seamless loop */}
        <div className="marquee-track flex shrink-0 gap-32 items-center pr-32">
          {badges.map((badge, index) => (
            <Image
              key={`dup-${index}`}
              src={badge.src}
              alt={badge.alt}
              width={0}
              height={badge.height}
              sizes="100vw"
              quality={100}
              className="w-auto hover:scale-105 transition-transform duration-300"
              style={{ height: badge.height }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
