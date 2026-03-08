'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import LogoImage from '~/core/ui/Logo/LogoImage';

function AuthBrandPanel() {
  const prefersReducedMotion = useReducedMotion();
  return (
    <aside
      className={
        'relative isolate hidden min-h-screen overflow-hidden bg-primary/5 lg:block'
      }
    >
      {/* Top Left Wordmark */}
      <div className="absolute top-2 left-4 z-10 animate-in fade-in slide-in-from-top-4 duration-1000">
        <Link
          aria-label="Ultaura"
          href="/"
          className="inline-flex items-center"
        >
          <span className="select-none text-2xl font-semibold leading-none text-primary">
            Ultaura
          </span>
        </Link>
      </div>

      {/* Center Logo */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <Link
          aria-label="Ultaura home"
          href="/"
          className="inline-flex items-center justify-center"
        >
          {prefersReducedMotion ? (
            <LogoImage className="h-[8.25rem] w-auto" />
          ) : (
            <motion.div
              animate={{ scale: [1, 1.04, 1], opacity: [1, 0.97, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex items-center justify-center"
            >
              <LogoImage className="h-[8.25rem] w-auto" />
            </motion.div>
          )}
        </Link>
      </div>

      {/* Bottom Right Tagline */}
      <div className="absolute bottom-2 right-4 z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <p className={'max-w-sm text-balance text-right text-base font-semibold leading-none text-primary'}>
          Companionship, One Call at a Time
        </p>
      </div>
    </aside>
  );
}

export default AuthBrandPanel;
