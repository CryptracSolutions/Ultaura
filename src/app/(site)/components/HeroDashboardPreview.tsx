'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  BellAlertIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PhoneIcon,
  PlusCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { cn } from '~/core/generic/shadcn-utils';

/* ───────── Mock Data ───────── */

const TABS = [
  { id: 'activity', label: 'Activity' },
  { id: 'insights', label: 'Insights' },
  { id: 'memory', label: 'Memory' },
  { id: 'safety', label: 'Safety' },
] as const;

const ACTIVITY_ENTRIES = [
  { time: '6:30 PM', name: 'Mom', duration: '18 min' },
  { time: '6:30 PM', name: 'Grandpa', duration: '22 min' },
  { time: '5:00 PM', name: 'Margaret', duration: '14 min' },
];

const UPCOMING_REMINDERS = [
  { label: 'Take evening medication', time: '7:00 PM' },
  { label: 'Call daughter back', time: 'Tomorrow' },
];

const WEEKLY_BARS = [
  { day: 'M', value: 14, label: '14 min' },
  { day: 'T', value: 22, label: '22 min' },
  { day: 'W', value: 18, label: '18 min' },
  { day: 'T', value: 25, label: '25 min' },
  { day: 'F', value: 20, label: '20 min' },
  { day: 'S', value: 12, label: '12 min' },
  { day: 'S', value: 16, label: '16 min' },
];

const MOOD_SEGMENTS = [
  { color: 'bg-primary/30' },
  { color: 'bg-primary/50' },
  { color: 'bg-primary' },
  { color: 'bg-primary/70' },
  { color: 'bg-primary' },
  { color: 'bg-primary/40' },
  { color: 'bg-primary/60' },
];

const MEMORY_ENTRIES = [
  { text: 'Enjoyed gardening yesterday', time: 'Today' },
  { text: 'Grandson visited last weekend', time: 'Mon' },
  { text: 'Favorite song is Moon River', time: 'Sun' },
  { text: 'Mentioned wanting to bake cookies', time: 'Sat' },
  { text: 'Talked about old neighborhood', time: 'Fri' },
];

const CHAT_MESSAGES: Array<{ sender: 'ara' | 'senior'; text: string }> = [
  {
    sender: 'ara',
    text: 'Hi Mom! I noticed you enjoyed the gardening show yesterday.',
  },
  {
    sender: 'senior',
    text: 'Oh yes, it was wonderful. I learned about roses.',
  },
  {
    sender: 'ara',
    text: 'That\u2019s lovely! By the way, just a reminder \u2014 it\u2019s time for your evening medication.',
  },
  {
    sender: 'senior',
    text: 'Oh right, thank you for reminding me. I\u2019ll take it now.',
  },
  {
    sender: 'ara',
    text: 'Of course! It was so nice chatting with you. Talk soon, Mom!',
  },
  {
    sender: 'senior',
    text: 'Goodbye, dear. Talk to you tomorrow!',
  },
];

const WELLNESS_ALERTS = [
  { title: 'Mood change detected', severity: 'info' as const, time: 'Tue' },
  { title: 'Missed medication reminder', severity: 'warning' as const, time: 'Mon' },
];

const MAX_BAR = Math.max(...WEEKLY_BARS.map((b) => b.value));
const BAR_HEIGHT = 64;

/* ───────── Component ───────── */

