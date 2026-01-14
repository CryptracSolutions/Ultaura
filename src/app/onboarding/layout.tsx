import Logo from '~/core/ui/Logo';

async function OnboardingLayout({ children }: React.PropsWithChildren) {
  return (
    <div className={'flex flex-1 flex-col dark:bg-background py-8 h-screen'}>
      <div
        className={
          'flex w-11/12 flex-1 flex-col items-center justify-center' +
          ' lg:w-10/12 mx-auto xl:max-w-5xl'
        }
      >
        <div
          className={
            'flex flex-col space-y-16 w-full lg:p-16' +
            ' lg:rounded-md zoom-in-95 animate-in fade-in ease-out' +
            ' duration-1000 slide-in-from-bottom-24'
          }
        >
          <div className={'flex justify-center -ml-7'}>
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
