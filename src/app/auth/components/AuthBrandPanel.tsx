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
  PhoneIcon,
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
];

const TRUST_BADGES = [
  {
    icon: PhoneIcon,
    text: '10,000+ daily check-ins',
  },
  {
    icon: LockClosedIcon,
    text: 'Bank-level encryption',
  },
  {
    icon: CreditCardIcon,
    text: 'No credit card required',
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

      {/* Soft glow effect behind content area */}
      <div
        aria-hidden
        className={
          'pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2' +
          ' h-[500px] w-[500px] rounded-full bg-white/10 blur-3xl'
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
            className={'relative h-[77px] w-auto brightness-0 invert'}
            label={'Ultaura'}
          />
        </div>

        {/* Larger, bolder headline */}
        <Heading
          type={1}
          className={'mt-5 text-white text-4xl md:text-[2.25rem] leading-[1.1]'}
        >
          Companionship, One Call at a Time
        </Heading>

        {/* Bullet points with icons */}
        <ul className={'mx-auto mt-8 w-full max-w-sm space-y-4 text-left'}>
          {BULLET_POINTS.map((point, index) => (
            <li key={index} className={'flex items-start gap-3'}>
              <div className={'mt-0.5 shrink-0 rounded-lg bg-white/20 p-1.5'}>
                <point.icon className={'h-4 w-4 text-white'} />
              </div>
              <span className={'text-sm leading-relaxed text-white/95'}>
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
                'flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5' +
                ' text-xs font-medium text-white/95 backdrop-blur-sm'
              }
            >
              <badge.icon className={'h-3.5 w-3.5 text-white/90'} />
              <span>{badge.text}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default AuthBrandPanel;
