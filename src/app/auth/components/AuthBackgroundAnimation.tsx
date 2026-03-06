'use client';

import { motion, useReducedMotion } from 'framer-motion';

const grainTexture: React.CSSProperties = {
  backgroundImage:
    'radial-gradient(rgba(255,255,255,0.12) 0.8px, transparent 0.8px), radial-gradient(rgba(255,255,255,0.08) 0.6px, transparent 0.6px)',
  backgroundPosition: '0 0, 14px 14px',
  backgroundSize: '28px 28px',
};

function StaticAmbientSurface() {
  return (
    <>
      <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(3,34,42,0.34)_0%,rgba(3,34,42,0.10)_22%,rgba(3,34,42,0)_52%),radial-gradient(circle_at_50%_46%,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.10)_16%,rgba(255,255,255,0)_36%),radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.42)_0%,rgba(255,255,255,0.16)_20%,rgba(255,255,255,0)_46%),radial-gradient(circle_at_84%_16%,rgba(125,249,255,0.34)_0%,rgba(125,249,255,0.12)_24%,rgba(125,249,255,0)_50%),radial-gradient(circle_at_72%_80%,rgba(9,204,198,0.40)_0%,rgba(9,204,198,0.16)_26%,rgba(9,204,198,0)_56%),radial-gradient(circle_at_18%_82%,rgba(255,255,255,0.20)_0%,rgba(255,255,255,0.07)_20%,rgba(255,255,255,0)_40%)]" />
      <div className="absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.32)_0%,rgba(255,255,255,0.12)_18%,rgba(255,255,255,0)_60%)] blur-3xl" />
      <div className="absolute -left-28 top-[-6%] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.44)_0%,rgba(255,255,255,0.18)_24%,rgba(255,255,255,0)_64%)] blur-3xl" />
      <div className="absolute left-[18%] top-[20%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(173,247,255,0.32)_0%,rgba(173,247,255,0.12)_26%,rgba(173,247,255,0)_68%)] blur-3xl" />
      <div className="absolute right-[-14%] top-[10%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(128,240,255,0.36)_0%,rgba(128,240,255,0.13)_28%,rgba(128,240,255,0)_68%)] blur-3xl" />
      <div className="absolute bottom-[-18%] right-[6%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(9,204,198,0.42)_0%,rgba(9,204,198,0.18)_26%,rgba(9,204,198,0)_72%)] blur-3xl" />
      <svg
        className="absolute inset-0 h-full w-full opacity-80"
        viewBox="0 0 1000 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path
          d="M-80 486C68 404 165 374 280 386C416 400 505 486 650 480C756 475 848 411 1080 238"
          fill="none"
          stroke="rgba(255,255,255,0.34)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M-120 564C80 492 185 464 302 472C462 482 554 568 712 560C820 554 924 490 1120 350"
          fill="none"
          stroke="rgba(255,255,255,0.24)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M-40 414C126 356 228 344 338 376C470 414 554 484 694 466C800 452 898 382 1090 272"
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
        <path
          d="M-110 302C56 274 192 286 322 344C446 400 542 434 690 408C820 386 938 314 1108 184"
          fill="none"
          stroke="rgba(173,247,255,0.22)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M-98 222C78 196 214 210 340 266C466 322 576 352 714 322C838 296 950 234 1120 128"
          fill="none"
          stroke="rgba(255,255,255,0.17)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <path
          d="M-150 238C28 238 168 278 304 340C430 398 540 424 668 382C800 338 926 254 1134 124"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1.05"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 opacity-[0.13] mix-blend-soft-light" style={grainTexture} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.24)_0%,rgba(255,255,255,0.08)_20%,rgba(255,255,255,0)_44%),linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0)_28%,rgba(0,0,0,0.18)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,12,18,0.14)_0%,rgba(2,12,18,0)_26%,rgba(2,12,18,0)_68%,rgba(2,12,18,0.10)_100%)]" />
    </>
  );
}

