export interface RepoConfig {
  repo: string;
  token: string;
}

export interface WayfinderSettings {
  repos: RepoConfig[];
  pollIntervalMinutes: number;
  copyTemplate: string;
}

export const DEFAULT_SETTINGS: WayfinderSettings = {
  repos: [],
  pollIntervalMinutes: 2,
  copyTemplate: "/wayfinder {url}",
};

export function sanitizeSettings(value: unknown): WayfinderSettings {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  let interval = DEFAULT_SETTINGS.pollIntervalMinutes;
  try {
    const coerced = Number(raw.pollIntervalMinutes);
    if (Number.isFinite(coerced)) interval = Math.min(120, Math.max(0.5, coerced));
  } catch {
    // Keep the default for values that cannot be converted to a number.
  }

  let repos: RepoConfig[] = [];
  if (Array.isArray(raw.repos)) {
    repos = raw.repos.flatMap((value): RepoConfig[] => {
      if (!value || typeof value !== "object") return [];
      const entry = value as Record<string, unknown>;
      if (typeof entry.repo !== "string" || typeof entry.token !== "string") return [];
      const config = { repo: entry.repo.trim(), token: entry.token.trim() };
      return config.repo || config.token ? [config] : [];
    });
  } else if (!("repos" in raw) && typeof raw.repo === "string" && typeof raw.token === "string") {
    const config = { repo: raw.repo.trim(), token: raw.token.trim() };
    if (config.repo || config.token) repos.push(config);
  }

  return {
    repos,
    pollIntervalMinutes: interval,
    copyTemplate:
      typeof raw.copyTemplate === "string" ? raw.copyTemplate : DEFAULT_SETTINGS.copyTemplate,
  };
}

export function isValidRepoConfig(config: RepoConfig): boolean {
  return config.token.length > 0 && config.repo.includes("/");
}
