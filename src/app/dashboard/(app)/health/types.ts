import type { HealthTabValue } from '@ultaura/types';

export type { HealthTabValue };

export type HealthViewMode = 'list' | 'detail';

export type HealthFilterState = {
  tab: HealthTabValue;
  lineId: string | null;
};
