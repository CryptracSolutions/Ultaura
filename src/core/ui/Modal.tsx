'use client';

import { Close as DialogPrimitiveClose } from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import classNames from 'clsx';

import Button from '~/core/ui/Button';
import If from '~/core/ui/If';
import Trans from '~/core/ui/Trans';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '~/core/ui/Dialog';

type ControlledOpenProps = {
  isOpen?: boolean;
  setIsOpen?: (isOpen: boolean) => unknown;
};

type TriggerProps = {
  Trigger?: React.ReactNode;
};

type Props = React.PropsWithChildren<
  {
    heading: string | React.ReactNode;
    description?: string | React.ReactNode;
    closeButton?: boolean;
  } & (ControlledOpenProps & TriggerProps)
>;

const Modal: React.FC<Props> & {
  CancelButton: typeof CancelButton;
} = ({ closeButton, heading, description, children, ...props }) => {
  const isControlled = 'isOpen' in props;
  const useCloseButton = closeButton ?? true;

  return (
    <Dialog open={props.isOpen} onOpenChange={props.setIsOpen}>
      <If condition={props.Trigger}>
        <DialogTrigger asChild>{props.Trigger}</DialogTrigger>
      </If>

      <DialogContent
        className="max-h-[85vh] overflow-y-auto"
        overlayClassName="bg-black/50 backdrop-blur-none"
      >
        <div className="flex flex-col space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate text-xl font-semibold text-current">
                {heading}
              </DialogTitle>
              <If condition={description}>
                <DialogDescription className="text-sm text-muted-foreground">
                  {description}
                </DialogDescription>
              </If>
            </div>

            <If condition={useCloseButton}>
              <DialogPrimitiveClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close"
                  onClick={() => {
                    if (isControlled && props.setIsOpen) {
                      props.setIsOpen(false);
                    }
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </DialogPrimitiveClose>
            </If>
          </div>

          <div className="relative">{children}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Modal;

function CancelButton<Props extends React.ButtonHTMLAttributes<unknown>>(
  props: Props,
) {
  const { className, ...rest } = props;

  return (
    <Button
      variant="outline"
      data-cy={'close-modal-button'}
      className={className}
      {...rest}
    >
      <Trans i18nKey={'common:cancel'} />
    </Button>
  );
}

Modal.CancelButton = CancelButton;

export { CancelButton };
