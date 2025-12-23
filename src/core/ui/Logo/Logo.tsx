import Link from 'next/link';
import LogoImage from './LogoImage';
import { cn } from '~/core/generic/shadcn-utils';

const Logo: React.FCC<{
  href?: string;
  className?: string;
  label?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
}> = ({
  href,
  label,
  className,
  showWordmark = false,
  wordmarkClassName,
}) => {
  return (
    <Link
      aria-label={label ?? 'Home Page'}
      href={href ?? '/'}
      className={'inline-flex items-center gap-2'}
    >
      <LogoImage className={className} />

      {showWordmark ? (
        <span
          className={cn(
            'select-none text-base font-semibold leading-none tracking-tight text-primary',
            wordmarkClassName,
          )}
        >
          Ultaura
        </span>
      ) : null}
    </Link>
  );
};

export default Logo;
