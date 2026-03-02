'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useMutation from 'swr/mutation';
import Alert from '~/core/ui/Alert';
import Trans from '~/core/ui/Trans';
import Spinner from '~/core/ui/Spinner';
import Heading from '~/core/ui/Heading';
import { CheckCircle } from 'lucide-react';
import type { GrokVoice } from '~/lib/ultaura/voices';

import useApiRequest from '~/core/hooks/use-api';
import configuration from '~/configuration';

interface CompleteOnboardingStepData {
  userType: 'self' | 'family_managed' | null;
  organization: string;
  selectedPlanId: string;
  invites: Array<{
    email: string;
    role: number;
  }>;
  selfPhoneE164: string;
  selfTimezone: string;
  selfBirthday: { month: number; day: number } | null;
  selfBirthYear: number | null;
  selfGender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | null;
  lovedOneName: string;
  lovedOnePhoneE164: string;
  lovedOneTimezone: string;
  lovedOneBirthYear: number | null;
  lovedOneGender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | null;
  preferredGrokVoice: GrokVoice;
}

const CompleteOnboardingStep: React.FC<{
  data: CompleteOnboardingStepData;
}> = ({ data }) => {
  const mutation = useOnboardingMutation();
  const submitted = useRef(false);
  const { trigger, data: response, error } = mutation;

  // we make a request to the server to complete the onboarding process
  // as soon as the component is mounted.
  useEffect(() => {
    if (!submitted.current) {
      void trigger(data);
      submitted.current = true;
    }
  }, [data, trigger]);

  if (error) {
    return <ErrorState />;
  }

  if (response && response.success) {
    return <SuccessState returnUrl={response.returnUrl} />;
  }

  return (
    <div
      className={
        'flex flex-1 flex-col items-center space-y-8 zoom-in-90 animate-in fade-in ease-out' +
        ' duration-1000 slide-in-from-bottom-8'
      }
    >
      <span>
        <Spinner className={'h-12 w-12'} />
      </span>

      <span>
        <Trans i18nKey={'onboarding:settingAccount'} />
      </span>
    </div>
  );
};

export default CompleteOnboardingStep;

function ErrorState() {
  return (
    <Alert type={'error'}>
      <Alert.Heading>
        <Trans i18nKey={'onboarding:errorAlertHeading'} />
      </Alert.Heading>

      <Trans i18nKey={'common:genericError'} />
    </Alert>
  );
}

function SuccessState(props: { returnUrl: string }) {
  const href = props.returnUrl || configuration.paths.appHome;
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(href);
    }, 2000);

    return () => clearTimeout(timer);
  }, [href, router]);

  return (
    <section
      className={
        'mx-auto rounded-xl lg:p-16 fade-in' +
        ' bg-background animate-in slide-in-from-bottom-16' +
        ' zoom-in-95 duration-1000 ease-out'
      }
    >
      <div
        className={
          'flex flex-col space-y-6 items-center justify-center text-center'
        }
      >
        <CheckCircle className="h-12 w-12 text-primary" />

        <Heading type={3}>
          <span className={'font-semibold'}>
            <Trans i18nKey={'onboarding:successStepHeading'} />
          </span>
        </Heading>
      </div>
    </section>
  );
}

function useOnboardingMutation() {
  const fetcher = useApiRequest<
    {
      success: boolean;
      returnUrl: string;
    },
    CompleteOnboardingStepData
  >();

  const mutationFn = async (
    _: string[],
    { arg }: { arg: CompleteOnboardingStepData },
  ) => {
    return fetcher({
      method: 'POST',
      path: '/onboarding/complete',
      body: arg,
    });
  };

  return useMutation(['complete-onboarding'], mutationFn);
}
