import { forwardRef } from 'react';
import classNames from 'clsx';

const InputFile = forwardRef<
  React.ElementRef<'input'>,
  React.InputHTMLAttributes<unknown>
>(function InputFileComponent({ className, ...props }, ref) {
  return (
    <input
      {...props}
      ref={ref}
      type={'file'}
      className={classNames(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:!outline-none focus-visible:!border-primary disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    />
  );
});

export default InputFile;
