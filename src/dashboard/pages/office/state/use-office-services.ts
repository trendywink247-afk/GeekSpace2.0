// src/dashboard/pages/office/state/use-office-services.ts
// Polls /office/services every 30 s to get workstation health status.
// Gracefully degrades if the endpoint is unavailable (returns empty map).

import { useEffect, useState } from "react";

type ServiceStatus = "up" | "degraded" | "down";

interface ServicesData {
	stations: Array<{ id: string; status: ServiceStatus }>;
}

function apiBase(): string {
	return (
		import.meta.env.VITE_API_URL ||
		(import.meta.env.PROD ? "/api" : "http://localhost:3001/api")
	);
}

function getToken(): string | null {
	return (
		localStorage.getItem("gs_token") ||
		localStorage.getItem("token") ||
		sessionStorage.getItem("token")
	);
}

/**
 * Polls /office/services every 30 s and returns a map of station ID → health status.
 * Returns an empty object if the endpoint is unavailable or errors.
 */
export function useOfficeServices(): Record<string, ServiceStatus> {
	const [services, setServices] = useState<Record<string, ServiceStatus>>({});

	useEffect(() => {
		let cancelled = false;

		const load = async () => {
			try {
				const token = getToken();
				const res = await fetch(`${apiBase()}/office/services`, {
					headers: token ? { Authorization: `Bearer ${token}` } : {},
				});
				if (!res.ok) return;
				const data = (await res.json()) as ServicesData;
				if (cancelled) return;
				const map: Record<string, ServiceStatus> = {};
				for (const s of data.stations) map[s.id] = s.status;
				setServices(map);
			} catch {
				// endpoint may not exist yet (backend lane still in progress) — silent degradation
			}
		};

		load();
		const t = setInterval(load, 30_000);
		return () => {
			cancelled = true;
			clearInterval(t);
		};
	}, []);

	return services;
}
