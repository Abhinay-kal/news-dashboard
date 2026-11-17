export interface MonitoredPage {
	id: string;
	name: string;
	url: string;
	path: string;
	category?: "national" | "counselling" | "iit";
	status: "idle" | "capturing" | "error";
	lastChecked?: string;
	lastInspected?: string;
	diffPercent: number;
	diffPixels: number;
	hasChange: boolean;
	isCosmeticOnly?: boolean;
	isBlockedOrError: boolean;
	errorMessage?: string;
	currentScreenshot?: string;
	baselineScreenshot?: string;
	diffScreenshot?: string;
	historyCount?: number;
}

export interface MonitoredSite {
	id: string;
	name: string;
	domain: string;
	rootUrl: string;
	category?: "national" | "counselling" | "iit";
	pages: MonitoredPage[];
	isSample?: boolean;
	lastInspected?: string;
}
