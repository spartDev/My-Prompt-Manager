import type { FC, ReactNode } from 'react';

import { DocumentationIcon, GitHubIcon, IssueIcon } from '../icons/SettingsIcons';

import SettingsGroup from './SettingsGroup';
import SettingsRow from './SettingsRow';

const LINKS: Array<{ href: string; label: string; icon: ReactNode }> = [
  { href: 'https://github.com/spartDev/My-Prompt-Manager', label: 'GitHub Repository', icon: <GitHubIcon /> },
  { href: 'https://github.com/spartDev/My-Prompt-Manager/issues', label: 'Report an Issue', icon: <IssueIcon /> },
  { href: 'https://github.com/spartDev/My-Prompt-Manager/wiki', label: 'Documentation', icon: <DocumentationIcon /> }
];

const ExternalIcon = (
  <svg aria-hidden="true" className="size-4 text-tertiary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4" />
  </svg>
);

/** The Help group: where to read about the extension or report a problem, and its license. The version is in the Settings header */
const HelpSection: FC = () => (
  <SettingsGroup label="Help">
    {LINKS.map(link => (
      <a
        key={link.href}
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 min-h-[54px] py-2.5 pr-3.5 pl-3.5 text-sm font-semibold text-primary hover:bg-raised transition-colors focus-interactive -outline-offset-2"
      >
        <span className="text-accent shrink-0">{link.icon}</span>
        <span className="flex-1">{link.label}</span>
        {ExternalIcon}
      </a>
    ))}
    <SettingsRow label="License" control={<span className="text-[12.5px] text-tertiary">MIT · Thomas Roux</span>} />
  </SettingsGroup>
);

export default HelpSection;
