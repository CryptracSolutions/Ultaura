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
      offset={20}
      mobileOffset={0}
      toastOptions={{
        className: 'text-foreground',
      }}
      {...props}
    />
  );
}

export default Toaster;
