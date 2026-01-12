export type TopicType = 'memory_follow_up' | 'web_search' | 'segment' | 'free_form';
export type SegmentType = 'trivia' | 'story' | 'learning' | 'memory_lane';
export type PreviewStatus = 'pending' | 'used' | 'declined' | 'expired';
export type SeniorResponse = 'enjoyed' | 'neutral' | 'declined' | 'interrupted';
export type StoryType = 'serial' | 'learning_journey';
export type StoryStatus = 'active' | 'completed' | 'abandoned';

export interface CallPreview {
  id: string;
  lineId: string;
  accountId: string;
  createdAt: string;
  topicType: TopicType;
  topicKey: string;
  topicDisplay: string;
  sourceMemoryIds?: string[];
  segmentType?: SegmentType;
  segmentContext?: Record<string, unknown>;
  offeredAt: string;
  selectedAt?: string;
  usedAt?: string;
  status: PreviewStatus;
  followedThrough?: boolean;
  followThroughResponse?: 'engaged' | 'declined' | 'redirected';
}

export interface SegmentEngagement {
  id: string;
  lineId: string;
  accountId: string;
  callSessionId: string;
  createdAt: string;
  segmentType: SegmentType;
  segmentDomain?: string;
  segmentContext?: Record<string, unknown>;
  durationSeconds?: number;
  completed: boolean;
  engagementSignals?: Record<string, unknown>;
  seniorResponse?: SeniorResponse;
}

export interface StoryArc {
  id: string;
  lineId: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
  storyType: StoryType;
  title: string;
  description?: string;
  totalChapters: number;
  currentChapter: number;
  lastChapterAt?: string;
  storyState: Record<string, unknown>;
  status: StoryStatus;
}

export interface RetentionMetrics {
  callPreviewFollowThrough: number;
  segmentCompletionRate: number;
  preferredSegmentType: SegmentType | null;
  averageSegmentDuration: number;
  inboundCallCount: number;
  featureEnrollment: {
    callPreview: boolean;
    segments: boolean;
    stories: boolean;
  };
}

export interface SegmentStats {
  totalSegments: number;
  byType: Record<SegmentType, {
    count: number;
    enjoymentRate: number;
    avgDuration: number;
  }>;
  preferredDomains: string[];
  recentEngagement: SegmentEngagement[];
}

export interface RetentionInsights {
  retentionFeatures: {
    callPreviewEnabled: boolean;
    segmentsEnabled: boolean;
    favoriteSegments: string[];
    activeStoryArcs: Array<{
      id: string;
      title: string;
      progress: number;
    }>;
  };
  engagementMetrics: {
    callPreviewFollowThrough: number;
    segmentCompletionRate: number;
    preferredSegmentType: SegmentType | null;
    averageSegmentDuration: number;
  };
  inboundMetrics: {
    inboundCallCount: number;
    inboundCallTrend: 'increasing' | 'stable' | 'decreasing';
  };
}
