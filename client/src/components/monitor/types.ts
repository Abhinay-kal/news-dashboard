export interface MonitoredPage {
	id: string;
	name: string;
	url: string;
	path: string;
	status: "idle" | "capturing" | "error";
	lastChecked?: string;
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
	pages: MonitoredPage[];
	isSample?: boolean;
}
