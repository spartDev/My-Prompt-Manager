export function importsOf(dist: string, file: string): string[];
export function loadedByContentScriptLoader(dist: string): string[];
export function chunksReachableFrom(dist: string, entry: string): string[];
export function customSiteResources(dist: string): string[];
export function matchesResourcePattern(pattern: string, resource: string): boolean;
export function checkCustomSiteChunks(dist: string): { chunks: string[]; unmatched: string[] };
