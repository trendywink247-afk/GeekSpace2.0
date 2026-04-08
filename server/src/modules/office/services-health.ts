/**
 * Office Services Health Check
 *
 * Probes container/service endpoints for the Office canvas "station" cards.
 * Returns up/degraded/down status with latency, cached for 15 seconds.
 *
 * Notes on networking:
 * - The server runs inside the `geekspace-staging` container on the
 *   `geekspace-net` Docker bridge network.
 * - Container DNS names (e.g. `geekspace-searxng`) resolve via Docker's
 *   embedded DNS.
 * - `host.docker.internal` is NOT available in this environment — the
 *   `claude-bridge` process runs on the host at 127.0.0.1:8787 and is
 *   NOT reachable from inside the container over the bridge network.
 *   The compute-forge picoclaw check uses the internal container hostname.
 *
 * @module modules/office/services-health
 */

import { logger } from "../../logger.js";

// ── Types ──────────────────────────────────────────────────

export type ServiceStatus = "up" | "degraded" | "down";

export interface StationHealth {
	id: string;
	container: string | null;
	status: ServiceStatus;
	latencyMs: number | null;
}

export interface ServicesHealthResult {
	stations: StationHealth[];
	checkedAt: string;
}

// ── Station definitions ────────────────────────────────────

interface SingleCheck {
	id: string;
	container: string | null;
	url: string | null;
	timeout: number;
}

interface MultiCheck {
	id: string;
	containers: string[];
	urls: string[];
	timeout: number;
}

type CheckDef = SingleCheck | MultiCheck;

const HEALTH_CHECKS: CheckDef[] = [
	{
		id: "search-terminal",
		container: "geekspace-searxng",
		url: "http://geekspace-searxng:8080/",
		timeout: 2000,
	},
	{
		id: "crawl-booth",
		container: "crawl4ai",
		url: "http://crawl4ai-ykgs-crawl4ai-1:11235/",
		timeout: 2000,
	},
	{
		id: "memory-rack",
		containers: ["meilisearch", "qdrant"],
		urls: [
			"http://geekspace-meilisearch:7700/health",
			"http://geekspace-qdrant:6333/healthz",
		],
		timeout: 2000,
	},
	{
		id: "browser-booth",
		container: "geekspace-browser",
		url: "http://geekspace-browser:3010/health",
		timeout: 2000,
	},
	{
		id: "compute-forge",
		// Note: claude-bridge (127.0.0.1:8787) is not reachable from inside
		// the container — only picoclaw is probed here.
		containers: ["picoclaw", "claude-bridge"],
		urls: ["http://geekspace-picoclaw:8080/health"],
		timeout: 2000,
	},
	{
		id: "creative-easel",
		container: null,
		url: null, // External APIs only (Replicate, Kling, etc.)
		timeout: 2000,
	},
	{
		id: "scheduling-board",
		container: null,
		url: null, // Google Calendar API — external
		timeout: 2000,
	},
];

// ── Cache ──────────────────────────────────────────────────

const CACHE_TTL_MS = 15_000;
let _cache: ServicesHealthResult | null = null;
let _cacheTime = 0;

// ── Probe helpers ──────────────────────────────────────────

/**
 * Probe a single URL. Returns latency ms or null on failure.
 */
async function probeUrl(
	url: string,
	timeoutMs: number,
): Promise<number | null> {
	const start = Date.now();
	try {
		const res = await fetch(url, {
			method: "GET",
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (res.ok || res.status < 500) {
			return Date.now() - start;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Convert a latency reading to a ServiceStatus.
 * - < 1000ms → up
 * - 1000–3000ms → degraded
 * - null / >3000ms → down
 */
function latencyToStatus(latencyMs: number | null): ServiceStatus {
	if (latencyMs === null) return "down";
	if (latencyMs < 1000) return "up";
	return "degraded";
}

async function checkSingle(def: SingleCheck): Promise<StationHealth> {
	if (!def.url) {
		// Null URL = external-only service, assume up
		return {
			id: def.id,
			container: def.container,
			status: "up",
			latencyMs: null,
		};
	}
	const latencyMs = await probeUrl(def.url, def.timeout);
	return {
		id: def.id,
		container: def.container,
		status: latencyToStatus(latencyMs),
		latencyMs,
	};
}

async function checkMulti(def: MultiCheck): Promise<StationHealth> {
	if (def.urls.length === 0) {
		return {
			id: def.id,
			container: def.containers.join(", "),
			status: "up",
			latencyMs: null,
		};
	}

	const results = await Promise.all(
		def.urls.map((url) => probeUrl(url, def.timeout)),
	);
	const successes = results.filter((r) => r !== null) as number[];

	let status: ServiceStatus;
	const avgLatency =
		successes.length > 0
			? Math.round(successes.reduce((a, b) => a + b, 0) / successes.length)
			: null;

	if (successes.length === 0) {
		status = "down";
	} else if (successes.length < def.urls.length) {
		status = "degraded";
	} else {
		status = latencyToStatus(avgLatency);
	}

	return {
		id: def.id,
		container: def.containers.join(", "),
		status,
		latencyMs: avgLatency,
	};
}

// ── Public API ─────────────────────────────────────────────

/**
 * Run all health checks and return the result, using a 15-second in-memory cache.
 */
export async function getServicesHealth(): Promise<ServicesHealthResult> {
	const now = Date.now();
	if (_cache && now - _cacheTime < CACHE_TTL_MS) {
		return _cache;
	}

	logger.debug("office:services_health:checking");

	const checks = await Promise.all(
		HEALTH_CHECKS.map((def) => {
			if ("urls" in def) {
				return checkMulti(def as MultiCheck);
			}
			return checkSingle(def as SingleCheck);
		}),
	);

	const result: ServicesHealthResult = {
		stations: checks,
		checkedAt: new Date().toISOString(),
	};

	_cache = result;
	_cacheTime = now;

	logger.debug({ stations: checks.length }, "office:services_health:done");
	return result;
}

/**
 * Invalidate the health cache (useful for testing).
 */
export function invalidateServicesHealthCache(): void {
	_cache = null;
	_cacheTime = 0;
}
