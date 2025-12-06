import { FC, ReactNode } from 'react';

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
  return (
    <section className={className}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-linear-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
          <div className="w-5 h-5 text-white">
            {icon}
          </div>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 leading-tight">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
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