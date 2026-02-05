import { Dialog, DialogContent } from '~/core/ui/Dialog';

function SideDialog(
  props: React.PropsWithChildren<{
    open: boolean;
    onOpenChange: (value: boolean) => void;
    modal?: boolean;
  }>,
) {
  return (
    <Dialog
      modal={props.modal}
      open={props.open}
      onOpenChange={props.onOpenChange}
    >
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={
          'h-screen fixed right-0 w-full xl:w-[50%] bg-background' +
          ' border z-50 shadow-2xl rounded-l-lg' +
          ' top-0 left-auto bottom-auto outline-none animate-in fade-in zoom-in-90' +
          ' slide-in-from-right-64 p-6 duration-800 overflow-y-auto' +
          ' translate-x-0 translate-y-0 max-w-none rounded-none sm:rounded-l-lg sm:rounded-t-none'
        }
      >
        {props.children}
      </DialogContent>
    </Dialog>
  );
}

export default SideDialog;
