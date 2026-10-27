import React, { useState } from "react";
import type { MonitoredSite, MonitoredPage } from "./types";
import { sounds } from "../../utils/audioFeedback";
import { isWithin24Hours, getRelativeTime, getHoursRemaining } from "../../utils/timeUtils";

interface SiteHierarchyCardProps {
	site: MonitoredSite;
	onCheckSite: (siteId: string) => Promise<void>;
	onCheckPage: (siteId: string, pageId: string) => Promise<void>;
	onDeleteSite: (siteId: string) => Promise<void>;
	onDeletePage: (siteId: string, pageId: string) => Promise<void>;
	onInspectPage: (site: MonitoredSite, page: MonitoredPage) => void;
	onAddSubPage: (siteId: string, url: string, name?: string) => Promise<void>;
}

export const SiteHierarchyCard: React.FC<SiteHierarchyCardProps> = ({
	site,
	onCheckSite,
	onCheckPage,
	onDeleteSite,
	onDeletePage,
	onInspectPage,
	onAddSubPage,
}) => {
	const [expanded, setExpanded] = useState(false);
	const [isCheckingSite, setIsCheckingSite] = useState(false);
	const [checkingPageId, setCheckingPageId] = useState<string | null>(null);
	const [showInlineAdd, setShowInlineAdd] = useState(false);
	const [newSubPath, setNewSubPath] = useState("");
	const [newSubLabel, setNewSubLabel] = useState("");
	const [isSubmittingPage, setIsSubmittingPage] = useState(false);
	const [isHoveringHero, setIsHoveringHero] = useState(false);

	const rootPage = site.pages[0];
	const subPages = site.pages.slice(1);

	// Diff Status
	const changedPages = site.pages.filter((p) => p.hasChange);
	const hasAnyChange = changedPages.length > 0;
	const maxDiff = Math.max(0, ...site.pages.map((p) => p.diffPercent || 0));

	// 24-Hour Inspected Status
	const siteInspectedIn24h = isWithin24Hours(site.lastInspected);
	const siteInspectedRelative = getRelativeTime(site.lastInspected);
	const hoursLeft = getHoursRemaining(site.lastInspected);

	// Card highlight classes based on 24h & diff state
	let cardRingClass = "border-neutral-200/80 hover:border-neutral-300 shadow-sm";
	if (hasAnyChange && !siteInspectedIn24h) {
		// Urgent unreviewed diff
		cardRingClass = "border-rose-400 ring-2 ring-rose-500/80 shadow-[0_4px_24px_rgba(244,63,94,0.18)] bg-gradient-to-b from-rose-50/20 via-white to-white";
	} else if (hasAnyChange && siteInspectedIn24h) {
		// Reviewed within 24h highlight
		cardRingClass = "border-indigo-400 ring-2 ring-indigo-400/90 shadow-[0_4px_20px_rgba(99,102,241,0.15)] bg-gradient-to-b from-indigo-50/25 via-white to-white";
	} else if (!hasAnyChange && siteInspectedIn24h) {
		// Checked clean within 24h
		cardRingClass = "border-emerald-300 ring-1 ring-emerald-400/50 shadow-sm";
	}

	const handleToggleExpand = () => {
		sounds.playTap();
		setExpanded(!expanded);
	};

	const handleCheckSite = async () => {
		sounds.playClick();
		setIsCheckingSite(true);
		try {
			await onCheckSite(site.id);
		} finally {
			setIsCheckingSite(false);
		}
	};

	const handleCheckPage = async (pageId: string) => {
		sounds.playClick();
		setCheckingPageId(pageId);
		try {
			await onCheckPage(site.id, pageId);
		} finally {
			setCheckingPageId(null);
		}
	};

	const handleInspect = (page: MonitoredPage) => {
		sounds.playClick();
		onInspectPage(site, page);
	};

	const handleInlineSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newSubPath.trim()) return;

		let fullUrl = newSubPath.trim();
		if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
			const cleanRoot = site.rootUrl.replace(/\/+$/, "");
			const cleanSub = newSubPath.trim().replace(/^\/+/, "");
			fullUrl = `${cleanRoot}/${cleanSub}`;
		}

		sounds.playClick();
		setIsSubmittingPage(true);
		try {
			await onAddSubPage(site.id, fullUrl, newSubLabel.trim() || undefined);
			setNewSubPath("");
			setNewSubLabel("");
			setShowInlineAdd(false);
		} finally {
			setIsSubmittingPage(false);
		}
	};

	// Which page to show as hero? Prefer a page with change if available, else root page
	const heroPage = changedPages[0] || rootPage;

	return (
		<div className={`apple-card rounded-2xl transition-all duration-200 flex flex-col overflow-hidden ${cardRingClass}`}>
			{/* Top 24h Review Status Banner */}
			{hasAnyChange && !siteInspectedIn24h && (
				<div className="bg-gradient-to-r from-rose-600 to-rose-500 text-white px-4 py-1.5 flex items-center justify-between text-xs font-semibold shadow-inner">
					<div className="flex items-center gap-1.5">
						<span className="w-2 h-2 rounded-full bg-white animate-pulse" />
						<span>Unreviewed Change ({maxDiff}%)</span>
					</div>
					<span className="text-[11px] font-normal opacity-90">Click preview to review →</span>
				</div>
			)}

			{hasAnyChange && siteInspectedIn24h && (
				<div className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-4 py-1.5 flex items-center justify-between text-xs font-semibold shadow-inner">
					<div className="flex items-center gap-1.5">
						<span>✓</span>
						<span>Inspected {siteInspectedRelative}</span>
					</div>
					<span className="text-[11px] font-mono font-normal opacity-90">
						Valid for 24h ({hoursLeft}h left)
					</span>
				</div>
			)}

			{/* Hero Page Preview Viewport (Aspect Ratio 16:10) */}
			{heroPage && (
				<div
					onMouseEnter={() => setIsHoveringHero(true)}
					onMouseLeave={() => setIsHoveringHero(false)}
					onClick={() => handleInspect(heroPage)}
					className="relative w-full h-48 sm:h-52 bg-neutral-950 overflow-hidden cursor-pointer group select-none border-b border-neutral-200/60"
				>
					{/* Baseline Image (shown on hover peek or when clean) */}
					{heroPage.baselineScreenshot && (
						<img
							src={heroPage.baselineScreenshot}
							alt="Baseline Preview"
							className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-200 ${
								heroPage.hasChange && !isHoveringHero ? "opacity-0" : "opacity-100"
							}`}
						/>
					)}

					{/* Diff or Current Image (shown when changed by default) */}
					{heroPage.hasChange && (heroPage.diffScreenshot || heroPage.currentScreenshot) && (
						<img
							src={heroPage.diffScreenshot || heroPage.currentScreenshot}
							alt="Changed Diff Preview"
							className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-200 ${
								isHoveringHero ? "opacity-0" : "opacity-100"
							}`}
						/>
					)}

					{/* Clean Page Fallback when no change */}
					{!heroPage.hasChange && heroPage.currentScreenshot && (
						<img
							src={heroPage.currentScreenshot}
							alt="Current Preview"
							className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-200 group-hover:scale-102"
						/>
					)}

					{/* Loading skeleton if no screenshots yet */}
					{!heroPage.currentScreenshot && (
						<div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 font-mono text-xs">
							<span className="animate-pulse">Capturing baseline snapshot...</span>
						</div>
					)}

					{/* Floating Diff Badge (Top-Left) */}
					<div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
						{heroPage.hasChange ? (
							<span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-lg backdrop-blur-md flex items-center gap-1.5 border border-white/20">
								<span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
								<span>{heroPage.diffPercent}% Diff</span>
							</span>
						) : (
							<span className="px-2.5 py-1 rounded-full text-xs font-medium bg-black/60 text-white/90 shadow-md backdrop-blur-md flex items-center gap-1.5 border border-white/10">
								<span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
								<span>Quiet (0% Diff)</span>
							</span>
						)}

						{heroPage.name && (
							<span className="px-2 py-0.5 rounded bg-black/50 text-white/80 text-[11px] font-mono backdrop-blur-sm truncate max-w-[150px]">
								{heroPage.name}
							</span>
						)}
					</div>

					{/* Hover State Label (Top-Right) */}
					<div className="absolute top-3 right-3 z-10">
						{heroPage.hasChange && isHoveringHero ? (
							<span className="px-2 py-1 rounded bg-black/80 text-neutral-200 text-[10px] font-mono tracking-wide border border-white/10 animate-fade-in">
								Peeking: Baseline
							</span>
						) : (
							<span className="btn-tactile px-3 py-1 rounded-full bg-white/95 text-neutral-900 text-xs font-semibold shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1">
								<span>Inspect</span>
								<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
								</svg>
							</span>
						)}
					</div>

					{/* Bottom Hover Callout */}
					<div className="absolute inset-x-0 bottom-0 py-1.5 px-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between text-white text-[11px]">
						<span className="font-mono truncate">{heroPage.path || "/"}</span>
						<span className="opacity-80 group-hover:opacity-100 font-medium">Click to inspect →</span>
					</div>
				</div>
			)}

			{/* Middle Section: Site Identity & Controls */}
			<div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
				<div>
					{/* Domain Title Row */}
					<div className="flex items-start justify-between gap-3">
						<div className="flex items-center gap-2.5 min-w-0">
							<div className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200/80 flex items-center justify-center font-bold text-neutral-800 text-xs uppercase shrink-0">
								{site.domain.slice(0, 2)}
							</div>
							<div className="min-w-0">
								<div className="flex items-center gap-1.5">
									<h3 className="font-semibold text-base text-neutral-900 tracking-tight truncate">
										{site.name || site.domain}
									</h3>
									<a
										href={site.rootUrl}
										target="_blank"
										rel="noreferrer"
										className="text-neutral-400 hover:text-neutral-700 transition-colors p-0.5 shrink-0"
										title={`Visit ${site.domain}`}
									>
										<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
										</svg>
									</a>
								</div>
								<p className="text-xs text-neutral-500 font-mono truncate">{site.domain}</p>
							</div>
						</div>

						{/* Action Buttons */}
						<div className="flex items-center gap-1 shrink-0">
							<button
								onClick={handleCheckSite}
								disabled={isCheckingSite}
								className="btn-tactile p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200/60 cursor-pointer disabled:opacity-50"
								title="Re-capture entire site now"
							>
								{isCheckingSite ? (
									<svg className="w-4 h-4 animate-spin text-neutral-800" fill="none" viewBox="0 0 24 24">
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
										<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
									</svg>
								) : (
									<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
									</svg>
								)}
							</button>

							<button
								onClick={() => {
									sounds.playClick();
									setShowInlineAdd(!showInlineAdd);
									if (!expanded) setExpanded(true);
								}}
								className="btn-tactile p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200/60 cursor-pointer"
								title="Add sub-page to this site"
							>
								<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
								</svg>
							</button>

							<button
								onClick={() => {
									sounds.playTap();
									if (confirm(`Remove ${site.domain} from monitor?`)) {
										onDeleteSite(site.id);
									}
								}}
								className="btn-tactile p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
								title="Delete site"
							>
								<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
							</button>
						</div>
					</div>

					{/* Metadata Pills */}
					<div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-neutral-100 text-xs">
						<span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 font-mono text-[11px]">
							{site.pages.length} {site.pages.length === 1 ? "page" : "pages"}
						</span>

						{site.category === "national" && (
							<span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 font-semibold text-[10px] uppercase tracking-wider">
								National Board
							</span>
						)}
						{site.category === "counselling" && (
							<span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 font-semibold text-[10px] uppercase tracking-wider">
								State Portal
							</span>
						)}

						{siteInspectedIn24h ? (
							<span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium text-[11px] flex items-center gap-1">
								<span>✓</span>
								<span>Inspected {siteInspectedRelative}</span>
							</span>
						) : hasAnyChange ? (
							<span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[11px] animate-pulse">
								🚨 Needs Review
							</span>
						) : (
							<span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium text-[11px]">
								Quiet
							</span>
						)}

						{rootPage?.lastChecked && (
							<span className="text-[11px] text-neutral-400 ml-auto font-mono">
								Checked {new Date(rootPage.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
							</span>
						)}
					</div>
				</div>

				{/* Sub-Pages Toggle Accordion Button */}
				{subPages.length > 0 && (
					<div className="mt-4 pt-3 border-t border-neutral-100">
						<button
							onClick={handleToggleExpand}
							className="btn-tactile w-full py-1.5 px-3 rounded-lg text-xs font-medium bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-200/60 flex items-center justify-between cursor-pointer"
						>
							<div className="flex items-center gap-1.5">
								<span className="font-semibold">Sub-Pages</span>
								<span className="px-1.5 py-0.2 rounded-full bg-neutral-200 text-neutral-700 text-[10px] font-mono">
									{subPages.length}
								</span>
								{subPages.some((p) => p.hasChange) && (
									<span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse ml-1" />
								)}
							</div>
							<div className="flex items-center gap-1 text-neutral-400">
								<span>{expanded ? "Hide" : "Branch view"}</span>
								<svg
									className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
								</svg>
							</div>
						</button>
					</div>
				)}
			</div>

			{/* Sub-Pages Embedded Branch Rail Section */}
			<div className={`accordion-wrapper ${expanded ? "expanded" : ""}`}>
				<div className="accordion-inner bg-neutral-50/60 border-t border-neutral-100">
					<div className="p-4 relative pl-6">
						{/* SVG Curved Tree Rail Lines */}
						<div className="absolute left-2.5 top-0 bottom-4 w-6 pointer-events-none">
							<svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
								<line
									x1="6"
									y1="0"
									x2="6"
									y2="100%"
									stroke="#cbd5e1"
									strokeWidth="1.5"
									strokeLinecap="round"
								/>
							</svg>
						</div>

						{/* Sub-Pages List */}
						<div className="space-y-2.5">
							{subPages.map((page) => {
								const pageInspectedIn24h = isWithin24Hours(page.lastInspected);
								const pageInspectedRelative = getRelativeTime(page.lastInspected);
								const isCheckingThisPage = checkingPageId === page.id;

								return (
									<div
										key={page.id}
										className={`relative flex items-center justify-between p-2.5 rounded-xl bg-white border transition-all duration-150 pl-6 group/sub ${
											page.hasChange && !pageInspectedIn24h
												? "border-rose-300 ring-1 ring-rose-400/60"
												: page.hasChange && pageInspectedIn24h
												? "border-indigo-300 ring-1 ring-indigo-400/50"
												: "border-neutral-200/70 hover:border-neutral-300"
										}`}
									>
										{/* SVG Branch curve from vertical rail to node */}
										<div className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none">
											<svg className="w-4 h-4" viewBox="0 0 16 16">
												<path
													d="M 0,0 L 0,8 Q 0,14 8,14 L 16,14"
													fill="none"
													stroke="#cbd5e1"
													strokeWidth="1.5"
													strokeLinecap="round"
												/>
												<circle
													cx="12"
													cy="14"
													r="2.5"
													fill={page.hasChange ? (pageInspectedIn24h ? "#6366f1" : "#f43f5e") : "#10b981"}
													stroke="#ffffff"
													strokeWidth="1"
												/>
											</svg>
										</div>

										{/* Left: Thumbnail & Name */}
										<div className="flex items-center gap-2.5 min-w-0">
											<div
												onClick={() => handleInspect(page)}
												className="relative w-14 h-9 rounded bg-neutral-100 border border-neutral-200 shrink-0 overflow-hidden cursor-pointer shadow-2xs group/sthumb"
											>
												{page.currentScreenshot ? (
													<img
														src={page.currentScreenshot}
														alt={page.name}
														className="w-full h-full object-cover object-top transition-transform duration-150 group-hover/sthumb:scale-110"
													/>
												) : (
													<div className="w-full h-full flex items-center justify-center text-[8px] text-neutral-400 font-mono">
														...
													</div>
												)}
												<div className="absolute inset-0 bg-black/40 opacity-0 group-hover/sthumb:opacity-100 transition-opacity flex items-center justify-center text-white text-[8px] font-semibold">
													Diff
												</div>
											</div>

											<div className="min-w-0">
												<h5 className="font-medium text-xs text-neutral-900 truncate">
													{page.name || page.path}
												</h5>
												<p className="text-[10px] text-neutral-400 font-mono truncate max-w-[120px] sm:max-w-[180px]">
													{page.path}
												</p>
											</div>
										</div>

										{/* Right: Status Pill & Controls */}
										<div className="flex items-center gap-1.5 shrink-0">
											{page.hasChange ? (
												pageInspectedIn24h ? (
													<span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
														✓ {pageInspectedRelative}
													</span>
												) : (
													<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
														{page.diffPercent}%
													</span>
												)
											) : (
												<span className="px-1.5 py-0.5 rounded text-[10px] text-neutral-500 bg-neutral-100">
													Quiet
												</span>
											)}

											<button
												onClick={() => handleCheckPage(page.id)}
												disabled={isCheckingThisPage}
												className="btn-tactile p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer disabled:opacity-40"
												title="Re-capture sub-page diff"
											>
												<svg
													className={`w-3.5 h-3.5 ${isCheckingThisPage ? "animate-spin" : ""}`}
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
													/>
												</svg>
											</button>

											<button
												onClick={() => handleInspect(page)}
												className="btn-tactile px-2 py-0.5 rounded text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 shadow-2xs cursor-pointer"
											>
												Inspect
											</button>

											<button
												onClick={() => {
													sounds.playTap();
													if (confirm(`Remove sub-page ${page.path}?`)) {
														onDeletePage(site.id, page.id);
													}
												}}
												className="btn-tactile p-0.5 text-neutral-300 hover:text-rose-500 transition-colors cursor-pointer"
												title="Delete sub-page"
											>
												<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										</div>
									</div>
								);
							})}

							{/* Inline Add Sub-Page Form at the end of the rail */}
							{showInlineAdd && (
								<form
									onSubmit={handleInlineSubmit}
									className="relative p-3 rounded-xl bg-white border border-neutral-300 shadow-xs flex flex-col gap-2 pl-4"
								>
									<div className="flex items-center gap-1.5">
										<span className="text-[11px] font-mono text-neutral-500 shrink-0">
											{site.domain}/
										</span>
										<input
											type="text"
											placeholder="sub-path (e.g. notices)"
											value={newSubPath}
											onChange={(e) => setNewSubPath(e.target.value)}
											className="w-full text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:bg-white"
											autoFocus
										/>
									</div>
									<div className="flex items-center gap-2">
										<input
											type="text"
											placeholder="Label (Optional)"
											value={newSubLabel}
											onChange={(e) => setNewSubLabel(e.target.value)}
											className="flex-1 text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:bg-white"
										/>
										<button
											type="button"
											onClick={() => setShowInlineAdd(false)}
											className="btn-tactile px-2.5 py-1 rounded text-xs text-neutral-600 hover:bg-neutral-100 cursor-pointer"
										>
											Cancel
										</button>
										<button
											type="submit"
											disabled={isSubmittingPage || !newSubPath.trim()}
											className="btn-tactile px-3 py-1 rounded text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 shadow-xs cursor-pointer disabled:opacity-50"
										>
											{isSubmittingPage ? "..." : "Add"}
										</button>
									</div>
								</form>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