export function AuthBackgroundAnimation() {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <StaticAmbientSurface />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(3,34,42,0.34)_0%,rgba(3,34,42,0.10)_22%,rgba(3,34,42,0)_52%)]" />
      <motion.div
        className="absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.32)_0%,rgba(255,255,255,0.12)_18%,rgba(255,255,255,0)_62%)] blur-3xl"
        animate={{
          scale: [1, 1.08, 0.98, 1],
          opacity: [0.54, 0.82, 0.62, 0.54],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -left-28 top-[-8%] h-[33rem] w-[33rem] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.46)_0%,rgba(255,255,255,0.18)_24%,rgba(255,255,255,0)_64%)] blur-3xl"
        animate={{
          x: [0, 30, -12, 0],
          y: [0, -26, 12, 0],
          scale: [1, 1.08, 0.98, 1],
          opacity: [0.76, 1, 0.82, 0.76],
        }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-[16%] top-[18%] h-[27rem] w-[27rem] rounded-full bg-[radial-gradient(circle,rgba(173,247,255,0.34)_0%,rgba(173,247,255,0.13)_26%,rgba(173,247,255,0)_68%)] blur-3xl"
        animate={{
          x: [0, -18, 22, 0],
          y: [0, 18, -12, 0],
          scale: [1, 0.98, 1.1, 1],
          opacity: [0.42, 0.64, 0.76, 0.42],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute right-[-14%] top-[10%] h-[29rem] w-[29rem] rounded-full bg-[radial-gradient(circle,rgba(128,240,255,0.38)_0%,rgba(128,240,255,0.14)_28%,rgba(128,240,255,0)_68%)] blur-3xl"
        animate={{
          x: [0, -22, 18, 0],
          y: [0, 24, -12, 0],
          scale: [1, 1.1, 0.96, 1],
          opacity: [0.62, 0.86, 0.7, 0.62],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[-18%] right-[6%] h-[31rem] w-[31rem] rounded-full bg-[radial-gradient(circle,rgba(9,204,198,0.44)_0%,rgba(9,204,198,0.18)_26%,rgba(9,204,198,0)_72%)] blur-3xl"
        animate={{
          x: [0, 18, -20, 0],
          y: [0, -26, 10, 0],
          scale: [1, 0.95, 1.1, 1],
          opacity: [0.62, 0.82, 0.92, 0.62],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        animate={{ x: [0, 14, -10, 0], y: [0, -12, 8, 0], opacity: [0.56, 0.8, 0.64, 0.56] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      >
        <path
          d="M-80 486C68 404 165 374 280 386C416 400 505 486 650 480C756 475 848 411 1080 238"
          fill="none"
          stroke="rgba(255,255,255,0.34)"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <path
          d="M-120 564C80 492 185 464 302 472C462 482 554 568 712 560C820 554 924 490 1120 350"
          fill="none"
          stroke="rgba(255,255,255,0.24)"
          strokeWidth="1.45"
          strokeLinecap="round"
        />
        <path
          d="M-40 414C126 356 228 344 338 376C470 414 554 484 694 466C800 452 898 382 1090 272"
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
        <path
          d="M-110 302C56 274 192 286 322 344C446 400 542 434 690 408C820 386 938 314 1108 184"
          fill="none"
          stroke="rgba(173,247,255,0.24)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M-98 222C78 196 214 210 340 266C466 322 576 352 714 322C838 296 950 234 1120 128"
          fill="none"
          stroke="rgba(255,255,255,0.20)"
          strokeWidth="1.05"
          strokeLinecap="round"
        />
        <path
          d="M-150 238C28 238 168 278 304 340C430 398 540 424 668 382C800 338 926 254 1134 124"
          fill="none"
          stroke="rgba(255,255,255,0.20)"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </motion.svg>
      <motion.div
        className="absolute inset-0 opacity-[0.14] mix-blend-soft-light"
        style={grainTexture}
        animate={{ opacity: [0.11, 0.17, 0.14, 0.14] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0.10)_18%,rgba(255,255,255,0)_46%)]"
        animate={{ opacity: [0.62, 0.92, 0.74, 0.62] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_24%,rgba(0,0,0,0.18)_100%),linear-gradient(90deg,rgba(2,12,18,0.12)_0%,rgba(2,12,18,0)_24%,rgba(2,12,18,0)_68%,rgba(2,12,18,0.08)_100%)]"
        animate={{ opacity: [0.86, 1, 0.92, 0.86] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
