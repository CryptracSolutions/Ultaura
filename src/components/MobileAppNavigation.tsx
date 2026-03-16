'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import classNames from 'clsx';

import {
  XMarkIcon,
  QuestionMarkCircleIcon,
  ChatBubbleLeftIcon,
  PlusIcon,
  PhoneIcon,
  BellIcon,
  PhoneArrowUpRightIcon,
  CalendarIcon,
  LifebuoyIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { Lock } from 'lucide-react';

import Trans from '~/core/ui/Trans';

import NAVIGATION_CONFIG from '../navigation.config';
import useCurrentOrganization from '~/lib/organizations/hooks/use-current-organization';
import useUltauraAccount from '~/lib/ultaura/hooks/use-ultaura-account';
import { useManualCall } from '~/lib/contexts/ManualCallContext';
import { useAddReminder } from '~/lib/contexts/AddReminderContext';
import { useAddSchedule } from '~/lib/contexts/AddScheduleContext';
import { useAddLine } from '~/lib/contexts/AddLineContext';

import { useHelpPanel } from '~/lib/contexts/HelpPanelContext';
import { MobileFeedbackModal } from '~/components/MobileFeedbackModal';
import Logo from '~/core/ui/Logo';
import { useSearch } from '~/lib/contexts/SearchContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/core/ui/Dialog';
import useUserSession from '~/core/hooks/use-user-session';
import { useIsViewer } from '~/lib/contexts/viewer';
import { useHealthFeatureEnabled } from '~/lib/contexts/health-feature-flag';
import AccountSwitcher from '~/app/dashboard/(app)/components/AccountSwitcher';

type OrganizationRoleEntry = {
  organization: {
    id: number;
    uuid: string;
    name: string;
  };
  role: number;
};

const MobileAppNavigation: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  allOrganizations: OrganizationRoleEntry[];
  userId: string;
}> = ({ isOpen, onOpenChange, allOrganizations, userId }) => {
  const currentOrganization = useCurrentOrganization();
  const { data: ultauraAccount } = useUltauraAccount();
  const userSession = useUserSession();
  const isViewer = useIsViewer();
  const { openManualCall } = useManualCall();
  const { openAddReminder } = useAddReminder();
  const { openAddSchedule } = useAddSchedule();
  const { openAddLine } = useAddLine();
  const { open: openHelp } = useHelpPanel();
  const { openMobile, isMobileOpen } = useSearch();
  const [isVisible, setIsVisible] = useState(false);
  const [animationState, setAnimationState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  const closeMenu = useCallback(() => {
    setAnimationState('closing');
    setTimeout(() => {
      setIsVisible(false);
      setAnimationState('closed');
      onOpenChange(false);
    }, 300);
  }, [onOpenChange]);

  // React to external open trigger
  useEffect(() => {
    if (isOpen && animationState === 'closed') {
      setIsVisible(true);
      setAnimationState('opening');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimationState('open');
        });
      });
    } else if (!isOpen && (animationState === 'open' || animationState === 'opening')) {
      closeMenu();
    }
  }, [isOpen, animationState, closeMenu]);

  if (!currentOrganization?.uuid) {
    return null;
  }

  const handleHelpClick = () => {
    openHelp();
  };

  const handleFeedbackClick = () => {
    closeMenu();
    setTimeout(() => setFeedbackOpen(true), 200);
  };

  const handleQuickAction = (action: () => void) => {
    setQuickActionsOpen(false);
    closeMenu();
    setTimeout(() => action(), 200);
  };

  // Extract navigation items and settings from config
  const userType =
    ultauraAccount?.user_type === 'self' || ultauraAccount?.user_type === 'family_managed'
      ? ultauraAccount.user_type
      : undefined;
  const healthFeatureEnabled = useHealthFeatureEnabled();
  const mobileUserId = userSession?.auth?.user?.id;
  const HEALTH_ELIGIBLE_PLANS = ['comfort', 'family', 'payg'];

  const navConfig = NAVIGATION_CONFIG(
    ultauraAccount
      ? {
          userType,
          accountId: ultauraAccount.id,
          role: userSession?.role == null ? undefined : Number(userSession.role),
          isHealthOwner:
            !!mobileUserId &&
            !!ultauraAccount.created_by_user_id &&
            mobileUserId === ultauraAccount.created_by_user_id,
          healthFeatureEnabled,
          isHealthEligible:
            HEALTH_ELIGIBLE_PLANS.includes(ultauraAccount.plan_id ?? '') &&
            ultauraAccount.status !== 'trial',
          pendingSuggestionCount: 0,
        }
      : undefined
  );
  const navGroups = navConfig.items.filter(
    (item) => 'children' in item
  ) as Array<{ label: string; children: Array<{ path: string; label: string; Icon: React.ElementType; hidden?: boolean; locked?: boolean }> }>;

  return (
    <>
      {/* Full Screen Menu */}
      {isVisible && (
        <div
          className={classNames(
            'fixed inset-0 z-50 bg-sidebar transition-transform duration-300 ease-out',
            {
              'translate-x-0': animationState === 'open',
              '-translate-x-full': animationState === 'opening' || animationState === 'closing',
            }
          )}
        >
          {/* Header with Close Button */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <Logo
              href="/"
              className="h-10"
              label="Home"
              showWordmark
              wordmarkClassName="text-2xl font-semibold leading-none text-primary"
            />
            <div className="flex items-center gap-2">
              {!isViewer ? (
                <button
                  onClick={() => setQuickActionsOpen(true)}
                  className="p-2 hover:bg-muted rounded-md transition-colors"
                  aria-label="Quick Actions"
                >
                  <PlusIcon className="h-6 w-6 text-primary" />
                </button>
              ) : null}
              <button
                onClick={openMobile}
                className="p-2 hover:bg-muted rounded-md transition-colors"
                aria-label="Search"
                aria-haspopup="dialog"
                aria-expanded={isMobileOpen}
              >
                <MagnifyingGlassIcon className="h-6 w-6" />
              </button>
              <button
                onClick={closeMenu}
                className="p-2 hover:bg-muted rounded-md transition-colors"
                aria-label="Close menu"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Menu Content */}
          <div className="overflow-y-auto h-[calc(100dvh-57px)]">
            {allOrganizations.length > 1 ? (
              <div className="px-4 py-3 border-b border-border/60">
                <AccountSwitcher
                  organizations={allOrganizations}
                  currentOrganizationUuid={currentOrganization?.uuid}
                  userId={userId}
                />
              </div>
            ) : null}

            {/* Navigation Groups (includes Account with Usage/Privacy from navConfig) */}
            {navGroups.map((group) => (
              <MenuSection key={group.label} label={group.label}>
                {group.children.map((child) => {
                  if (child.hidden) {
                    return null;
                  }

                  if (child.locked) {
                    return (
                      <MenuLockedItem
                        key={child.path}
                        Icon={child.Icon}
                        label={child.label}
                      />
                    );
                  }

                  return (
                    <MenuLink
                      key={child.path}
                      Icon={child.Icon}
                      path={child.path}
                      label={child.label}
                      onClick={closeMenu}
                    />
                  );
                })}
              </MenuSection>
            ))}

            {/* Support Section */}
            <MenuSection label="Support">
              <MenuButton
                Icon={LifebuoyIcon}
                label="Help"
                onClick={handleHelpClick}
              />
              <MenuLink
                Icon={QuestionMarkCircleIcon}
                path="/docs"
                label="Documentation"
                onClick={closeMenu}
              />
              <MenuButton
                Icon={ChatBubbleLeftIcon}
                label="Feedback"
                onClick={handleFeedbackClick}
              />
            </MenuSection>
          </div>
        </div>
      )}

      <MobileFeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />

      {!isViewer ? (
        <Dialog open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
          <DialogContent className="z-[60] p-0" overlayClassName="z-[60]" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader className="px-5 pt-5 pb-2">
              <DialogTitle className="text-base font-semibold">
                Quick Actions
              </DialogTitle>
            </DialogHeader>
            <div className="pb-2">
              <MenuButton
                Icon={BellIcon}
                label="Set Reminder"
                onClick={() => handleQuickAction(openAddReminder)}
              />
              <MenuButton
                Icon={CalendarIcon}
                label="Schedule Call"
                onClick={() => handleQuickAction(openAddSchedule)}
              />
              {userType === 'family_managed' && (
                <MenuButton
                  Icon={PhoneArrowUpRightIcon}
                  label="Place Call"
                  onClick={() => handleQuickAction(openManualCall)}
                />
              )}
              <MenuButton
                Icon={PhoneIcon}
                label="Add Line"
                onClick={() => handleQuickAction(openAddLine)}
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
};

export default MobileAppNavigation;

function MenuLink({
  path,
  label,
  Icon,
  onClick,
}: {
  path: string;
  label: string;
  Icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <Link
      href={path}
      onClick={onClick}
      className="flex w-full items-center space-x-4 h-14 px-4 hover:bg-muted transition-colors touch-manipulation"
    >
      <Icon className="h-6 w-6 text-primary" />
      <span className="text-foreground">
        <Trans i18nKey={label} defaults={label} />
      </span>
    </Link>
  );
}

function MenuButton({
  label,
  Icon,
  onClick,
}: {
  label: string;
  Icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center space-x-4 h-14 px-4 hover:bg-muted transition-colors touch-manipulation"
    >
      <Icon className="h-6 w-6 text-primary" />
      <span className="text-foreground">{label}</span>
    </button>
  );
}

function MenuLockedItem({
  label,
  Icon,
}: {
  label: string;
  Icon: React.ElementType;
}) {
  return (
    <div className="flex w-full items-center space-x-4 h-14 px-4 opacity-50 cursor-not-allowed">
      <Icon className="h-6 w-6 text-muted-foreground" />
      <span className="flex flex-1 items-center justify-between text-muted-foreground">
        <Trans i18nKey={label} defaults={label} />
        <Lock className="h-4 w-4" />
      </span>
    </div>
  );
}

function MenuSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}
