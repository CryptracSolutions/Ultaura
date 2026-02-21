import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';

const STATS = [
  {
    stat: '78%',
    label: 'of family caregivers report feelings of burnout',
    source: 'A Place for Mom, 2025',
  },
  {
    stat: '22 hrs/week',
    label: 'average time spent caregiving by family members',
    source: 'A Place for Mom, 2025',
  },
  {
    stat: '$36/hr',
    label: 'median cost of in-home companion care',
    source: 'SeniorLiving.org, 2026',
  },
  {
    stat: '60%',
    label: 'higher ER visits for socially isolated seniors',
    source: 'Innovation in Aging, 2024',
  },
];

export function ImpactStats() {
  return (
    <section className="py-12 bg-surface-subtle">
      <Container>
        <div className="mb-8 text-center">
          <Heading type={2}>
            The numbers behind <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">the need</span>
          </Heading>
        </div>

        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {STATS.map((item) => (
            <div
              key={item.stat}
              className="flex flex-col items-center text-center space-y-1.5 rounded-2xl border border-border/60 bg-sidebar p-6 shadow-sm"
            >
              <span className="text-3xl font-bold text-primary sm:text-4xl">
                {item.stat}
              </span>
              <span className="text-sm font-medium text-foreground leading-snug">
                {item.label}
              </span>
              <span className="text-[11px] text-muted-foreground/70">
                {item.source}
              </span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
