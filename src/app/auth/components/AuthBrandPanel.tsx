import Logo from '~/core/ui/Logo';
import { AuthBackgroundAnimation } from './AuthBackgroundAnimation';

function AuthBrandPanel() {
  return (
    <aside
      className={
        'relative isolate hidden min-h-screen overflow-hidden lg:flex' +
        ' flex-col items-center justify-center px-10' +
        ' bg-gradient-to-br from-primary via-primary/90 to-primary/70'
      }
    >
      <AuthBackgroundAnimation />

      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0)_36%),linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.03)_24%,rgba(255,255,255,0)_46%),linear-gradient(135deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0)_44%)]"
        aria-hidden="true"
      />

      <div
        className={
          'relative z-10 flex flex-col items-center gap-6 rounded-[2rem] px-10 py-12 text-center' +
          ' animate-in fade-in slide-in-from-bottom-4 duration-1000'
        }
      >
        <Logo
          className={'h-20 w-auto brightness-0 invert'}
          label={'Ultaura'}
          showWordmark
          wordmarkClassName={'text-white text-3xl'}
        />

        <p className={'max-w-sm text-balance text-lg font-medium tracking-[0.01em] text-white/90'}>
          Companionship, One Call at a Time
        </p>
      </div>
    </aside>
  );
}

export default AuthBrandPanel;
