import { MainCallToActionButton } from '~/app/(site)/components/MainCallToActionButton';

export function BlogPostCTA() {
  return (
    <section className="relative overflow-hidden py-20 mt-16">
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-primary/20 blur-[100px]"
      />

      <div className="relative mx-auto max-w-2xl px-4 text-center">
        <h2 className="text-2xl sm:text-3xl font-heading font-semibold tracking-tight text-foreground">
          Give your loved one a daily companion
        </h2>

        <p className="mt-3 text-muted-foreground text-lg">
          Ultaura calls your parent or grandparent every day for a friendly
          check-in — so you always know they&apos;re okay.
        </p>

        <div className="mt-8 flex justify-center">
          <MainCallToActionButton />
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Free for 3 days · No credit card · Works on any phone
        </p>
      </div>
    </section>
  );
}
