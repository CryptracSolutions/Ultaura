'use client';

import { useEffect, useRef, useState } from 'react';

import { useReducedMotion } from 'framer-motion';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';

const TESTIMONIALS = [
  {
    highlight: 'I finally stopped worrying on my drive to work.',
    content:
      'Mom lives alone and the mornings were always hard for me. Now she has someone to talk to before I even finish my coffee. She told me yesterday she likes the voice better than mine \u2014 I\u2019ll take it.',
    author: 'Sarah M.',
    role: 'Daughter',
    initials: 'SM',
    location: 'Austin, TX',
    stars: 5,
  },
  {
    highlight: 'Dad actually picks up the phone now.',
    content:
      'He\u2019d let my calls go to voicemail half the time. But for some reason he answers every Ultaura call. I think he likes that there\u2019s no pressure to perform or pretend he\u2019s fine.',
    author: 'James P.',
    role: 'Son',
    initials: 'JP',
    location: 'Seattle, WA',
    stars: 4.5,
  },
  {
    highlight: 'It\u2019s the thing I didn\u2019t know I was missing.',
    content:
      'I manage care for three residents and I can\u2019t be everywhere. The call summaries help me catch things I\u2019d normally miss \u2014 changes in mood, new complaints, stuff they wouldn\u2019t tell me directly.',
    author: 'Emily R.',
    role: 'Caregiver',
    initials: 'ER',
    location: 'Denver, CO',
    stars: 5,
  },
  {
    highlight: 'Grandpa brought it up at dinner unprompted.',
    content:
      'He never talks about technology. Ever. But he told my whole family about \u2018his calls\u2019 at Sunday dinner. When an 84-year-old voluntarily mentions a tech product, you know it\u2019s working.',
    author: 'Nina K.',
    role: 'Granddaughter',
    initials: 'NK',
    location: 'Chicago, IL',
    stars: 5,
  },
  {
    highlight: 'Less guilt, more peace of mind.',
    content:
      'I live three states away and checking in every day just wasn\u2019t realistic. Knowing he has a consistent routine and I can glance at the dashboard when I want to \u2014 that\u2019s huge.',
    author: 'Marcus T.',
    role: 'Son',
    initials: 'MT',
    location: 'Portland, OR',
    stars: 4.5,
  },
  {
    highlight: 'My aunt thought it was a real person for the first week.',
    content:
      'She figured it out and honestly didn\u2019t care. She says it\u2019s better because there\u2019s no awkward small talk about the weather. They just jump into whatever she wants to talk about.',
    author: 'Leo B.',
    role: 'Nephew',
    initials: 'LB',
    location: 'Boston, MA',
    stars: 5,
  },
  {
    highlight: 'The reminders alone were worth it.',
    content:
      'Grandma was forgetting her afternoon medication constantly. We tried alarms, sticky notes, calling her ourselves. Ultaura just weaves it into the conversation naturally and she actually takes it now.',
    author: 'Omar A.',
    role: 'Grandson',
    initials: 'OA',
    location: 'Miami, FL',
    stars: 5,
  },
  {
    highlight: 'I appreciate that they\u2019re upfront about it being AI.',
    content:
      'Mom was skeptical until I told her it\u2019s transparent about not being human. She respected that. Now she has a 15-minute call every morning and she\u2019s in a better mood for the rest of the day.',
    author: 'Luis C.',
    role: 'Son',
    initials: 'LC',
    location: 'Phoenix, AZ',
    stars: 4.5,
  },
  {
    highlight: 'She\u2019s laughing more. That\u2019s all I needed to know.',
    content:
      'I was nervous about the idea at first. But hearing Nana tell me about something funny from her call that morning \u2014 you can\u2019t put a price on that. It\u2019s given her something to look forward to.',
    author: 'Aisha N.',
    role: 'Granddaughter',
    initials: 'AN',
    location: 'Atlanta, GA',
    stars: 5,
  },
];

function StarRating({ stars }: { stars: number }) {
  const fullStars = Math.floor(stars);
  const hasHalf = stars % 1 !== 0;

  return (
    <div className="flex items-center gap-1 text-amber-400">
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
                  <div className="flex items-start gap-3 mt-auto pt-4">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                      {testimonial.initials}
                    </div>
                    <div className="flex flex-col">
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
