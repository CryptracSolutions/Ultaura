'use client';

import { createContext, createElement, useContext } from 'react';
import type { PropsWithChildren } from 'react';

export interface ViewerContextValue {
  isViewer: boolean;
  accountHolderName: string | null;
  seniorName: string | null;
  assignedLineIds: string[];
}

const ViewerContext = createContext<ViewerContextValue>({
  isViewer: false,
  accountHolderName: null,
  seniorName: null,
  assignedLineIds: [],
});

export function ViewerProvider(props: PropsWithChildren<ViewerContextValue>) {
  const { children, ...value } = props;

  return createElement(ViewerContext.Provider, { value }, children);
}

export function useViewerContext(): ViewerContextValue {
  return useContext(ViewerContext);
}

export function useIsViewer(): boolean {
  return useViewerContext().isViewer;
}
