function BlendedDemoFrame(props: React.PropsWithChildren) {
  const edgeFade =
    'radial-gradient(128% 128% at 50% 46%, #000 62%, rgba(0,0,0,0.92) 72%, transparent 100%)';
  const edgeMaskStyle: React.CSSProperties = {
    WebkitMaskImage: edgeFade,
    maskImage: edgeFade,
  };

  return (
    <div className="relative isolate w-full">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-7 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgba(10,186,181,0.22)_0%,rgba(10,186,181,0.08)_38%,rgba(10,186,181,0)_72%)] blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-3 rounded-[1.7rem] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_62%)]"
      />
      <div className="relative rounded-[1.7rem] bg-gradient-to-br from-background/70 via-background/35 to-transparent p-2.5 ring-1 ring-primary/15 shadow-[0_20px_45px_-30px_rgba(10,186,181,0.55)]">
        <div className="rounded-[1.35rem]">{props.children}</div>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[10px] rounded-[1.35rem]"
        style={edgeMaskStyle}
      >
        <div className="h-full w-full rounded-[1.35rem] shadow-[inset_0_0_0_999px_rgba(0,0,0,0.08)]" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-2 rounded-[1.8rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-30px_35px_rgba(15,23,42,0.12)]"
      />
    </div>
  );
}

export default BlendedDemoFrame;
