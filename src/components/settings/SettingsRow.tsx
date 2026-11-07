import type { FC, ReactNode } from 'react';

interface SettingsRowProps {
  /** The setting's name, at the left */
  label: ReactNode;
  /** Id of the label, for the control's aria-labelledby */
  labelId?: string;
  /** Renders the label as a <label> for this field id */
  labelFor?: string;
  /** A grey line under the label (a site's domain) */
  detail?: ReactNode;
  /** Shown before the label (a site's logo) */
  leading?: ReactNode;
  /** The control, at the right */
  control?: ReactNode;
  /** Shown under the row, full width: a status or a confirmation that belongs to the setting */
  children?: ReactNode;
  testId?: string;
}

/** One setting of a Settings group (Atelier 1C): its label at the left, its control at the right */
const SettingsRow: FC<SettingsRowProps> = ({ label, labelId, labelFor, detail, leading, control, children, testId }) => {
  const labelClasses = 'block text-sm font-semibold text-primary';

  return (
    <div data-testid={testId} className="py-2.5 pr-2.5 pl-3.5">
      <div className="flex items-center gap-3 min-h-[34px]">
        {leading}
        <div className="flex-1 min-w-0">
          {labelFor ? (
            <label id={labelId} htmlFor={labelFor} className={labelClasses}>{label}</label>
          ) : (
            <span id={labelId} className={labelClasses}>{label}</span>
          )}
          {detail && <span className="block text-[11.5px] text-tertiary truncate">{detail}</span>}
        </div>
        {control}
      </div>
      {children}
    </div>
  );
};

export default SettingsRow;