export function HeroDashboardPreview() {
  const [activeTab, setActiveTab] = useState(0);
  const [isLiveCall, setIsLiveCall] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isInView, setIsInView] = useState(true);
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [dashboardShellWidth, setDashboardShellWidth] = useState<number>();
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    undefined,
  );
  const [modeHeight, setModeHeight] = useState<number | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const dashboardModeRef = useRef<HTMLDivElement>(null);
  const liveModeRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* Pause auto-cycle when the hero preview isn't visible */
  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const inView = entry.isIntersecting && entry.intersectionRatio >= 0.5;
        setIsInView(inView);
      },
      { threshold: [0, 0.5, 1] },
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  /* Auto-cycle tabs */
  useEffect(() => {
    if (!isAutoPlaying || isLiveCall || !isInView) return;
    const id = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % TABS.length);
    }, 3000);
    return () => clearInterval(id);
  }, [isAutoPlaying, isLiveCall, isInView]);

  /* Sequential message reveal for live call */
  useEffect(() => {
    if (!isLiveCall) {
      setVisibleMessages(0);
      return;
    }
    // Show first message immediately
    setVisibleMessages(1);
    let current = 1;
    const id = setInterval(() => {
      current++;
      if (current > CHAT_MESSAGES.length) {
        clearInterval(id);
        return;
      }
      setVisibleMessages(current);
    }, 1800);
    return () => clearInterval(id);
  }, [isLiveCall]);

  /* Measure active panel height for smooth container sizing */
  useEffect(() => {
    if (isLiveCall) return;

    const panel = panelRefs.current[activeTab];
    if (!panel) return;

    const measure = () => setContentHeight(panel.scrollHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [activeTab, isLiveCall]);

  /* Lock shell width from Dashboard mode so Live mode stays 1:1 */
  useEffect(() => {
    if (!shellRef.current || typeof ResizeObserver === 'undefined') return;

    const element = shellRef.current;
    const measure = () => {
      if (isLiveCall) return;
      setDashboardShellWidth(element.getBoundingClientRect().width);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isLiveCall]);

  /* Smoothly animate height between Dashboard and Live mode containers */
  useEffect(() => {
    const measureActiveMode = () => {
      const activeElement = isLiveCall
        ? liveModeRef.current
        : dashboardModeRef.current;
      if (!activeElement) return;
      const nextHeight = activeElement.getBoundingClientRect().height;
      if (nextHeight > 0) setModeHeight(nextHeight);
    };

    measureActiveMode();

    if (typeof ResizeObserver === 'undefined') return;

    const observers: ResizeObserver[] = [];

    if (dashboardModeRef.current) {
      const observer = new ResizeObserver(() => {
        if (!isLiveCall) measureActiveMode();
      });
      observer.observe(dashboardModeRef.current);
      observers.push(observer);
    }

    if (liveModeRef.current) {
      const observer = new ResizeObserver(() => {
        if (isLiveCall) measureActiveMode();
      });
      observer.observe(liveModeRef.current);
      observers.push(observer);
    }

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [isLiveCall, activeTab, contentHeight, visibleMessages]);

  const handleTabClick = useCallback((index: number) => {
    setActiveTab(index);
    setIsAutoPlaying(false);
  }, []);

  return (
    <div ref={containerRef} className="relative min-w-0 w-full">
      <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-center text-xs text-muted-foreground">
        {isLiveCall ? 'Call Preview' : 'Caregiver View'}
      </span>

      <div
        ref={shellRef}
        className="w-full overflow-hidden rounded-3xl border border-border/60 bg-sidebar p-6 shadow-xl"
        style={
          isLiveCall && dashboardShellWidth
            ? { width: `min(100%, ${dashboardShellWidth}px)` }
            : undefined
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">
            {isLiveCall ? 'Live Call' : 'Dashboard'}
          </span>

          {/* Toggle switch */}
          <div
            role="radiogroup"
            aria-label="View mode"
            className="flex items-center rounded-full border border-border/60 bg-background/70 p-0.5"
          >
            <button
              type="button"
              role="radio"
              aria-checked={!isLiveCall}
              onClick={() => setIsLiveCall(false)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                !isLiveCall
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Dashboard
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={isLiveCall}
              onClick={() => setIsLiveCall(true)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isLiveCall
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Live
            </button>
          </div>
        </div>

        <div
          className="relative mt-5 overflow-hidden transition-[height] duration-[380ms] ease-out motion-reduce:transition-none"
          style={modeHeight !== undefined ? { height: modeHeight } : undefined}
        >
          {/* Dashboard Mode */}
          <div
            ref={dashboardModeRef}
            aria-hidden={isLiveCall}
            className={cn(
              'w-full transition-all duration-[380ms] ease-out motion-reduce:transition-none',
              isLiveCall
                ? 'pointer-events-none absolute inset-x-0 top-0 opacity-0 translate-y-2'
                : 'relative opacity-100 translate-y-0',
            )}
          >
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background p-3 transition-transform duration-200 hover:scale-[1.02] lg:order-1">
                <div className="text-xs text-muted-foreground">
                  Next call
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    2h 14m
                  </span>
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground">
                  Today at 2:30 PM · with <span className="text-primary">Ara</span>
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background p-3 transition-transform duration-200 hover:scale-[1.02] lg:order-3">
                <div className="text-xs text-muted-foreground">Mood</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    Calm
                  </span>
                  <span className="text-[10px] text-success">↑ Improving</span>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">Last 5:</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/50" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/50" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
              </div>

              <div className="col-span-2 rounded-2xl border border-border/60 bg-background p-3 lg:col-span-1 lg:order-2">
                <div className="text-xs text-muted-foreground">Actions</div>
                <div className="mt-1.5 flex flex-row gap-1.5 lg:flex-col lg:gap-1">
                  <button type="button" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary lg:justify-start">
                    <CalendarIcon className="h-2.5 w-2.5" />
                    Schedule call
                  </button>
                  <button type="button" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary lg:justify-start">
                    <PlusCircleIcon className="h-2.5 w-2.5" />
                    Create reminder
                  </button>
                  <button type="button" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary lg:justify-start">
                    <PhoneIcon className="h-2.5 w-2.5" />
                    Place call
                  </button>
                </div>
              </div>
            </div>

            {/* Tab bar */}
            <div className="mt-5">
              <div
                role="tablist"
                aria-label="Dashboard tabs"
                className="relative grid grid-cols-4 rounded-xl bg-background/70 p-1"
              >
                {TABS.map((tab, i) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === i}
                    aria-controls={`hero-panel-${tab.id}`}
                    id={`hero-tab-${tab.id}`}
                    onClick={() => handleTabClick(i)}
                    className={cn(
                      'relative z-10 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors duration-200',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      'hover:bg-primary/5',
                      activeTab === i
                        ? 'text-primary'
                        : 'text-muted-foreground',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}

                {/* Sliding underline */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-1/4 bg-primary transition-transform duration-200"
                  style={{
                    transform: `translateX(${activeTab * 100}%)`,
                  }}
                />
              </div>
            </div>

            {/* Tab content */}
            <div
              ref={contentRef}
              className="mt-4 overflow-hidden transition-[height] duration-300 ease-in-out"
              style={contentHeight !== undefined ? { height: contentHeight } : undefined}
              onMouseEnter={() => setIsAutoPlaying(false)}
              onMouseLeave={() => setIsAutoPlaying(true)}
            >
              <div
                className="flex items-start transition-transform duration-300 ease-in-out"
                style={{
                  transform: `translateX(-${activeTab * 100}%)`,
                }}
              >
                {/* Activity Panel */}
                <div
                  ref={(el) => { panelRefs.current[0] = el; }}
                  role="tabpanel"
                  id="hero-panel-activity"
                  aria-labelledby="hero-tab-activity"
                  aria-hidden={activeTab !== 0}
                  className="w-full shrink-0 space-y-3"
                >
                  <div className="rounded-2xl border border-border/60 bg-background">
                    {ACTIVITY_ENTRIES.map((entry, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex items-center justify-between px-4 py-3',
                          i !== ACTIVITY_ENTRIES.length - 1 &&
                            'border-b border-border/40',
                        )}
                      >
                        <span className="text-xs font-medium text-foreground">
                          {entry.name}
                        </span>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                            {entry.time}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-medium text-foreground">
                            {entry.duration}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Upcoming Reminders */}
                  <div className="rounded-2xl border border-border/60 bg-background p-3">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Upcoming Reminders
                    </div>
                    {UPCOMING_REMINDERS.map((r, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex items-center justify-between py-1.5',
                          i !== UPCOMING_REMINDERS.length - 1 &&
                            'border-b border-border/30',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <ClockIcon className="h-3 w-3 text-primary" />
                          <span className="text-xs text-foreground">
                            {r.label}
                          </span>
                        </div>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {r.time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Insights Panel */}
                <div
                  ref={(el) => { panelRefs.current[1] = el; }}
                  role="tabpanel"
                  id="hero-panel-insights"
                  aria-labelledby="hero-tab-insights"
                  aria-hidden={activeTab !== 1}
                  className="w-full shrink-0"
                >
                  <div className="space-y-4">
                    {/* Mood color bar */}
                    <div>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        <span className="text-xs text-muted-foreground">
                          Weekly mood
                        </span>
                      </div>
                      <div className="flex h-3 overflow-hidden rounded-full">
                        {MOOD_SEGMENTS.map((seg, i) => (
                          <div key={i} className={cn('flex-1', seg.color)} />
                        ))}
                      </div>
                    </div>

                    {/* Bar chart */}
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <ClockIcon className="h-3 w-3 text-primary" />
                        Call duration
                      </div>
                      <div className="flex items-end gap-1.5">
                        {WEEKLY_BARS.map((bar, i) => {
                          const h = (bar.value / MAX_BAR) * BAR_HEIGHT;
                          const isTallest = bar.value === MAX_BAR;
                          return (
                            <div
                              key={i}
                              className="flex flex-1 flex-col items-center gap-1"
                            >
                              <span className="text-[9px] tabular-nums text-muted-foreground">
                                {bar.value}
                              </span>
                              <div
                                className={cn(
                                  'w-full rounded-sm',
                                  isTallest
                                    ? 'bg-primary'
                                    : 'bg-primary/40',
                                )}
                                style={{ height: h }}
                              />
                              <span className="text-[9px] text-muted-foreground">
                                {bar.day}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Memory Panel */}
                <div
                  ref={(el) => { panelRefs.current[2] = el; }}
                  role="tabpanel"
                  id="hero-panel-memory"
                  aria-labelledby="hero-tab-memory"
                  aria-hidden={activeTab !== 2}
                  className="w-full shrink-0"
                >
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <SparklesIcon className="h-4 w-4 text-primary" />
                      Recent Memories
                    </div>
                    {MEMORY_ENTRIES.map((entry, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex items-center justify-between py-2',
                          i !== MEMORY_ENTRIES.length - 1 &&
                            'border-b border-primary/10',
                        )}
                      >
                        <span className="text-xs text-foreground">
                          {entry.text}
                        </span>
                        <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
                          {entry.time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Safety Panel */}
                <div
                  ref={(el) => { panelRefs.current[3] = el; }}
                  role="tabpanel"
                  id="hero-panel-safety"
                  aria-labelledby="hero-tab-safety"
                  aria-hidden={activeTab !== 3}
                  className="w-full shrink-0"
                >
                  <div className="space-y-3">
                    {/* Distress Detection */}
                    <div className="rounded-2xl border border-border/60 bg-background p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Distress Detection
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Active
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheckIcon className="h-4 w-4 text-success" />
                        <span className="text-xs font-medium text-foreground">
                          Wellness Check
                        </span>
                      </div>
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                        Healthy
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-foreground">
                          Trusted Contacts
                        </span>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        2 Verified
                      </span>
                    </div>

                    {/* Wellness Alerts */}
                    <div className="rounded-2xl border border-border/60 bg-background p-3">
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Wellness Alerts
                      </div>
                      {WELLNESS_ALERTS.map((alert, i) => (
                        <div
                          key={i}
                          className={cn(
                            'flex items-center justify-between py-1.5',
                            i !== WELLNESS_ALERTS.length - 1 &&
                              'border-b border-border/30',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {alert.severity === 'warning' ? (
                              <ExclamationTriangleIcon className="h-3 w-3 text-amber-500" />
                            ) : (
                              <BellAlertIcon className="h-3 w-3 text-primary" />
                            )}
                            <span className="text-xs text-foreground">
                              {alert.title}
                            </span>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                              alert.severity === 'warning'
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-primary/10 text-primary',
                            )}
                          >
                            {alert.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Call Mode */}
          <div
            ref={liveModeRef}
            aria-hidden={!isLiveCall}
            className={cn(
              'w-full transition-all duration-[380ms] ease-out motion-reduce:transition-none',
              isLiveCall
                ? 'relative opacity-100 translate-y-0'
                : 'pointer-events-none absolute inset-x-0 top-0 opacity-0 -translate-y-2',
            )}
          >
            {/* Avatar + waveform */}
            <div className="w-full py-1">
              <div className="w-full flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logos/logo.svg"
                    alt="Ultaura"
                    className="h-9 w-9 brightness-0 invert"
                  />
                </div>

                {/* Waveform */}
                <div className="mt-4 flex items-center justify-center gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <span
                      key={i}
                      className="w-1.5 rounded-full bg-primary animate-waveform"
                      style={{
                        animationDelay: `${i * 0.12}s`,
                      }}
                    />
                  ))}
                </div>

                {/* Voice badge */}
                <div className="mt-3 text-center text-xs text-muted-foreground">
                  Voice:{' '}
                  <span className="font-semibold text-foreground">Ara</span>{' '}
                  (Warm, Friendly)
                </div>
              </div>
            </div>

            {/* Chat transcript */}
            <div
              aria-live="polite"
              className="mt-4 w-full min-h-[120px] space-y-2 rounded-2xl border border-border/60 bg-background p-4"
            >
              {CHAT_MESSAGES.map((msg, i) => {
                if (i >= visibleMessages) return null;
                const isAra = msg.sender === 'ara';
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex animate-fade-in-up',
                      isAra ? 'justify-start' : 'justify-end',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-3 py-2 text-xs',
                        isAra
                          ? 'bg-primary/10 text-foreground'
                          : 'bg-primary text-primary-foreground',
                      )}
                    >
                      {isAra && (
                        <span className="mb-0.5 block text-[10px] font-semibold text-primary">
                          Ara
                        </span>
                      )}
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              {visibleMessages < CHAT_MESSAGES.length && (() => {
                const nextIsAra = CHAT_MESSAGES[visibleMessages]?.sender === 'ara';
                return (
                  <div className={cn('flex', nextIsAra ? 'justify-start' : 'justify-end')}>
                    <div className={cn(
                      'flex items-center gap-1 rounded-2xl px-3 py-2',
                      nextIsAra ? 'bg-primary/10' : 'bg-primary',
                    )}>
                      <span className={cn('h-1.5 w-1.5 animate-pulse rounded-full', nextIsAra ? 'bg-primary' : 'bg-primary-foreground')} />
                      <span className={cn('h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:0.2s]', nextIsAra ? 'bg-primary' : 'bg-primary-foreground')} />
                      <span className={cn('h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:0.4s]', nextIsAra ? 'bg-primary' : 'bg-primary-foreground')} />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
