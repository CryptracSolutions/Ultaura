export type TopicCode =
  | 'family'
  | 'friends'
  | 'activities'
  | 'interests'
  | 'memories'
  | 'plans'
  | 'daily_life'
  | 'entertainment'
  | 'feelings'
  | 'requests';

export type ConcernCode =
  | 'loneliness'
  | 'sadness'
  | 'anxiety'
  | 'sleep'
  | 'pain'
  | 'fatigue'
  | 'appetite';

export type FollowUpReasonCode =
  | ConcernCode
  | 'wants_more_contact'
  | 'missed_routine';

export interface CallInsightTopic {
  code: TopicCode;
  weight: number;
}

export interface CallInsightConcern {
  code: ConcernCode;
  severity: number;
  confidence: number;
  is_novel: boolean;
}

export interface CallInsights {
  mood_overall: 'positive' | 'neutral' | 'low';
  mood_intensity: number;
  engagement_score: number;
  social_need_level: number;
  topics: CallInsightTopic[];
  private_topics: TopicCode[];
  concerns: CallInsightConcern[];
  needs_follow_up: boolean;
  follow_up_reasons: FollowUpReasonCode[];
  confidence_overall: number;
}
