'use client';

import { useCallback, useState } from 'react';

import configuration from '~/configuration';

import MultiFactorChallengeContainer from '~/app/auth/components/MultiFactorChallengeContainer';
import { Checkbox } from '~/core/ui/Checkbox';
import Trans from '~/core/ui/Trans';
import { setTrustedDeviceAction } from '~/lib/ultaura/trusted-device-actions';

function VerifyFormContainer() {
  const [trustDevice, setTrustDevice] = useState(false);

  const onSuccess = useCallback(() => {
    window.location.assign(configuration.paths.appHome);
  }, []);

  const onTrustDevice = useCallback(async (factorId: string) => {
    try {
      await setTrustedDeviceAction(factorId);
    } catch {
      // Trust device is best-effort -- don't block login if it fails
    }
  }, []);

  return (
    <div className="flex flex-col space-y-4">
      <MultiFactorChallengeContainer
        onSuccess={onSuccess}
        onTrustDevice={trustDevice ? onTrustDevice : undefined}
      />

      <div>
        <label
          htmlFor="trust-device"
          className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer"
        >
          <Checkbox
            checked={trustDevice}
            onCheckedChange={(checked) => setTrustDevice(checked === true)}
            id="trust-device"
          />
          <Trans i18nKey={'auth:trustDeviceLabel'} />
        </label>

        <p className="ml-6 mt-1 text-xs text-muted-foreground">
          <Trans i18nKey={'auth:trustDeviceDescription'} />
        </p>
      </div>
    </div>
  );
}

export default VerifyFormContainer;
