import dynamic from 'next/dynamic';

import Footer from '~/app/(site)/components/Footer';
import I18nProvider from '~/i18n/I18nProvider';
import SiteHeaderSessionProvider from '~/app/(site)/components/SiteHeaderSessionProvider';
import loadUserData from '~/lib/server/loaders/load-user-data';

const ChatBot = dynamic(
  () => import('~/plugins/chatbot/components/ChatBot'),
  { ssr: false }
);

async function SiteLayout(props: React.PropsWithChildren) {
  const { session, language } = await loadUserData();

  return (
    <I18nProvider lang={language}>
      <SiteHeaderSessionProvider data={session} />

      <div className="overflow-x-hidden">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <main id="main-content">
          {props.children}
        </main>

        <Footer />
      </div>

      <ChatBot />
    </I18nProvider>
  );
}

export default SiteLayout;
