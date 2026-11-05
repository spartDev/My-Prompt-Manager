import type { FC, ReactNode } from 'react';
import { useId } from 'react';

interface SettingsSectionProps {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

const SettingsSection: FC<SettingsSectionProps> = ({
  icon,
  title,
  description,
  children,
  className = ''
}) => {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={className}>
      <div className="flex items-center gap-3 mb-5">
        <div data-testid="section-icon" className="w-10 h-10 bg-accent-subtle text-accent rounded-xl flex items-center justify-center shrink-0">
          <div className="w-5 h-5">
            {icon}
          </div>
        </div>
        <div className="flex-1">
          <h2 id={titleId} className="text-xl font-semibold text-primary leading-tight">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-tertiary mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      <div>
        {children}
      </div>
    </section>
  );
};

export default SettingsSection;