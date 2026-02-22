import { PageHeader } from '~/core/ui/Page';

function AdminHeader({
  children,
  description,
}: React.PropsWithChildren<{ description?: string | React.ReactNode }>) {
  return (
    <PageHeader title={children} description={description} showDescriptionOnMobile />
  );
}

export default AdminHeader;
