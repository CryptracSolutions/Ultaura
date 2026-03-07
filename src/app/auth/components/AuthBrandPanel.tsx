'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import LogoImage from '~/core/ui/Logo/LogoImage';
import { cn } from '~/core/generic/shadcn-utils';

function AuthBrandPanel() {
  const prefersReducedMotion = useReducedMotion();
  return (
    <aside
      className={
        'relative isolate hidden min-h-screen overflow-hidden lg:block' // Changed from flex/items-center to block to allow absolute positioning
      }
    >
      <div className="pointer-events-none absolute inset-0 z-0">
        <svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' preserveAspectRatio="none">
          <rect fill='#000000' width='100%' height='100%'/>
          <defs>
            <linearGradient id='a' x1='0' x2='0' y1='0' y2='1' gradientTransform='rotate(360,0.5,0.5)'>
              <stop offset='0' stopColor='#22D3EE'/>
              <stop offset='1' stopColor='#4ECDC4'/>
            </linearGradient>
            <pattern id='b' width='13' height='13' patternUnits='userSpaceOnUse'>
              <circle fill='#000000' cx='6.5' cy='6.5' r='6.5'/>
            </pattern>
          </defs>
          <rect width='100%' height='100%' fill='url(#a)'/>
          <rect width='100%' height='100%' fill='url(#b)' fillOpacity='0.06'/>
        </svg>
      </div>
      
      {/* Top Left Logo & Wordmark */}
      <div className="absolute top-2 left-4 z-10 animate-in fade-in slide-in-from-top-4 duration-1000">
        <Link
          aria-label="Ultaura"
          href="/"
          className="inline-flex items-center gap-2"
        >
          {prefersReducedMotion ? (
            <LogoImage className="h-10 w-auto brightness-0 invert drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
          ) : (
            <motion.div
              animate={{ scale: [1, 1.04, 1], opacity: [1, 0.97, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-block"
            >
              <LogoImage className="h-10 w-auto brightness-0 invert drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
            </motion.div>
          )}
          <span
            className={cn(
              'select-none text-base font-bold leading-none tracking-tight text-white text-[1.45rem] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]',
            )}
          >
            Ultaura
          </span>
        </Link>
      </div>

      {/* Bottom Right Tagline */}
      <div className="absolute bottom-2 right-4 z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <p className={'text-right max-w-sm text-balance text-base font-semibold tracking-[0.01em] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]'}>
          Companionship, One Call at a Time
        </p>
      </div>
    </aside>
  );
}

export default AuthBrandPanel;
