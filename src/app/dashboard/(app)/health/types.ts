import type {
  HealthTabValue,
  HealthCondition,
  HealthMedication,
  HealthObservation,
  HealthDocument,
} from '@ultaura/types';

export type { HealthTabValue };

export type HealthViewMode = 'list' | 'detail';

export type HealthFilterState = {
  tab: HealthTabValue;
  lineId: string | null;
};

export type HealthInitialTabData =
  | {
      tab: 'conditions';
      lineId: string;
      conditions: HealthCondition[];
    }
  | {
      tab: 'medications';
      lineId: string;
      medications: HealthMedication[];
    }
  | {
      tab: 'observations';
      lineId: string;
      observations: HealthObservation[];
    }
  | {
      tab: 'documents';
      lineId: string;
      documents: HealthDocument[];
    };
