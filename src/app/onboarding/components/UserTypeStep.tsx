'use client';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Trans from '~/core/ui/Trans';

export interface UserTypeStepData {
  userType: 'self' | 'family_managed';
}

const UserTypeStep: React.FCC<{
  onSubmit: (data: UserTypeStepData) => void;
}> = ({ onSubmit }) => {
  const { t } = useTranslation('onboarding');

  const handleSelect = useCallback(
    (userType: 'self' | 'family_managed') => {
      onSubmit({ userType });
    },
    [onSubmit]
  );

  return (
    <div className={'flex w-full flex-1 flex-col space-y-12'}>
      <div className={'flex flex-col space-y-2'}>
        <Heading type={1}>
          <Trans i18nKey={'onboarding:userTypeHeading'} />
        </Heading>

        <SubHeading>
          <span className={'text-base'}>
            <Trans i18nKey={'onboarding:userTypeDescription'} />
          </span>
        </SubHeading>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => handleSelect('self')}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 text-left transition-all hover:border-primary/50 hover:shadow-sm"
        >
          <div className="text-lg font-semibold text-foreground">
            {t('userTypeSelfTitle')}
          </div>
          <p className="text-sm text-muted-foreground">
            {t('userTypeSelfDescription')}
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleSelect('family_managed')}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 text-left transition-all hover:border-primary/50 hover:shadow-sm"
        >
          <div className="text-lg font-semibold text-foreground">
            {t('userTypeFamilyTitle')}
          </div>
          <p className="text-sm text-muted-foreground">
            {t('userTypeFamilyDescription')}
          </p>
        </button>
      </div>
    </div>
  );
};

export default UserTypeStep;
