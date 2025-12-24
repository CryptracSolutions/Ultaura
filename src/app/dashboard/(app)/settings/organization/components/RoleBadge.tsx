import Trans from '~/core/ui/Trans';
import { cva } from 'cva';

import MembershipRole from '~/lib/organizations/types/membership-role';
import Badge from '~/core/ui/Badge';
import roles from '~/lib/organizations/roles';

const roleClassNameBuilder = cva('font-medium', {
  variants: {
    role: {
      [MembershipRole.Owner]: 'bg-warning/20 text-warning',
      [MembershipRole.Admin]: 'bg-info/10 text-info',
      [MembershipRole.Member]: 'bg-info/10 text-info',
    },
  },
});

const RoleBadge: React.FCC<{
  role: MembershipRole;
}> = ({ role }) => {
  const data = roles.find((item) => item.value === role);
  const className = roleClassNameBuilder({ role });

  return (
    <Badge color={'custom'} size={'small'} className={className}>
      <span data-cy={'member-role-badge'}>
        <Trans i18nKey={data?.label} />
      </span>
    </Badge>
  );
};

export default RoleBadge;
