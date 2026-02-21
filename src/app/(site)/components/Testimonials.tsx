'use client';

import { useEffect, useMemo, useState } from 'react';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';
import BlendedDemoFrame from '~/app/(site)/components/BlendedDemoFrame';

const TESTIMONIALS = [
  {
    highlight: 'I finally stopped worrying on my drive to work.',
    content:
      'Mom lives alone and the mornings were always hard for me. Now she has someone to talk to before I even finish my coffee. She told me yesterday she likes the voice better than mine \u2014 I\u2019ll take it.',
    author: 'Sarah M.',
    role: 'Daughter',
    stars: 5,
  },
  {
    highlight: 'Dad actually picks up the phone now.',
    content:
      'He\u2019d let my calls go to voicemail half the time. But for some reason he answers every Ultaura call. I think he likes that there\u2019s no pressure to perform or pretend he\u2019s fine.',
    author: 'James P.',
    role: 'Son',
    stars: 4.5,
  },
  {
    highlight: 'It\u2019s the thing I didn\u2019t know I was missing.',
    content:
      'I manage care for three residents and I can\u2019t be everywhere. The call summaries help me catch things I\u2019d normally miss \u2014 changes in mood, new complaints, stuff they wouldn\u2019t tell me directly.',
    author: 'Emily R.',
    role: 'Caregiver',
    stars: 5,
  },
  {
    highlight: 'Grandpa brought it up at dinner unprompted.',
    content:
      'He never talks about technology. Ever. But he told my whole family about \u2018his calls\u2019 at Sunday dinner. When an 84-year-old voluntarily mentions a tech product, you know it\u2019s working.',
    author: 'Nina K.',
    role: 'Granddaughter',
    stars: 5,
  },
  {
    highlight: 'Less guilt, more peace of mind.',
    content:
      'I live three states away and checking in every day just wasn\u2019t realistic. Knowing he has a consistent routine and I can glance at the dashboard when I want to \u2014 that\u2019s huge.',
    author: 'Marcus T.',
    role: 'Son',
    stars: 4.5,
  },
  {
    highlight: 'My aunt thought it was a real person for the first week.',
    content:
      'She figured it out and honestly didn\u2019t care. She says it\u2019s better because there\u2019s no awkward small talk about the weather. They just jump into whatever she wants to talk about.',
    author: 'Leo B.',
    role: 'Nephew',
    stars: 5,
  },
  {
    highlight: 'The reminders alone were worth it.',
    content:
      'Grandma was forgetting her afternoon medication constantly. We tried alarms, sticky notes, calling her ourselves. Ultaura just weaves it into the conversation naturally and she actually takes it now.',
    author: 'Omar A.',
    role: 'Grandson',
    stars: 5,
  },
  {
    highlight: 'I appreciate that they\u2019re upfront about it being AI.',
    content:
      'Mom was skeptical until I told her it\u2019s transparent about not being human. She respected that. Now she has a 15-minute call every morning and she\u2019s in a better mood for the rest of the day.',
    author: 'Luis C.',
    role: 'Son',
    stars: 4.5,
  },
  {
    highlight: 'She\u2019s laughing more. That\u2019s all I needed to know.',
    content:
      'I was nervous about the idea at first. But hearing Nana tell me about something funny from her call that morning \u2014 you can\u2019t put a price on that. It\u2019s given her something to look forward to.',
    author: 'Aisha N.',
    role: 'Granddaughter',
    stars: 5,
  },
];

export function Testimonials() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(3);
  const pageCount = Math.ceil(TESTIMONIALS.length / pageSize);

  const visibleTestimonials = useMemo(() => {
    const start = pageIndex * pageSize;
    return TESTIMONIALS.slice(start, start + pageSize);
  }, [pageIndex, pageSize]);

  const visiblePageIndices = useMemo(() => {
    if (pageSize > 1) {
      return Array.from({ length: pageCount }, (_, index) => index);
    }

    const start = Math.max(0, pageIndex - 1);
    const end = Math.min(pageCount - 1, start + 2);
    const windowStart = Math.max(0, end - 2);

    return Array.from(
      { length: end - windowStart + 1 },
      (_, idx) => windowStart + idx,
    );
  }, [pageCount, pageIndex, pageSize]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');

    const updatePageSize = () => {
      setPageSize(media.matches ? 3 : 1);
    };

    updatePageSize();
    media.addEventListener('change', updatePageSize);
    return () => media.removeEventListener('change', updatePageSize);
  }, []);

  useEffect(() => {
    setPageIndex((current) => Math.min(current, Math.max(pageCount - 1, 0)));
  }, [pageCount]);

  return (
    <section className="py-12">
      <Container>
        <div className="relative flex flex-col items-center space-y-6">
          <div className="w-full max-w-6xl space-y-4 text-right">
            <Heading type={2}>
              What <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">families</span> are saying
            </Heading>
            <SubHeading>
              Stories from families like yours.
            </SubHeading>
          </div>

          <div className="grid w-full max-w-6xl items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visibleTestimonials.map((testimonial, index) => (
              <BlendedDemoFrame key={index}>
                <div
                  className={
                    'group flex flex-col space-y-4 rounded-2xl border border-border/60' +
                    ' bg-sidebar p-8 shadow-xl'
                  }
                >
                <div className="space-y-4">
                  <div className="flex items-center gap-1 text-primary/80">
                    {Array.from({ length: 5 }).map((_, starIndex) => {
                      const stars = testimonial.stars;
                      if (starIndex < Math.floor(stars)) {
                        return (
                          <span key={`${testimonial.author}-star-${starIndex}`}>
                            ★
                          </span>
                        );
                      }
                      if (starIndex === Math.floor(stars) && stars % 1 !== 0) {
                        return (
                          <span
                            key={`${testimonial.author}-star-${starIndex}`}
                            className="relative inline-block"
                          >
                            <span className="text-primary/20">★</span>
                            <span className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                              <span className="text-primary/80">★</span>
                            </span>
                          </span>
                        );
                      }
                      return (
                        <span
                          key={`${testimonial.author}-star-${starIndex}`}
                          className="text-primary/20"
                        >
                          ★
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      &ldquo;{testimonial.highlight}&rdquo;
                    </span>
                    {testimonial.content ? ` ${testimonial.content}` : ''}
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-foreground">
                    {testimonial.author}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role}
                  </div>
                </div>
              </div>
              </BlendedDemoFrame>
            ))}
          </div>

          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 sm:flex sm:w-auto sm:flex-wrap sm:justify-center">
            <Button
              variant="outline"
              size="sm"
              round
              onClick={() =>
                setPageIndex((current) => Math.max(current - 1, 0))
              }
              disabled={pageIndex === 0}
              className="justify-self-start"
            >
              Previous
            </Button>

            <div className="flex items-center justify-center gap-2 justify-self-center px-1 py-1">
              {visiblePageIndices.map((index) => (
                <button
                  key={`testimonial-page-${index}`}
                  type="button"
                  aria-label={`Go to testimonials page ${index + 1}`}
                  onClick={() => setPageIndex(index)}
                  className="flex h-8 w-8 items-center justify-center sm:h-[44px] sm:w-[44px]"
                >
                  <span
                    className={
                      'h-2.5 w-2.5 rounded-full transition' +
                      (index === pageIndex
                        ? ' bg-primary'
                        : ' bg-border hover:bg-primary/40')
                    }
                  />
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              round
              onClick={() =>
                setPageIndex((current) =>
                  Math.min(current + 1, pageCount - 1),
                )
              }
              disabled={pageIndex === pageCount - 1}
              className="justify-self-end"
            >
              Next
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
