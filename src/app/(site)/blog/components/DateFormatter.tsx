import { parseISO, format } from 'date-fns';

type Props = {
  dateString: string;
};

const DateFormatter = ({ dateString }: Props) => {
  const date = parseISO(dateString);

  return <time dateTime={dateString}>{format(date, 'MMMM d, yyyy')}</time>;
};

export default DateFormatter;
