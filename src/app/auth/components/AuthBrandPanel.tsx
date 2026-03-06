'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import LogoImage from '~/core/ui/Logo/LogoImage';
import { cn } from '~/core/generic/shadcn-utils';
import { AuthBackgroundAnimation } from './AuthBackgroundAnimation';

function AuthBrandPanel() {
  const prefersReducedMotion = useReducedMotion();
  return (
    <aside
      className={
        'relative isolate hidden min-h-screen overflow-hidden lg:flex' +
        ' flex-col items-center justify-center px-10' +
        ' bg-card'
      }
    >
      <AuthBackgroundAnimation />

      <div
        className={
          'relative z-10 flex flex-col items-center gap-0 rounded-[2rem] px-10 py-12 text-center' +
          ' animate-in fade-in slide-in-from-bottom-4 duration-1000'
        }
      >
        <Link
          aria-label="Ultaura"
          href="/"
          className="inline-flex items-center gap-2"
        >
          {prefersReducedMotion ? (
            <LogoImage className="h-20 w-auto brightness-0 invert" />
          ) : (
            <motion.div
              animate={{ scale: [1, 1.04, 1], opacity: [1, 0.97, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-block"
            >
              <LogoImage className="h-20 w-auto brightness-0 invert" />
            </motion.div>
          )}
          <span
            className={cn(
              'select-none text-base font-semibold leading-none tracking-tight text-white text-3xl',
            )}
          >
            Ultaura
          </span>
        </Link>

        <p className={'max-w-sm text-balance text-lg font-medium tracking-[0.01em] text-white/90'}>
          Companionship, One Call at a Time
        </p>
      </div>
    </aside>
  );
}

export default AuthBrandPanel;
