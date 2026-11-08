import { type FC, type ReactNode, useId } from 'react';

interface SettingsGroupProps {
  /** The group's name, shown above its card */
  label: string;
  /** The group's rows (SettingsRow); a 1px divider separates them, none above the first */
  children: ReactNode;
  /** Shown under the card, outside it: a flow the group opens (adding a custom site) */
  after?: ReactNode;
}

/** A Settings group (Atelier 1C): a label, then one card that holds the group's rows */
const SettingsGroup: FC<SettingsGroupProps> = ({ label, children, after }) => {
  const labelId = useId();

  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-2">
      <h2 id={labelId} className="pl-1 text-[12.5px] font-bold text-secondary">
        {label}
      </h2>
      <div className="bg-card border border-default rounded-group overflow-hidden divide-y divide-(--border-color-divider)">
        {children}
      </div>
      {after}
    </section>
  );
};

export default SettingsGroup;
