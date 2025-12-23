import { cn } from '~/core/generic/shadcn-utils';

const LogoImage: React.FCC<{
  className?: string;
}> = ({ className }) => {
  return (
    <img
      src="/logos/logo.svg"
      alt="Ultaura"
      className={cn('h-8 w-auto', className)}
    />
  );
};

export default LogoImage;
