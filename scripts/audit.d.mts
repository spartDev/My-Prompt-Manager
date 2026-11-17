export type Waiver = { id: string; reason: string; until: string };
export type Advisory = { id: string; title: string; severity: string; packages: string[] };
export const WAIVERS: Waiver[];
export function advisoriesOf(report: unknown): Advisory[];
export function auditVerdict(report: unknown, waivers: Waiver[], today: string): { blocking: Advisory[]; expired: Waiver[] };
