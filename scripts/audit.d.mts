export type Waiver = { id: string; reason: string; until: string; devOnly?: boolean };
export type Advisory = { id: string; title: string; severity: string; packages: string[]; nodes: string[] };
export const WAIVERS: Waiver[];
export function advisoriesOf(report: unknown): Advisory[];
export function auditVerdict(report: unknown, waivers: Waiver[], today: string, lockfile?: unknown): { blocking: Advisory[]; expired: Waiver[] };
