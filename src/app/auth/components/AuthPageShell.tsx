import Logo from '~/core/ui/Logo';
import I18nProvider from '~/i18n/I18nProvider';

import AuthBrandPanel from '~/app/auth/components/AuthBrandPanel';

function AuthPageShell({
  children,
  language,
}: React.PropsWithChildren<{
  language?: string;
}>) {
  return (
    <div className={'min-h-screen w-full lg:grid lg:grid-cols-2'}>
      <AuthBrandPanel />

      <div
        className={
          'flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10' +
          ' lg:min-h-0 lg:px-10' +
          ' animate-in fade-in slide-in-from-top-8 duration-1000'
        }
      >
        <div className={'mb-8 flex w-full max-w-md items-center justify-center lg:hidden'}>
          <Logo className={'h-10 w-auto'} label={'Ultaura'} />
        </div>

        <div
          className={
            'flex w-full max-w-md flex-col items-center space-y-4 rounded-xl border border-border bg-card text-card-foreground px-4 py-6 shadow-lg' +
            ' lg:px-8'
          }
        >
          <I18nProvider lang={language}>{children}</I18nProvider>
        </div>
      </div>
    </div>
  );
}

export default AuthPageShell;
