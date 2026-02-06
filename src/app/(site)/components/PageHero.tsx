import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';

interface PageHeroProps {
  badge: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHero({ badge, title, subtitle, children }: PageHeroProps) {
  return (
    <section className="bg-primary/10 py-16 lg:py-24">
      <Container>
        <div className="flex flex-col items-center text-center space-y-4 sm:space-y-5">
          {/* Badge with decorative lines */}
          <div className="flex items-center gap-3">
            <span className="h-px w-8 sm:w-12 bg-primary/60" />
            <span className="text-xs sm:text-sm tracking-[0.2em] text-primary font-medium">
              {badge}
            </span>
            <span className="h-px w-8 sm:w-12 bg-primary/60" />
          </div>

          {/* Heading */}
          <Heading
            type={1}
            className="text-4xl sm:text-5xl lg:text-6xl"
          >
            {title}
          </Heading>

          {/* SubHeading */}
          {subtitle && (
            <SubHeading as="h2">{subtitle}</SubHeading>
          )}

          {/* Extra content slot */}
          {children}
        </div>
      </Container>
    </section>
  );
}

export function GradientText({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
      {children}
    </span>
  );
}
