import type { NavigationContext } from '~/navigation.config';
import createNavigationConfig from '~/navigation.config';

export type NavigationSearchItem = {
  id: string;
  label: string;
  href: string;
  keywords: string[];
  Icon?: (props: { className: string }) => JSX.Element;
};

export function getNavigationItems(
  context?: NavigationContext
): NavigationSearchItem[] {
  const config = createNavigationConfig(context);
  const items: NavigationSearchItem[] = [];

  config.items.forEach((item) => {
    if ('divider' in item) {
      return;
    }

    if ('children' in item) {
      item.children.forEach((child) => {
        items.push(
          buildItem(`${child.path}`, child.label, child.path, child.Icon)
        );
      });

      return;
    }

    items.push(buildItem(`${item.path}`, item.label, item.path, item.Icon));
  });

  return items;
}

function buildItem(
  id: string,
  label: string,
  href: string,
  Icon?: (props: { className: string }) => JSX.Element
): NavigationSearchItem {
  const keywords = [label];

  href
    .split('/')
    .filter(Boolean)
    .forEach((segment) => {
      keywords.push(segment.replace(/-/g, ' '));
    });

  return {
    id,
    label,
    href,
    keywords,
    Icon,
  };
}
