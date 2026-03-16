'use client';

import { createContext, useContext } from 'react';

const HealthFeatureFlagContext = createContext<boolean>(false);

export function HealthFeatureFlagProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <HealthFeatureFlagContext.Provider value={enabled}>
      {children}
    </HealthFeatureFlagContext.Provider>
  );
}

export function useHealthFeatureEnabled(): boolean {
  return useContext(HealthFeatureFlagContext);
}
