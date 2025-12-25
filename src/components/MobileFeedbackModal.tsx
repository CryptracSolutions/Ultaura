'use client';

import { useState } from 'react';
import { useFormStatus, useFormState } from 'react-dom';
import classNames from 'clsx';

import {
  XMarkIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

import { submitFeedbackAction } from '~/plugins/feedback-popup/lib/feedback-actions';

import Button from '~/core/ui/Button';
import Textarea from '~/core/ui/Textarea';
import If from '~/core/ui/If';
import TextField, { TextFieldHint, TextFieldInput } from '~/core/ui/TextField';

enum FeedbackType {
  Bug = 'bug',
  Question = 'question',
  Feedback = 'feedback',
}

interface MobileFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileFeedbackModal({ isOpen, onClose }: MobileFeedbackModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">Send Feedback</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-md transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <FormContainer onClose={onClose} />
        </div>
      </div>
    </div>
  );
}

function FormContainer({ onClose }: { onClose: () => void }) {
  const [status, formAction] = useFormState(submitFeedbackAction, {
    success: undefined,
  });

  const hasError = status.success !== undefined && !status.success;

  if (status.success) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <CheckCircleIcon className="h-16 text-green-500" />
        <span className="font-semibold text-lg">Thank you for your feedback!</span>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <ExclamationCircleIcon className="h-16 text-yellow-500" />
        <div className="text-center space-y-1">
          <span className="font-semibold text-lg block">Sorry, something went wrong!</span>
          <span className="text-sm text-muted-foreground">
            Please try again later or contact us directly.
          </span>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-4">
        <span className="font-semibold text-lg">Contact us about...</span>
        <FormFields />
      </div>

      <SubmitButtons onClose={onClose} />
      <DeviceInfo />
    </form>
  );
}

function FormFields() {
  const [checked, setChecked] = useState(FeedbackType.Feedback);
  const displayEmail = checked === FeedbackType.Question;

  return (
    <>
      <FeedbackTypeRadioGroup checked={checked} setChecked={setChecked} />

      <If condition={displayEmail}>
        <TextField>
          <TextFieldInput
            required
            name="email"
            type="email"
            placeholder="Type your Email here..."
          />
          <TextFieldHint>We will reply to your email address</TextFieldHint>
        </TextField>
      </If>

      <Textarea
        placeholder={getPlaceholder(checked)}
        name="text"
        required
        className="h-32 resize-none"
      />
    </>
  );
}

function FeedbackTypeRadioGroup({
  checked,
  setChecked,
}: {
  checked: FeedbackType;
  setChecked: (value: FeedbackType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <RadioItem
        checked={checked === FeedbackType.Feedback}
        name="type"
        value={FeedbackType.Feedback}
        className={
          'text-green-500' +
          ' aria-checked:dark:bg-green-500/10 aria-checked:bg-green-50/50' +
          ' dark:aria-checked:border-green-800'
        }
        onChange={setChecked}
      >
        Feedback
      </RadioItem>

      <RadioItem
        checked={checked === FeedbackType.Question}
        name="type"
        value={FeedbackType.Question}
        className={
          'text-blue-500 ' +
          ' aria-checked:dark:bg-blue-500/10 aria-checked:bg-blue-50/50' +
          ' dark:aria-checked:border-blue-800'
        }
        onChange={setChecked}
      >
        Question
      </RadioItem>

      <RadioItem
        checked={checked === FeedbackType.Bug}
        name="type"
        value={FeedbackType.Bug}
        className={
          'text-red-500 ' +
          ' aria-checked:dark:bg-red-500/10 aria-checked:bg-red-50/50' +
          ' dark:aria-checked:border-red-800'
        }
        onChange={setChecked}
      >
        Bug
      </RadioItem>
    </div>
  );
}

function RadioItem(
  props: React.PropsWithChildren<{
    name: string;
    value: FeedbackType;
    checked: boolean;
    className: string;
    onChange: (value: FeedbackType) => void;
  }>,
) {
  return (
    <label
      aria-checked={props.checked}
      className={classNames(
        'text-sm cursor-pointer items-center flex relative space-x-1.5 p-2 rounded-lg transition-colors border border-transparent',
        {
          'hover:bg-gray-50/50 dark:hover:bg-dark-900': !props.checked,
        },
        props.className,
      )}
    >
      <input
        checked={props.checked}
        name={props.name}
        type="radio"
        value={props.value}
        className="hidden"
        onChange={() => props.onChange(props.value)}
      />

      <div className="bg-current w-4 h-4 rounded-full flex items-center justify-center">
        <span
          className={classNames(
            'w-3.5 h-3.5 block rounded-full border-white border-2',
            {
              'bg-current animate-in zoom-in-75 fade-in': props.checked,
              'bg-white': !props.checked,
            },
          )}
        />
      </div>

      <span className="text-center font-medium text-foreground">
        {props.children}
      </span>
    </label>
  );
}

function SubmitButtons({ onClose }: { onClose: () => void }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex gap-3 pt-4">
      <Button
        disabled={pending}
        variant="outline"
        className="flex-1"
        onClick={onClose}
        type="button"
      >
        Cancel
      </Button>

      <Button loading={pending} className="flex-1" type="submit">
        {pending ? (
          'Sending...'
        ) : (
          <span className="flex space-x-1 items-center">
            <span>Send</span>
            <ChevronRightIcon className="h-4" />
          </span>
        )}
      </Button>
    </div>
  );
}

function DeviceInfo() {
  if (typeof window === 'undefined') return null;

  const { userAgent, language } = navigator;
  const width = window.innerWidth.toString();
  const height = window.innerHeight.toString();
  const screenName = document.title;
  const prefix = 'device_info';

  return (
    <>
      <input type="hidden" name="screen_name" value={screenName} />
      <input type="hidden" name={`${prefix}[user_agent]`} value={userAgent} />
      <input type="hidden" name={`${prefix}[language]`} value={language} />
      <input type="hidden" name={`${prefix}[screen_size][width]`} value={width} />
      <input type="hidden" name={`${prefix}[screen_size][height]`} value={height} />
    </>
  );
}

function getPlaceholder(checked: FeedbackType) {
  switch (checked) {
    case FeedbackType.Feedback:
      return 'What do you like or dislike? What can we do better?';
    case FeedbackType.Question:
      return 'Ask us anything';
    case FeedbackType.Bug:
      return 'What happened? What were you expecting to happen?';
  }
}
