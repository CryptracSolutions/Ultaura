import Logo from '~/core/ui/Logo';

async function OnboardingLayout({ children }: React.PropsWithChildren) {
  return (
    <div className={'flex min-h-screen w-full flex-col bg-background py-8'}>
      <div className={'mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4'}>
        <div
          className={
            'flex w-full flex-col space-y-16 lg:p-16' +
            ' lg:rounded-md zoom-in-95 animate-in fade-in ease-out' +
            ' duration-1000 slide-in-from-bottom-24'
          }
        >
          <div className={'flex w-full justify-center'}>
            <Logo
              className={'h-10'}
              showWordmark
              wordmarkClassName={'text-2xl font-semibold leading-none'}
            />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export default OnboardingLayout;
