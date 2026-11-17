/**
 * Time utility functions for 24-hour inspection status
 */

export function isWithin24Hours(dateString?: string): boolean {
	if (!dateString) return false;
	try {
		const time = new Date(dateString).getTime();
		if (isNaN(time)) return false;
		const diffMs = Date.now() - time;
		return diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000;
	} catch {
		return false;
	}
}

export function getRelativeTime(dateString?: string): string {
	if (!dateString) return "";
	try {
		const time = new Date(dateString).getTime();
		if (isNaN(time)) return "";
		const diffMs = Date.now() - time;
		if (diffMs < 0) return "Just now";

		const seconds = Math.floor(diffMs / 1000);
		if (seconds < 60) return "Just now";

		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;

		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;

		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	} catch {
		return "";
	}
}

export function getHoursRemaining(dateString?: string): number {
	if (!dateString) return 0;
	try {
		const time = new Date(dateString).getTime();
		if (isNaN(time)) return 0;
		const diffMs = 24 * 60 * 60 * 1000 - (Date.now() - time);
		return Math.max(0, Math.ceil(diffMs / (60 * 60 * 1000)));
	} catch {
		return 0;
	}
}
