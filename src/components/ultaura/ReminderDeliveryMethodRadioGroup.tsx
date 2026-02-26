'use client';

import { MessageSquare, Phone } from 'lucide-react';
import { RadioGroup, RadioGroupItem, RadioGroupItemLabel } from '~/core/ui/RadioGroup';
import type { ReminderDeliveryMethod } from '~/lib/ultaura/types';

interface ReminderDeliveryMethodRadioGroupProps {
  value: ReminderDeliveryMethod;
  onChange: (value: ReminderDeliveryMethod) => void;
  disabled?: boolean;
}

export function ReminderDeliveryMethodRadioGroup({
  value,
  onChange,
  disabled = false,
}: ReminderDeliveryMethodRadioGroupProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">Delivery Method</label>
      <RadioGroup
        value={value}
        onValueChange={(nextValue) => onChange(nextValue as ReminderDeliveryMethod)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        disabled={disabled}
      >
        <RadioGroupItemLabel className="min-h-11">
          <RadioGroupItem value="outbound_call" />
          <div className="flex items-start gap-2">
            <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">Call</p>
              <p className="text-xs text-muted-foreground">Ultaura calls to deliver the reminder</p>
            </div>
          </div>
        </RadioGroupItemLabel>

        <RadioGroupItemLabel className="min-h-11">
          <RadioGroupItem value="sms" />
          <div className="flex items-start gap-2">
            <MessageSquare className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">SMS</p>
              <p className="text-xs text-muted-foreground">Text message reminder</p>
            </div>
          </div>
        </RadioGroupItemLabel>
      </RadioGroup>
    </div>
  );
}
