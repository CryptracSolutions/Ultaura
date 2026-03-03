import { formatLongDate } from '~/lib/utils/format-date';

type Props = {
  dateString: string;
};

const DateFormatter = ({ dateString }: Props) => {
  return <time dateTime={dateString}>{formatLongDate(dateString)}</time>;
};

export default DateFormatter;
