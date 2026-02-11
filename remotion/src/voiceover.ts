import { theme } from "./theme";

export const voiceoverScript = [
  {
    id: "hook",
    start: 0,
    duration: theme.sections.hook.duration,
    text: "Meet Ultaura — a daily voice companion for seniors.",
  },
  {
    id: "senior",
    start: theme.sections.hook.duration,
    duration: theme.sections.seniorView.duration,
    text: "It calls on schedule for friendly check-ins.",
  },
  {
    id: "reminders",
    start: theme.sections.hook.duration + theme.sections.seniorView.duration,
    duration: theme.sections.reminders.duration,
    text: "And reminders that feel human.",
  },
  {
    id: "family",
    start:
      theme.sections.hook.duration +
      theme.sections.seniorView.duration +
      theme.sections.reminders.duration,
    duration: theme.sections.familyView.duration,
    text: "For families, you get clarity at a glance.",
  },
  {
    id: "insights",
    start:
      theme.sections.hook.duration +
      theme.sections.seniorView.duration +
      theme.sections.reminders.duration +
      theme.sections.familyView.duration,
    duration: theme.sections.insights.duration,
    text: "Insights, trends, and weekly summaries.",
  },
  {
    id: "peace",
    start:
      theme.sections.hook.duration +
      theme.sections.seniorView.duration +
      theme.sections.reminders.duration +
      theme.sections.familyView.duration +
      theme.sections.insights.duration,
    duration: theme.sections.peace.duration,
    text: "Peace of mind, without being intrusive.",
  },
  {
    id: "cta",
    start:
      theme.sections.hook.duration +
      theme.sections.seniorView.duration +
      theme.sections.reminders.duration +
      theme.sections.familyView.duration +
      theme.sections.insights.duration +
      theme.sections.peace.duration,
    duration: theme.sections.cta.duration,
    text: "Start your free 14 day trial.",
  },
];

export type VoiceoverSegment = (typeof voiceoverScript)[number];
