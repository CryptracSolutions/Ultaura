import Logo from '~/core/ui/Logo';

function AuthBrandPanel() {
  return (
    <aside
      className={
        'relative hidden min-h-screen overflow-hidden lg:flex' +
        ' flex-col items-center justify-center px-10' +
        ' bg-gradient-to-br from-primary via-primary/90 to-primary/70'
      }
    >
      <div className={'flex flex-col items-center gap-6'}>
        <Logo
          className={'h-20 w-auto brightness-0 invert'}
          label={'Ultaura'}
          showWordmark
          wordmarkClassName={'text-white text-3xl'}
        />

        <p className={'text-lg font-medium text-white/90'}>
          Companionship, One Call at a Time
        </p>
      </div>
    </aside>
  );
}

export default AuthBrandPanel;
