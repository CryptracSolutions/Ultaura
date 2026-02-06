import cn from 'clsx';

type Props = React.PropsWithChildren<{
  className?: string;
  contentClassName?: string;
}>;

const edgeFade =
  'radial-gradient(124% 124% at 50% 44%, #000 62%, rgba(0,0,0,0.92) 72%, transparent 100%)';

const edgeMaskStyle: React.CSSProperties = {
  WebkitMaskImage: edgeFade,
  maskImage: edgeFade,
};

function BlogImageFrame({ className, contentClassName, children }: Props) {
  return (
    <div className={cn('relative isolate w-full', className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-3 rounded-[1.5rem] bg-[radial-gradient(ellipse_at_center,rgba(10,186,181,0.16)_0%,rgba(10,186,181,0.08)_38%,rgba(10,186,181,0)_72%)] blur-xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-2 rounded-[1.2rem] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.3)_0%,rgba(255,255,255,0)_65%)]"
      />

      <div className="relative h-full rounded-[1.2rem] bg-gradient-to-br from-background/75 via-background/35 to-transparent p-2 ring-1 ring-primary/15 shadow-[0_16px_36px_-26px_rgba(10,186,181,0.55)]">
        <div
          className={cn(
            'relative h-full overflow-hidden rounded-[0.95rem]',
            contentClassName
          )}
        >
          {children}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[8px] rounded-[0.95rem]"
        style={edgeMaskStyle}
      >
        <div className="h-full w-full rounded-[0.95rem] shadow-[inset_0_0_0_999px_rgba(0,0,0,0.08)]" />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-1.5 rounded-[1.35rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-22px_26px_rgba(15,23,42,0.12)]"
      />
    </div>
  );
}

export default BlogImageFrame;
