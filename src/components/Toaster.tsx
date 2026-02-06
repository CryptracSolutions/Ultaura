'use client';

import { Toaster as Sonner } from 'sonner';

function Toaster({
  position = 'top-center',
  richColors = true,
  ...props
}: React.ComponentProps<typeof Sonner> = {}) {
  return (
    <Sonner
      richColors={richColors}
      position={position}
      offset={0}
      mobileOffset={0}
      toastOptions={{
        className: 'bg-background text-foreground border-border',
      }}
      {...props}
    />
  );
}

export default Toaster;
