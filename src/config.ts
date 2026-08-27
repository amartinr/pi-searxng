import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Resolves the pi coding agent directory in a robust way.
 * Prioritizes PI_CODING_AGENT_DIR (if it points to an agent directory),
 * then HOME, and finally homedir() as a last resort.
 */
function resolveAgentDir(): string {
  // PI_CODING_AGENT_DIR is the full agent directory
  const piDir = process.env.PI_CODING_AGENT_DIR;
  if (piDir) {
    // Expand ~ to actual home directory (handles both ~/ and ~\)
    if (piDir.startsWith("~/") || piDir.startsWith("~\\")) {
      return join(homedir(), piDir.slice(2));
    }
    return piDir;
  }
  // Fallback: HOME env var or homedir()
  const hd = homedir();
  if (process.env.HOME) {
    return join(process.env.HOME, ".pi", "agent");
  }
  if (hd) {
    return join(hd, ".pi", "agent");
  }
  return join("/", ".pi", "agent");
}

const CONFIG_PATH = join(
  resolveAgentDir(),
  "extensions",
  "pi-searxng",
  "config.json"
);

export interface Config {
  searxngUrl: string;
  timeoutMs: number;
  maxResults: number;
  cacheFreshnessMs: number;
  cacheTtlMs: number;
  cacheMaxSize: number;
  safesearch: "off" | "moderate" | "strict";
}

export function loadConfig(): Config {
  const defaults: Config = {
    searxngUrl: process.env.SEARXNG_URL || "http://localhost:8080",
    timeoutMs: 30000,
    maxResults: 10,
    cacheFreshnessMs: 15 * 60 * 1000, // 15 minutes
    cacheTtlMs: 24 * 60 * 60 * 1000,  // 24 hours
    cacheMaxSize: 200,
    safesearch: "off"
  };

  if (!existsSync(CONFIG_PATH)) {
    console.info(
      `Config file not found at ${CONFIG_PATH}. Using default settings.`
    );
    return defaults;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `Failed to parse config file (${CONFIG_PATH}): ${msg}\n` +
      `SearXNG will use default settings. Fix the config file or delete it to restore defaults.`
    );
    return defaults;
  }

  const config = { ...defaults, ...(raw as Record<string, unknown>) } as Config;

  try {
    if (typeof config.searxngUrl !== "string") {
      throw new Error("'searxngUrl' must be a string");
    }
    if (typeof config.timeoutMs !== "number" || config.timeoutMs <= 0) {
      throw new Error("'timeoutMs' must be a positive number");
    }
    if (typeof config.maxResults !== "number" || config.maxResults <= 0) {
      throw new Error("'maxResults' must be a positive number");
    }
    if (typeof config.cacheFreshnessMs !== "number" || config.cacheFreshnessMs <= 0) {
      throw new Error("'cacheFreshnessMs' must be a positive number");
    }
    const validSafesearchValues = ["off", "moderate", "strict"];
    if (!validSafesearchValues.includes(config.safesearch)) {
      throw new Error("'safesearch' must be one of: 'off', 'moderate', 'strict'");
    }
    if (typeof config.cacheTtlMs !== "number" || config.cacheTtlMs <= 0) {
      throw new Error("'cacheTtlMs' must be a positive number");
    }
    if (typeof config.cacheMaxSize !== "number" || config.cacheMaxSize <= 0) {
      throw new Error("'cacheMaxSize' must be a positive number");
    }

    return config;
  } catch (err) {
    console.warn(
      `Invalid config values, using defaults: ${err instanceof Error ? err.message : String(err)}`
    );
    return defaults;
  }
}
