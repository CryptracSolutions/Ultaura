'use client';

import { useEffect, useRef, useState } from 'react';

import { useReducedMotion } from 'framer-motion';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import Image from 'next/image';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';

const TESTIMONIALS = [
  {
    highlight: 'My aunt has opinions about everything and finally someone has time for all of them.',
    content:
      'She\u2019s the kind of person who wants to tell you every detail about the grocery store trip. I love her but I can\u2019t do that every day. Ultaura apparently can. She told me she had a 30 min conversation about whether romaine or iceberg is better.',
    author: 'Leo B.',
    role: 'Nephew',
    image: '/images/testimonials/leo-b.webp',
    initials: 'LB',
    location: 'Boston, MA',
    stars: 4.5,
  },
  {
    highlight: 'Mom started telling me about her day again.',
    content:
      'After Dad passed she just kind of shut down. Short answers, no stories, no complaining about the neighbors like she used to. I set her up with Ultaura mostly as an experiment. Two weeks later she called me to complain about the neighbor\u2019s new fence. I almost threw a party.',
    author: 'Luis C.',
    role: 'Son',
    image: '/images/testimonials/luis-c.webp',
    initials: 'LC',
    location: 'Phoenix, AZ',
    stars: 4.5,
  },
  {
    highlight: 'My abuela takes her meds now. That\u2019s it. That\u2019s the review.',
    content:
      'I\u2019m serious. We\u2019ve been fighting this battle for two years. She ignores my texts, ignores the alarms, ignores the little pill box I bought her. Somehow when Ultaura mentions it during their morning call she just does it. I stopped questioning it.',
    author: 'Nina K.',
    role: 'Granddaughter',
    image: '/images/testimonials/sarah-m.webp',
    initials: 'NK',
    location: 'Chicago, IL',
    stars: 5,
  },
  {
    highlight: 'He talks to Ultaura more than he talks to me and I\u2019m weirdly okay with it.',
    content:
      'Getting more than 3 words out of my grandpa on FaceTime is impossible. But my dad said he heard him laughing during his Ultaura call last Tuesday. Actual laughing. I don\u2019t even remember the last time I heard that.',
    author: 'Omar A.',
    role: 'Grandson',
    image: '/images/testimonials/omar-a.webp',
    initials: 'OA',
    location: 'Miami, FL',
    stars: 4,
  },
  {
    highlight: 'I went from calling him out of obligation to calling him because I missed him.',
    content:
      'Every missed call felt like I was failing. Ultaura didn\u2019t replace me but it filled the gaps I couldn\u2019t. Dad has someone to talk to on the days I can\u2019t and I stopped carrying that weight around.',
    author: 'Marcus T.',
    role: 'Son',
    image: '/images/testimonials/marcus-t.webp',
    initials: 'MT',
    location: 'Portland, OR',
    stars: 4.5,
  },
  {
    highlight: 'I don\u2019t check her location 5x a day anymore.',
    content:
      'That sounds dramatic but that was my life. Mom fell last year and I basically became her full-time worrier from 800 miles away. Having something that actually talks to her every morning and flags if something seems off, I sleep better. She sleeps better. We both needed this.',
    author: 'Sarah M.',
    role: 'Daughter',
    image: '/images/testimonials/nina-k.webp',
    initials: 'SM',
    location: 'Austin, TX',
    stars: 5,
  },
  {
    highlight: 'I manage three clients and I can\u2019t give any of them enough time.',
    content:
      'That\u2019s the reality of home care. 45-minute visits, then you\u2019re out the door. Two of my clients get Ultaura calls now and the difference in their mood when I show up is real. They\u2019ve already talked to someone that day. I\u2019m not their only human contact anymore and honestly that takes pressure off both of us.',
    author: 'Emily R.',
    role: 'Caregiver',
    image: '/images/testimonials/emily-r.webp',
    initials: 'ER',
    location: 'Denver, CO',
    stars: 4,
  },
  {
    highlight: 'I used to dread calling him because neither of us knew what to say.',
    content:
      'After Mom passed it was just awkward silence on the phone. He didn\u2019t want to burden me and I didn\u2019t know how to help. Now he\u2019s got this daily call and when I do call him on weekends he actually has things to talk about.',
    author: 'James P.',
    role: 'Son',
    image: '/images/testimonials/james-p.webp',
    initials: 'JP',
    location: 'Seattle, WA',
    stars: 4.5,
  },
  {
    highlight: 'Nana can\u2019t wait for mornings now.',
    content:
      'She lives alone and most days are the same. Same chair, same TV, same routine. But now she has this thing she looks forward to and she actually gets dressed before the call. My mom noticed first.',
    author: 'Aisha N.',
    role: 'Granddaughter',
    image: '/images/testimonials/aisha-n.webp',
    initials: 'AN',
    location: 'Atlanta, GA',
    stars: 5,
  },
];

