import { useMemo } from 'react';

import Heading from '~/core/ui/Heading';

import {
  ArrowDownIcon,
  ArrowUpIcon,
  Bars2Icon,
} from '@heroicons/react/24/outline';

const Tile: React.FCC & {
  Header: typeof TileHeader;
  Heading: typeof TileHeading;
  Body: typeof TileBody;
  Figure: typeof TileFigure;
  Trend: typeof TileTrend;
  Badge: typeof TileBadge;
} = ({ children }) => {
  return (
    <div
      className={
        'flex flex-col space-y-3 rounded-lg border border-border' +
        ' bg-background p-5'
      }
    >
      {children}
    </div>
  );
};

function TileHeader(props: React.PropsWithChildren) {
  return <div className={'flex'}>{props.children}</div>;
}

function TileHeading(props: React.PropsWithChildren) {
  return (
    <Heading type={6}>
      <span className={'font-normal text-muted-foreground'}>
        {props.children}
      </span>
    </Heading>
  );
}

function TileBody(props: React.PropsWithChildren) {
  return <div className={'flex flex-col space-y-5'}>{props.children}</div>;
}

function TileFigure(props: React.PropsWithChildren) {
  return <div className={'text-3xl font-bold'}>{props.children}</div>;
}

function TileTrend(
  props: React.PropsWithChildren<{
    trend: 'up' | 'down' | 'stale';
  }>,
) {
  const Icon = useMemo(() => {
    switch (props.trend) {
      case 'up':
        return <ArrowUpIcon className={'h-4 text-success'} />;
      case 'down':
        return <ArrowDownIcon className={'h-4 text-destructive'} />;
      case 'stale':
        return <Bars2Icon className={'h-4 text-warning'} />;
    }
  }, [props.trend]);

  return (
    <TileBadge trend={props.trend}>
      <span className={'flex items-center space-x-1'}>
        {Icon}
        <span>{props.children}</span>
      </span>
    </TileBadge>
  );
}

function TileBadge(
  props: React.PropsWithChildren<{
    trend: 'up' | 'down' | 'stale';
  }>,
) {
  const className = `inline-flex items-center rounded-lg py-1 px-2.5 text-sm font-medium justify-center`;

  if (props.trend === `up`) {
    return (
      <div
        className={`${className} bg-success/10 text-success`}
      >
        <span>{props.children}</span>
      </div>
    );
  }

  if (props.trend === `down`) {
    return (
      <div className={`${className} bg-destructive/10 text-destructive`}>
        <span>{props.children}</span>
      </div>
    );
  }

  return (
    <div
      className={`${className} bg-warning/10 text-warning`}
    >
      <span>{props.children}</span>
    </div>
  );
}

Tile.Header = TileHeader;
Tile.Heading = TileHeading;
Tile.Body = TileBody;
Tile.Figure = TileFigure;
Tile.Trend = TileTrend;
Tile.Badge = TileBadge;

export default Tile;
