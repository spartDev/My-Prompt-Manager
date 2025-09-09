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
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <div className="w-5 h-5 text-white">
            {icon}
          </div>
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="ml-11">
        {children}
      </div>
    </section>
  );
};

export default SettingsSection;