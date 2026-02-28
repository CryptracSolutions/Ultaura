export interface ActionResult {
  success: boolean;
  error?: string | { message?: string } | null;
}

export function assertActionSucceeded(
  result: ActionResult,
  fallbackMessage: string,
): void {
  if (result.success) {
    return;
  }

  const message =
    typeof result.error === 'string'
      ? result.error
      : result.error?.message || fallbackMessage;

  throw new Error(message);
}
