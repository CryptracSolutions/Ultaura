import Logo from '~/core/ui/Logo';
import Heading from '~/core/ui/Heading';
import {
  ChatBubbleLeftRightIcon,
  BellIcon,
  HeartIcon,
  ShieldCheckIcon,
  SparklesIcon,
  LockClosedIcon,
  CreditCardIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

const BULLET_POINTS = [
  {
    icon: ChatBubbleLeftRightIcon,
    text: 'Friendly conversations that feel genuinely human',
  },
  {
    icon: BellIcon,
    text: 'Gentle reminders for medications, appointments, daily routines',
  },
  {
    icon: HeartIcon,
    text: 'Peace of mind knowing someone is always there to listen',
  },
  {
    icon: ShieldCheckIcon,
    text: 'Safety alerts when something seems concerning',
  },
  {
    icon: SparklesIcon,
    text: 'Five warm voice personalities to choose from',
  },
  {
    icon: ClockIcon,
    text: 'Available whenever they want to talk, day or night',
  },
];

const TRUST_BADGES = [
  {
    icon: LockClosedIcon,
    text: 'Private conversations, always secure',
  },
  {
    icon: CreditCardIcon,
    text: 'No credit card required',
  },
  {
    icon: ClockIcon,
    text: 'Always there when you need them',
  },
  {
    icon: ShieldCheckIcon,
    text: 'HIPAA compliant & secure',
  },
];

function AuthBrandPanel() {
  return (
    <aside
      className={
        'relative hidden min-h-screen overflow-hidden lg:flex' +
        ' items-center justify-center px-10' +
        ' bg-gradient-to-br from-primary via-primary/90 to-primary/70'
      }
    >
      {/* Layered gradient overlays for depth */}
      <div
        aria-hidden
        className={
          'pointer-events-none absolute inset-0 opacity-30' +
          ' [background-image:radial-gradient(circle_at_top,rgba(255,255,255,0.5),transparent_60%)]'
        }
      />
      <div
        aria-hidden
        className={
          'pointer-events-none absolute inset-0 opacity-20' +
          ' [background-image:radial-gradient(circle_at_bottom_left,rgba(0,0,0,0.2),transparent_50%)]'
        }
      />


      <div className={'relative mx-auto flex max-w-md flex-col items-center text-center text-white'}>
        {/* Logo with soft glow effect */}
        <div className="relative">
          <div
            aria-hidden
            className={
              'pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' +
              ' h-32 w-32 rounded-full bg-white/20 blur-2xl'
            }
          />
          <Logo
            className={'relative h-[85px] w-auto brightness-0 invert'}
            label={'Ultaura'}
          />
        </div>

        {/* Larger, bolder headline */}
        <Heading
          type={1}
          className={'mt-5 text-white text-3xl md:text-[1.8rem] font-medium leading-[1.1] whitespace-nowrap'}
        >
          Companionship, One Call at a Time
        </Heading>

        {/* Bullet points with icons */}
        <ul className={'mx-auto mt-8 grid w-full max-w-lg grid-cols-2 gap-4 text-left'}>
          {BULLET_POINTS.map((point, index) => (
            <li key={index} className={'flex items-start gap-2'}>
              <point.icon className={'mt-0.5 h-4 w-4 shrink-0 text-white'} />
              <span className={'text-[12px] leading-relaxed text-white'}>
                {point.text}
              </span>
            </li>
          ))}
        </ul>

        {/* Stats/Trust badges */}
        <div className={'mt-8 flex flex-wrap items-center justify-center gap-3'}>
          {TRUST_BADGES.map((badge, index) => (
            <div
              key={index}
              className={
                'flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5' +
                ' text-[12px] font-medium text-white backdrop-blur-sm'
              }
            >
              <badge.icon className={'h-3.5 w-3.5 text-white'} />
              <span>{badge.text}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default AuthBrandPanel;
