import Logo from '~/core/ui/Logo';

function AuthBrandPanel() {
  return (
    <aside
      className={
        'relative hidden min-h-screen overflow-hidden lg:flex' +
        ' items-center justify-center px-10' +
        ' bg-gradient-to-br from-primary via-primary/90 to-primary/70'
      }
    >
      <div
        aria-hidden
        className={
          'pointer-events-none absolute inset-0 opacity-20' +
          ' [background-image:radial-gradient(circle_at_top,rgba(255,255,255,0.45),transparent_55%)]'
        }
      />

      <div className={'relative mx-auto flex max-w-md flex-col items-center text-center text-white'}>
        <Logo
          className={'h-16 w-auto brightness-0 invert'}
          label={'Ultaura'}
        />

        <p className={'mt-6 text-2xl font-semibold tracking-tight'}>
          AI Voice Companion for Seniors
        </p>

        <ul className={'mt-6 space-y-3 text-sm/6 text-white/90'}>
          <li className={'flex items-start gap-3'}>
            <span className={'mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/90'} />
            <span>Simple, natural voice conversations</span>
          </li>

          <li className={'flex items-start gap-3'}>
            <span className={'mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/90'} />
            <span>Designed for safety, comfort, and independence</span>
          </li>

          <li className={'flex items-start gap-3'}>
            <span className={'mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/90'} />
            <span>Easy setup for families and caregivers</span>
          </li>
        </ul>
      </div>
    </aside>
  );
}

export default AuthBrandPanel;


