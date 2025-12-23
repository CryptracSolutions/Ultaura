import { cn } from '~/core/generic/shadcn-utils';

const LogoImageMini: React.FCC<{
  className?: string;
}> = ({ className }) => {
  return (
    <img
      src="/logos/logo.svg"
      alt="Ultaura"
      className={cn('h-6 w-auto', className)}
    />
  );
};

export default LogoImageMini;
