import { cn } from '~/core/generic/shadcn-utils';

const LogoImageMini: React.FCC<{
  className?: string;
}> = ({ className }) => {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logos/logo.svg"
      alt="Ultaura"
      className={cn('h-6 w-auto', className)}
    />
  );
};

export default LogoImageMini;
