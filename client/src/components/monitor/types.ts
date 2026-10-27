export interface MonitoredPage {
	id: string;
	name: string;
	url: string;
	path: string;
	category?: "national" | "counselling";
	status: "idle" | "capturing" | "error";
	lastChecked?: string;
	lastInspected?: string;
	diffPercent: number;
	diffPixels: number;
	hasChange: boolean;
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
	category?: "national" | "counselling";
	pages: MonitoredPage[];
	isSample?: boolean;
	lastInspected?: string;
}
