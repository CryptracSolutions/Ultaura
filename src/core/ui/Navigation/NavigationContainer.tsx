import classNames from 'clsx';

const NavigationContainer: React.FCC<{
  className?: string;
}> = ({ children, className }) => {
  return (
    <div
      className={classNames(
        `border-b border-border`,
        className,
      )}
    >
      {children}
    </div>
  );
};

export default NavigationContainer;
