import { ChevronRightIcon } from '@heroicons/react/24/outline';

import Button from '~/core/ui/Button';

export function MainCallToActionButton() {
  return (
    <Button
      className={
        'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg' +
        ' hover:shadow-primary/30'
      }
      variant={'custom'}
      size={'lg'}
      round
      href={'/auth/sign-up'}
    >
      <span className={'flex items-center justify-center space-x-2 w-full'}>
        <span>Start Free Trial</span>
        <ChevronRightIcon
          className={
            'h-4 animate-in fade-in slide-in-from-left-8' +
            ' delay-1000 fill-mode-both duration-1000 zoom-in'
          }
        />
      </span>
    </Button>
  );
}
