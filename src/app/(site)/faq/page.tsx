import Container from '~/core/ui/Container';
import SubHeading from '~/core/ui/SubHeading';
import Heading from '~/core/ui/Heading';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/core/ui/Accordion';
import { withI18n } from '~/i18n/with-i18n';

export const metadata = {
  title: 'FAQ - Ultaura',
  description:
    'Frequently asked questions about Ultaura, the AI voice companion for seniors.',
};

const CATEGORIES = [
  {
    title: 'General',
    items: [
      {
        question: `What is Ultaura?`,
        answer: `Ultaura is an AI voice companion that makes friendly phone calls to your elderly loved ones. It provides conversation, companionship, and connection — no smartphone or app required. Just a regular phone.`,
      },
      {
        question: `What is a "line"?`,
        answer: `A line is a verified phone number for one person. Each line represents one loved one who will receive calls from Ultaura. Different plans include different numbers of lines.`,
      },
      {
        question: `Is Ultaura a real person?`,
        answer: `No, Ultaura is an AI voice companion. We always clearly disclose this at the start of each conversation. Ultaura is designed to provide friendly, natural conversation — never to deceive.`,
      },
      {
        question: `Does Ultaura work with landlines?`,
        answer: `Yes! Ultaura works with any phone — landlines, cell phones, even flip phones. No smartphone, internet connection, or app is needed. Your loved one simply picks up the phone.`,
      },
      {
        question: `Is Ultaura available outside the United States?`,
        answer: `Currently, Ultaura is only available for US phone numbers. We're working on expanding to other countries in the future.`,
      },
    ],
  },
  {
    title: 'Usage & Scheduling',
    items: [
      {
        question: `Can my loved one call Ultaura anytime?`,
        answer: `Yes! Your loved one can call Ultaura 24/7 for inbound calls. Scheduled outbound calls (when Ultaura calls them) respect quiet hours that you configure in your dashboard.`,
      },
      {
        question: `How does Ultaura remember previous conversations?`,
        answer: `Ultaura maintains encrypted memory notes about your loved one's interests, stories, and preferences. This allows for continuity across calls without storing full transcripts. Memories are encrypted and never shared.`,
      },
      {
        question: `What if my loved one wants to stop receiving calls?`,
        answer: `Your loved one can opt out at any time by pressing 9 during a call or simply telling Ultaura they don't want more calls. You can also pause or disable a line from your dashboard.`,
      },
    ],
  },
  {
    title: 'Safety & Privacy',
    items: [
      {
        question: `What happens in an emergency?`,
        answer: `If Ultaura detects distress or concerning language during a call, it gently encourages contacting 988 (mental health crisis line) or 911 for emergencies. Ultaura is a companion, not a replacement for emergency services or medical care.`,
      },
      {
        question: `Do you store conversation transcripts?`,
        answer: `No, we do not store transcripts by default. We only keep basic call information (time, duration) visible in your dashboard. Your loved one's privacy is paramount to us.`,
      },
    ],
  },
  {
    title: 'Billing & Account',
    items: [
      {
        question: `Can I cancel my subscription?`,
        answer: `Yes, you can cancel your subscription at any time from your account settings. If you cancel, your service will continue until the end of your current billing period.`,
      },
      {
        question: `Do you offer a free trial?`,
        answer: `Yes! Every plan includes a free trial with 20 minutes of calls so you and your loved one can try Ultaura before committing. No credit card required to start.`,
      },
    ],
  },
];

const FAQPage = () => {
  // Flatten data for structured data
  const flatData = CATEGORIES.flatMap((category) => category.items);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: flatData.map((item) => {
      return {
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      };
    }),
  };

  return (
    <div>
      <script
        key={'ld:json'}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <Container>
        <div className={'flex flex-col space-y-16 py-16'}>
          <div className={'flex flex-col items-center space-y-4 text-center'}>
            <Heading type={1}>Frequently Asked Questions</Heading>
            <SubHeading>
              Everything you need to know about Ultaura and how it works.
            </SubHeading>
          </div>

          <div className={'mx-auto w-full max-w-3xl space-y-12'}>
            {CATEGORIES.map((category, index) => (
              <div key={index} className={'space-y-6'}>
                <Heading type={3}>{category.title}</Heading>
                <Accordion>
                  {category.items.map((item, itemIndex) => (
                    <AccordionItem
                      key={itemIndex}
                      value={`${index}-${itemIndex}`}
                    >
                      <AccordionTrigger className="hover:bg-transparent">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent>{item.answer}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
};

export default withI18n(FAQPage);
