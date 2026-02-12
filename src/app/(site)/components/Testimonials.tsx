'use client';

import { useEffect, useMemo, useState } from 'react';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';
import BlendedDemoFrame from '~/app/(site)/components/BlendedDemoFrame';

const TESTIMONIALS = [
  {
    highlight: 'Ultaura has been a lifesaver.',
    content:
      'My mom looks forward to her daily calls now. She tells me about the conversations afterward \u2014 and I feel so much better knowing she\u2019s connected, even on the days I can\u2019t call.',
    author: 'Sarah M.',
    role: 'Daughter',
    date: 'Jan 2026',
    stars: 5,
  },
  {
    highlight:
      'I was skeptical at first, but the conversations are surprisingly natural.',
    content: 'It helps my dad with the loneliness between visits.',
    author: 'James P.',
    role: 'Son',
    date: 'Dec 2025',
    stars: 4.5,
  },
  {
    highlight: 'The dashboard gives me peace of mind without being intrusive.',
    content:
      'My aunt is in assisted living, and Ultaura helped her open up about her day. I can see call duration and timing, then check in when I need to \u2014 it feels like I\u2019m there without being overwhelming.',
    author: 'Emily R.',
    role: 'Caregiver',
    date: 'Nov 2025',
    stars: 5,
  },
  {
    highlight: 'My grandfather answers every call.',
    content:
      'He actually looks forward to them. He\u2019ll tell me afterward what they talked about, and it gives us something new to connect over.',
    author: 'Nina K.',
    role: 'Granddaughter',
    date: 'Oct 2025',
    stars: 5,
  },
  {
    highlight: 'Ultaura helped my dad stay more social.',
    content:
      'The calls give him a little routine, and I can see he\u2019s doing well without hovering or asking him to repeat himself.',
    author: 'Marcus T.',
    role: 'Son',
    date: 'Sep 2025',
    stars: 4.5,
  },
  {
    highlight: 'The setup was easy, and my aunt never had to install anything.',
    content:
      'She just picks up the phone and chats. It keeps her independent and in a good mood.',
    author: 'Leo B.',
    role: 'Nephew',
    date: 'Aug 2025',
    stars: 5,
  },
  {
    highlight: 'My grandmother lights up when she talks about her calls.',
    content:
      'That means everything to our family \u2014 knowing she has that connection gives us peace between visits.',
    author: 'Omar A.',
    role: 'Grandson',
    date: 'Jul 2025',
    stars: 5,
  },
  {
    highlight: 'Ultaura feels respectful.',
    content:
      'My mom likes that it\u2019s upfront about being AI, and the tone is always gentle. That matters to us.',
    author: 'Luis C.',
    role: 'Son',
    date: 'Jun 2025',
    stars: 4.5,
  },
  {
    highlight: 'My grandmother laughs more after the calls.',
    content:
      'She tells me about the questions she was asked and the memories it brought back. Those conversations have become part of her week.',
    author: 'Aisha N.',
    role: 'Granddaughter',
    date: 'May 2025',
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

    if (media.addEventListener) {
      media.addEventListener('change', updatePageSize);
      return () => media.removeEventListener('change', updatePageSize);
    }

    media.addListener(updatePageSize);
    return () => media.removeListener(updatePageSize);
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
              Real stories from families using Ultaura.
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
                    {testimonial.role} · {testimonial.date}
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
