export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface FAQCategory {
  id: string;
  title: string;
  description?: string;
  items: FAQItem[];
}

export const FAQ_DATA: FAQCategory[] = [
  {
    id: 'general',
    title: 'General',
    description: 'Learn the basics about Ultaura and how it works.',
    items: [
      {
        id: 'what-is-ultaura',
        question: 'What is Ultaura?',
        answer:
          'Ultaura is an AI-powered voice companion that makes friendly check-in calls to seniors. It provides conversation, reminders, activity suggestions, and companionship while keeping family members informed about their loved one\'s wellbeing.',
      },
      {
        id: 'what-is-line',
        question: 'What is a "line"?',
        answer:
          'A line represents one phone number that Ultaura calls. Each line has its own schedule, preferences, reminders, and memory. Depending on your plan, you can have 1 to 4 lines, or unlimited lines on Pay As You Go, for different family members.',
      },
      {
        id: 'is-real-person',
        question: 'Is Ultaura a real person?',
        answer:
          'No, Ultaura is an AI voice companion. However, our advanced voice technology creates natural, warm conversations that feel personal. You can choose from 5 different voice personalities: Ara, Eve, Leo, Rex, or Sal.',
      },
      {
        id: 'landlines',
        question: 'Does Ultaura work with landlines?',
        answer:
          'Yes, Ultaura works with any phone that can receive calls, including landlines, mobile phones, and VoIP services. The phone number just needs to be able to receive a verification code via call or text during setup.',
      },
      {
        id: 'outside-us',
        question: 'Is Ultaura available outside the United States?',
        answer:
          'Currently, Ultaura is only available for phone numbers in the United States. We are working on expanding to other countries and will announce availability as we add new regions.',
      },
    ],
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Everything you need to know to set up Ultaura for your loved one.',
    items: [
      {
        id: 'setup-line',
        question: 'How do I set up a line for my loved one?',
        answer:
          'From your dashboard, click "Add Line" and enter your loved one\'s phone number and name. After verifying the number, you can set up their call schedule, preferences, and any reminders they need.',
      },
      {
        id: 'phone-verification',
        question: 'How is the phone number verified?',
        answer:
          'We use Twilio Verify to send a one-time code via text message or voice call to the phone number. This ensures calls only go to numbers that have been explicitly authorized, protecting against unwanted calls.',
      },
      {
        id: 'first-call',
        question: 'What happens on the first call?',
        answer:
          'On the first call, Ultaura introduces itself, explains how it works, and asks about your loved one\'s interests and preferences. This helps personalize future conversations and build a comfortable rapport.',
      },
      {
        id: 'use-without-help',
        question: 'Can my loved one use Ultaura without help?',
        answer:
          'Absolutely. Your loved one simply answers the phone when Ultaura calls, or they can call Ultaura whenever they\'d like. There\'s nothing to install, no buttons to press, and no technology to learn. They just have a conversation.',
      },
    ],
  },
  {
    id: 'calls-scheduling',
    title: 'Calls & Scheduling',
    description: 'Manage when and how Ultaura connects with your loved one.',
    items: [
      {
        id: 'call-anytime',
        question: 'Can my loved one call Ultaura anytime?',
        answer:
          'Yes! Your loved one can call Ultaura anytime, 24/7/365. Ultaura also makes outbound calls at scheduled times, so you can set multiple call times per day to ensure your loved one gets the connection they need.',
      },
      {
        id: 'set-schedule',
        question: 'How do I set up a call schedule?',
        answer:
          'In the dashboard, go to your line\'s Calls page and select "Add Schedule." You can set specific times for daily calls, choose which days to call, and adjust the schedule anytime.',
      },
      {
        id: 'quiet-hours',
        question: 'What are quiet hours?',
        answer:
          'Quiet hours are times when Ultaura won\'t call, even if a call is scheduled. Set quiet hours during sleep times or regular activities. You can also enable vacation mode to pause all calls temporarily.',
      },
      {
        id: 'missed-call',
        question: 'What happens if my loved one misses a call?',
        answer:
          'If the call goes to voicemail, Ultaura can leave a brief or detailed message based on your settings, or simply hang up. You can configure the voicemail behavior in your line settings.',
      },
      {
        id: 'call-length',
        question: 'How long are the calls?',
        answer:
          'Check-in calls typically last 5-20 minutes, but your loved one controls the conversation. Reminder calls are less than a minute unless your loved one decides to continue the conversation. They can chat as long as they like or end the call whenever they\'re ready. Longer conversations simply use more of your plan\'s minutes.',
      },
    ],
  },
  {
    id: 'features',
    title: 'Features & Capabilities',
    description: 'Discover what Ultaura can do for your loved one.',
    items: [
      {
        id: 'memory-works',
        question: 'How does Ultaura remember previous conversations?',
        answer:
          'Ultaura securely stores conversation summaries and key details, building a memory of your loved one\'s life, interests, and preferences. This allows for continuous, meaningful conversations that pick up where they left off.',
      },
      {
        id: 'reminders',
        question: 'What are reminders and how do they work?',
        answer:
          'Reminders are messages Ultaura will mention during calls, like medication times, appointments, or birthdays. You can set one-time or recurring reminders, and pause, snooze, or skip them as needed. Reminder limits are plan-based: Free Trial and Care include up to 5 reminders per line, Comfort includes up to 10 reminders per line, and Family plus Pay As You Go include unlimited reminders.',
      },
      {
        id: 'insights',
        question: 'What are insights?',
        answer:
          'Insights are observations from conversations, including mood trends, conversation highlights, and topics discussed. Family members can view these in the dashboard to stay connected to their loved one\'s daily life.',
      },
      {
        id: 'milestones',
        question: 'What are milestones?',
        answer:
          'Milestones are special dates like birthdays, anniversaries, and memorials. Ultaura remembers these and can bring them up in conversation, helping your loved one celebrate happy occasions or receive support during difficult times.',
      },
      {
        id: 'activities',
        question: 'Can Ultaura play games or suggest activities?',
        answer:
          'Yes, Ultaura can play word games, trivia, tell jokes, share stories, and suggest activities based on your loved one\'s interests and abilities. These help keep conversations engaging and mentally stimulating.',
      },
    ],
  },
  {
    id: 'safety-privacy',
    title: 'Safety & Privacy',
    description: 'How we protect your loved one and their information.',
    items: [
      {
        id: 'emergency',
        question: 'What happens in an emergency?',
        answer:
          'If Ultaura detects signs of distress or an emergency, it can suggest calling 988 (mental health crisis) or 911, and notify trusted contacts you\'ve designated. We take safety seriously and have multiple tiers of response.',
      },
      {
        id: 'transcripts',
        question: 'Do you store conversation transcripts?',
        answer:
          'We store encrypted conversation summaries and insights, not full transcripts. Audio recordings are automatically deleted after processing. You control data retention settings in the Privacy Center.',
      },
      {
        id: 'encryption',
        question: 'How is my loved one\'s data protected?',
        answer:
          'All sensitive data is encrypted using AES-256-GCM encryption with envelope encryption. Each account has unique encryption keys, and we follow strict security practices to protect personal information.',
      },
      {
        id: 'topic-exclusions',
        question: 'Can certain topics be excluded from conversations?',
        answer:
          'Yes, you can set topic exclusions in the Privacy Center. If there are sensitive subjects you\'d prefer Ultaura not discuss, simply add them and Ultaura will steer conversations away from those areas.',
      },
      {
        id: 'opt-out',
        question: 'How can my loved one opt out of calls?',
        answer:
          'Your loved one can tell Ultaura during any call that they want to stop receiving calls. You can also pause or cancel the line from the dashboard at any time. We respect opt-out requests immediately.',
      },
    ],
  },
  {
    id: 'family-contacts',
    title: 'Family & Trusted Contacts',
    description: 'Stay connected and informed about your loved one.',
    items: [
      {
        id: 'trusted-contacts',
        question: 'What are trusted contacts?',
        answer:
          'Trusted contacts are people you designate to be notified in certain situations, such as safety events or wellness concerns. They can receive alerts and weekly summaries about your loved one\'s wellbeing.',
      },
      {
        id: 'wellness-alerts',
        question: 'How do wellness alerts work?',
        answer:
          'When Ultaura detects concerning patterns in conversations, such as mentions of feeling unwell, loneliness, or distress, it can automatically alert you and other trusted contacts so you can check in.',
      },
      {
        id: 'summaries',
        question: 'Can I see summaries of conversations?',
        answer:
          'Yes, you can view conversation insights in the dashboard, including mood trends and highlights. You can also receive weekly email summaries that give you a snapshot of how your loved one is doing.',
      },
      {
        id: 'multiple-access',
        question: 'Can multiple family members access the account?',
        answer:
          'Currently, each account has one primary login. However, trusted contacts can receive alerts and summaries via email or SMS. Multi-user account access is on our roadmap for a future update.',
      },
    ],
  },
  {
    id: 'billing-plans',
    title: 'Billing & Plans',
    description: 'Understand pricing, plans, and how billing works.',
    items: [
      {
        id: 'plans-available',
        question: 'What plans are available?',
        answer:
          'We offer Care ($19/month, 200 minutes, 1 line), Comfort ($49/month, 600 minutes, 2 lines), Family ($99/month, 1,200 minutes, 4 lines), and Pay As You Go ($0.15/minute, no monthly commitment, unlimited lines). Annual plans save 20%. All plans include the full feature set — daily calls, insights, safety monitoring, reminders, and more. Plans differ only in included minutes, number of lines, and reminders per line.',
      },
      {
        id: 'free-trial',
        question: 'Is there a free trial?',
        answer:
          'Yes, we offer a 14-day free trial with up to 20 minutes per day. Cancel anytime. This gives you and your loved one time to experience Ultaura before committing to a plan.',
      },
      {
        id: 'usage-counting',
        question: 'What counts as usage?',
        answer:
          'Usage is counted in minutes of actual call time. Minutes are pooled across all lines on your account. Only connected call time counts; there\'s no charge for calls that go unanswered or reach voicemail. Most reminder calls use about 1 minute.',
      },
      {
        id: 'overage',
        question: 'What happens if I go over my included minutes?',
        answer:
          'If you exceed your plan\'s included minutes, additional usage is billed at $0.15 per minute. You\'ll receive notifications as you approach your limit.',
      },
      {
        id: 'cancel',
        question: 'How do I cancel?',
        answer:
          'Cancel anytime from the Billing section of your dashboard. Your service continues until the end of your current billing period. After cancellation, your data is retained for 30 days in case you change your mind, then permanently deleted unless you export it first through the Privacy Center.',
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Solutions to common questions and issues.',
    items: [
      {
        id: 'call-didnt-come',
        question: "The scheduled call didn't come through",
        answer:
          'Check that the line is active, not paused, and that the scheduled time hasn\'t fallen within quiet hours or vacation mode. Also verify the phone number is correct and can receive calls. Contact support if the issue persists.',
      },
      {
        id: 'not-understood',
        question: "Ultaura didn't understand my loved one",
        answer:
          'Background noise can affect understanding. You can also enable hearing support in accessibility settings, which adjusts how Ultaura speaks and listens.',
      },
      {
        id: 'contact-support',
        question: 'How do I contact support?',
        answer:
          'You can reach our support team at support@ultaura.com, through the Help section in your dashboard, or by visiting our contact page at ultaura.com/contact. We typically respond within 24 hours and are happy to help with any questions or issues.',
      },
      {
        id: 'change-voice',
        question: "Can I change Ultaura's voice?",
        answer:
          'Yes, you can choose from 5 voice personalities: Ara, Eve, Leo, Rex, or Sal. Go to your line\'s settings and select "Voice" to preview and choose the voice that feels most comfortable for your loved one.',
      },
    ],
  },
];
