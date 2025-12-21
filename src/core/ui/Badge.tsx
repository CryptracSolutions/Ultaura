import { cva } from 'cva';
import classNames from 'clsx';

type Color = `normal` | 'success' | 'warn' | 'error' | 'info' | 'custom';
type Size = `normal` | `small` | 'custom';

const classNameBuilder = getClassNameBuilder();

const Badge: React.FCC<{
  color?: Color;
  size?: Size;
  className?: string;
}> = ({ children, color, size, ...props }) => {
  const className = classNameBuilder({
    color,
    size,
  });

  return (
    <div className={classNames(className, props.className)}>{children}</div>
  );
};

function getClassNameBuilder() {
  return cva([`flex space-x-2 items-center font-medium`], {
    variants: {
      color: {
        normal: `text-muted-foreground bg-muted`,
        success: `bg-success/10 text-success`,
        warn: `bg-warning/10 text-warning`,
        error: `bg-destructive/10 text-destructive`,
        info: `bg-info/10 text-info`,
        custom: '',
      },
      size: {
        normal: `rounded-lg px-3 py-2 text-sm`,
        small: `rounded px-2 py-1 text-xs`,
        custom: '',
      },
    },
    defaultVariants: {
      color: `normal`,
      size: `normal`,
    },
  });
}

export default Badge;
