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
      <div className="overflow-x-hidden">
        <SiteHeaderSessionProvider data={session} />

        {props.children}

        <Footer />
      </div>

      <ChatBot />
    </I18nProvider>
  );
}

export default SiteLayout;