function StarRating({ stars }: { stars: number }) {
  const fullStars = Math.floor(stars);
  const hasHalf = stars % 1 !== 0;

  return (
    <div className="flex items-center gap-1 text-xl text-amber-400">
      {Array.from({ length: 5 }).map((_, i) => {
        if (i < fullStars) {
          return <span key={i}>★</span>;
        }
        if (i === fullStars && hasHalf) {
          return (
            <span key={i} className="relative inline-block">
              <span className="text-amber-400/20">★</span>
              <span className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                <span className="text-amber-400">★</span>
              </span>
            </span>
          );
        }
        return (
          <span key={i} className="text-amber-400/20">★</span>
        );
      })}
    </div>
  );
}

export function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-advance every 5s
  useEffect(() => {
    if (isPaused || prefersReducedMotion) return;
    const id = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev >= TESTIMONIALS.length - 1 ? 0 : prev + 1;
        if (scrollRef.current) {
          const card = scrollRef.current.children[next] as HTMLElement;
          if (card) {
            scrollRef.current.scrollTo({
              left: card.offsetLeft - scrollRef.current.offsetLeft,
              behavior: 'smooth',
            });
          }
        }
        return next;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [isPaused, prefersReducedMotion]);

  // Track currentIndex from scroll position
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const children = Array.from(container.children) as HTMLElement[];
      let closestIndex = 0;
      let closestDistance = Infinity;
      children.forEach((child, i) => {
        const distance = Math.abs(child.offsetLeft - container.offsetLeft - scrollLeft);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      });
      setCurrentIndex(closestIndex);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="bg-surface-subtle py-20 lg:py-24">
      <Container>
        <div className="relative flex flex-col items-center space-y-8">
          {/* Header */}
          <div className="w-full max-w-6xl space-y-4 text-right">
            <Heading type={2}>
              What{' '}
              <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                families
              </span>{' '}
              are saying
            </Heading>
            <SubHeading>Our favorite stories from families just like yours.</SubHeading>
          </div>

          {/* Carousel */}
          <div className="w-full overflow-hidden px-8 md:px-12">
            <div
              ref={scrollRef}
              className="flex gap-6 overflow-x-auto scrollbar-hide pb-4"
              style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
            >
              {TESTIMONIALS.map((testimonial) => (
                <div
                  key={testimonial.author}
                  className="w-full sm:w-[320px] md:w-[calc((100%-1.5rem)/2)] md:min-w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)] lg:min-w-[calc((100%-3rem)/3)] flex-shrink-0 flex flex-col rounded-2xl border border-border/60 border-l-2 border-l-primary/30 bg-sidebar p-8 shadow-xl"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  {/* Stars */}
                  <StarRating stars={testimonial.stars} />

                  {/* Quote */}
                  <p className="flex-1 text-muted-foreground mt-4">
                    <span className="font-semibold text-foreground">
                      &ldquo;{testimonial.highlight}&rdquo;
                    </span>
                    {testimonial.content ? ` ${testimonial.content}` : ''}
                  </p>

                  {/* Author - pinned to bottom, stacked vertically */}
                  <div className="flex items-center gap-3 mt-auto pt-4">
                    {testimonial.image ? (
                      <Image
                        src={testimonial.image}
                        alt={testimonial.author}
                        width={40}
                        height={40}
                        className="h-[62px] w-[62px] rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-[62px] w-[62px] rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                        {testimonial.initials}
                      </div>
                    )}
                    <div className="flex flex-col items-end ml-auto text-right">
                      <span className="font-semibold text-foreground">{testimonial.author}</span>
                      <span className="text-sm text-muted-foreground">
                        {testimonial.role} · {testimonial.location}
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <CheckCircleIcon className="h-3.5 w-3.5 text-green-500" />
                        <span className="text-xs text-green-600 dark:text-green-400">Verified</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-2 py-1">
            {TESTIMONIALS.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Go to testimonial ${index + 1}`}
                onClick={() => {
                  setCurrentIndex(index);
                  if (scrollRef.current) {
                    const card = scrollRef.current.children[index] as HTMLElement;
                    if (card) {
                      scrollRef.current.scrollTo({
                        left: card.offsetLeft - scrollRef.current.offsetLeft,
                        behavior: 'smooth',
                      });
                    }
                  }
                }}
                className="flex h-8 w-8 items-center justify-center sm:h-[44px] sm:w-[44px]"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    index === currentIndex ? 'bg-primary' : 'bg-border hover:bg-primary/40'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
