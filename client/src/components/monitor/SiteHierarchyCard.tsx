import React, { useState } from "react";
import type { MonitoredSite, MonitoredPage } from "./types";
import { sounds } from "../../utils/audioFeedback";

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
	const [expanded, setExpanded] = useState(true);
	const [isCheckingSite, setIsCheckingSite] = useState(false);
	const [checkingPageId, setCheckingPageId] = useState<string | null>(null);
	const [showInlineAdd, setShowInlineAdd] = useState(false);
	const [newSubPath, setNewSubPath] = useState("");
	const [newSubLabel, setNewSubLabel] = useState("");
	const [isSubmittingPage, setIsSubmittingPage] = useState(false);

	const rootPage = site.pages[0];
	const subPages = site.pages.slice(1);

	// Any page changed?
	const changedPages = site.pages.filter((p) => p.hasChange);
	const maxDiff = Math.max(0, ...site.pages.map((p) => p.diffPercent || 0));

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

	return (
		<div className="apple-card rounded-2xl p-6 transition-all duration-200 hover:shadow-lg border border-neutral-200/80 bg-white/90 relative overflow-hidden">
			{/* Top Domain Header Bar */}
			<div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-neutral-100">
				<div className="flex items-center gap-3.5">
					<div className="w-11 h-11 rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-200 border border-neutral-200/60 flex items-center justify-center font-bold text-neutral-700 text-sm shadow-inner uppercase tracking-wider">
						{site.domain.slice(0, 2)}
					</div>
					<div>
						<div className="flex items-center gap-2">
							<h3 className="font-semibold text-lg text-neutral-900 tracking-tight">{site.name || site.domain}</h3>
							<a
								href={site.rootUrl}
								target="_blank"
								rel="noreferrer"
								className="text-neutral-400 hover:text-neutral-700 transition-colors p-0.5 rounded"
								title={`Visit ${site.domain}`}
							>
								<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
								</svg>
							</a>
							{changedPages.length > 0 ? (
								<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 animate-pulse">
									<span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
									{changedPages.length} {changedPages.length === 1 ? "page" : "pages"} changed (max {maxDiff}%)
								</span>
							) : (
								<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200/60">
									<span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
									All pages quiet
								</span>
							)}
						</div>
						<div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500 font-mono">
							<span>{site.domain}</span>
							<span>•</span>
							<span>{site.pages.length} {site.pages.length === 1 ? "page" : "pages"} tracked</span>
							{rootPage?.lastChecked && (
								<>
									<span>•</span>
									<span>Updated {new Date(rootPage.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
								</>
							)}
						</div>
					</div>
				</div>

				{/* Site Control Actions */}
				<div className="flex items-center gap-2">
					<button
						onClick={handleCheckSite}
						disabled={isCheckingSite}
						className="btn-tactile px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
					>
						{isCheckingSite ? (
							<>
								<svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
									<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
								</svg>
								<span>Checking...</span>
							</>
						) : (
							<>
								<svg className="w-3.5 h-3.5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
								<span>Check Site</span>
							</>
						)}
					</button>

					<button
						onClick={() => {
							sounds.playClick();
							setShowInlineAdd(!showInlineAdd);
							if (!expanded) setExpanded(true);
						}}
						className="btn-tactile px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-200/80 flex items-center gap-1 cursor-pointer"
					>
						<svg className="w-3.5 h-3.5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
						</svg>
						<span>Add Page</span>
					</button>

					{subPages.length > 0 && (
						<button
							onClick={handleToggleExpand}
							className="btn-tactile px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200/80 flex items-center gap-1.5 cursor-pointer"
							title={expanded ? "Collapse sub-pages" : "Expand sub-pages"}
						>
							<span>{expanded ? `Hide Sub-pages (${subPages.length})` : `Show Sub-pages (${subPages.length})`}</span>
							<svg
								className={`w-3.5 h-3.5 text-neutral-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
							</svg>
						</button>
					)}

					<button
						onClick={() => {
							sounds.playTap();
							if (confirm(`Remove ${site.domain} and all its tracked sub-pages?`)) {
								onDeleteSite(site.id);
							}
						}}
						className="btn-tactile p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
						title="Delete site from monitor"
					>
						<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
					</button>
				</div>
			</div>

			{/* Root / Primary Page Hero Card */}
			{rootPage && (
				<div className="mt-5 p-4 rounded-xl bg-neutral-50/70 border border-neutral-200/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						{/* Screenshot Thumbnail Preview */}
						<div
							onClick={() => handleInspect(rootPage)}
							className="relative w-28 h-18 rounded-lg overflow-hidden bg-neutral-200 border border-neutral-300/80 cursor-pointer group shadow-xs shrink-0"
						>
							{rootPage.currentScreenshot ? (
								<img
									src={rootPage.currentScreenshot}
									alt="Root Page Capture"
									className="w-full h-full object-cover object-top transition-transform duration-200 group-hover:scale-105"
								/>
							) : (
								<div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-neutral-500 font-mono">
									<span>Capturing...</span>
								</div>
							)}
							<div className="absolute inset-0 bg-neutral-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-semibold tracking-wide">
								Inspect
							</div>
						</div>

						<div>
							<div className="flex items-center gap-2">
								<span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Root Page</span>
								<h4 className="font-medium text-sm text-neutral-900">{rootPage.name || "Homepage"}</h4>
							</div>
							<p className="text-xs text-neutral-500 font-mono mt-0.5">{rootPage.path || "/"}</p>
							<div className="flex items-center gap-2 mt-2">
								{rootPage.hasChange ? (
									<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800">
										<span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
										{rootPage.diffPercent}% changed ({rootPage.diffPixels.toLocaleString()} px)
									</span>
								) : (
									<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700">
										<span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
										No visual changes
									</span>
								)}
							</div>
						</div>
					</div>

					<div className="flex items-center gap-2 w-full md:w-auto justify-end">
						<button
							onClick={() => handleCheckPage(rootPage.id)}
							disabled={checkingPageId === rootPage.id}
							className="btn-tactile px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 shadow-xs cursor-pointer disabled:opacity-50"
						>
							{checkingPageId === rootPage.id ? "Checking..." : "Check Now"}
						</button>
						<button
							onClick={() => handleInspect(rootPage)}
							className="btn-tactile px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-white shadow-xs flex items-center gap-1 cursor-pointer"
						>
							<span>Inspect Diff</span>
							<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
							</svg>
						</button>
					</div>
				</div>
			)}

			{/* Sub-Pages Branching Tree Section */}
			<div className={`accordion-wrapper ${expanded ? "expanded" : ""}`}>
				<div className="accordion-inner">
					<div className="relative mt-6 pt-2 pl-4 sm:pl-8">
						{/* SVG Curved Tree Rail Lines */}
						{subPages.length > 0 && (
							<div className="absolute left-2 sm:left-4 top-0 bottom-6 w-8 pointer-events-none">
								<svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
									{/* Vertical Main Trunk Line */}
									<line
										x1="8"
										y1="0"
										x2="8"
										y2="100%"
										stroke="#e2e8f0"
										strokeWidth="2"
										strokeLinecap="round"
									/>
								</svg>
							</div>
						)}

						{/* Sub-Pages List */}
						<div className="space-y-3.5">
							{subPages.map((page) => {
								const isCheckingThisPage = checkingPageId === page.id;
								return (
									<div
										key={page.id}
										className="relative flex items-center justify-between p-3.5 rounded-xl bg-white border border-neutral-200/70 hover:border-neutral-300 hover:shadow-xs transition-all duration-150 pl-5 sm:pl-7 group"
									>
										{/* SVG Branch curve from trunk to node */}
										<div className="absolute -left-6 sm:-left-4 top-1/2 -translate-y-1/2 w-6 h-6 pointer-events-none">
											<svg className="w-6 h-6" viewBox="0 0 24 24">
												<path
													d="M 0,0 L 0,12 Q 0,20 12,20 L 24,20"
													fill="none"
													stroke="#cbd5e1"
													strokeWidth="2"
													strokeLinecap="round"
												/>
												<circle
													cx="18"
													cy="20"
													r="3.5"
													fill={page.hasChange ? "#f43f5e" : "#10b981"}
													stroke="#ffffff"
													strokeWidth="1.5"
												/>
											</svg>
										</div>

										<div className="flex items-center gap-3.5 min-w-0">
											{/* Thumbnail Preview */}
											<div
												onClick={() => handleInspect(page)}
												className="relative w-20 h-13 rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200 shrink-0 cursor-pointer shadow-2xs group/thumb"
											>
												{page.currentScreenshot ? (
													<img
														src={page.currentScreenshot}
														alt={page.name}
														className="w-full h-full object-cover object-top transition-transform duration-150 group-hover/thumb:scale-105"
													/>
												) : (
													<div className="w-full h-full flex items-center justify-center text-[9px] text-neutral-400 font-mono">
														Capturing
													</div>
												)}
												<div className="absolute inset-0 bg-neutral-900/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] font-semibold">
													Diff
												</div>
											</div>

											{/* Page Title & Path */}
											<div className="min-w-0">
												<div className="flex items-center gap-2">
													<h5 className="font-medium text-sm text-neutral-900 truncate">
														{page.name || page.path}
													</h5>
													<a
														href={page.url}
														target="_blank"
														rel="noreferrer"
														className="text-neutral-400 hover:text-neutral-700 transition-colors"
														title="Open URL"
													>
														<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
														</svg>
													</a>
												</div>
												<p className="text-xs text-neutral-500 font-mono truncate max-w-xs sm:max-w-md">
													{page.path}
												</p>
											</div>
										</div>

										{/* Right Status & Controls */}
										<div className="flex items-center gap-2.5 shrink-0">
											{page.hasChange ? (
												<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
													<span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
													{page.diffPercent}% changed
												</span>
											) : (
												<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-600">
													<span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
													Quiet
												</span>
											)}

											<button
												onClick={() => handleCheckPage(page.id)}
												disabled={isCheckingThisPage}
												className="btn-tactile px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 cursor-pointer disabled:opacity-50"
												title="Re-check this page now"
											>
												{isCheckingThisPage ? "..." : "Check"}
											</button>

											<button
												onClick={() => handleInspect(page)}
												className="btn-tactile px-3 py-1 rounded-md text-xs font-medium bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 shadow-2xs cursor-pointer"
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
												className="btn-tactile p-1 text-neutral-300 hover:text-rose-500 transition-colors cursor-pointer"
												title="Delete sub-page"
											>
												<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										</div>
									</div>
								);
							})}

							{/* Inline Add Sub-Page Form */}
							{showInlineAdd && (
								<form
									onSubmit={handleInlineSubmit}
									className="relative p-4 rounded-xl bg-neutral-50 border-2 border-dashed border-neutral-300 flex flex-col sm:flex-row items-center gap-3 pl-6"
								>
									<div className="flex-1 w-full flex items-center gap-2">
										<span className="text-xs font-mono text-neutral-500 shrink-0">
											{site.domain}/
										</span>
										<input
											type="text"
											placeholder="sub-path or full URL (e.g. notices or /pricing)"
											value={newSubPath}
											onChange={(e) => setNewSubPath(e.target.value)}
											className="w-full text-xs font-mono bg-white border border-neutral-200 rounded-lg px-3 py-2 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
											autoFocus
										/>
									</div>
									<div className="w-full sm:w-44">
										<input
											type="text"
											placeholder="Label (Optional)"
											value={newSubLabel}
											onChange={(e) => setNewSubLabel(e.target.value)}
											className="w-full text-xs bg-white border border-neutral-200 rounded-lg px-3 py-2 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
										/>
									</div>
									<div className="flex items-center gap-2 w-full sm:w-auto justify-end">
										<button
											type="button"
											onClick={() => setShowInlineAdd(false)}
											className="btn-tactile px-3 py-2 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-200/60 cursor-pointer"
										>
											Cancel
										</button>
										<button
											type="submit"
											disabled={isSubmittingPage || !newSubPath.trim()}
											className="btn-tactile px-4 py-2 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-white shadow-xs cursor-pointer disabled:opacity-50"
										>
											{isSubmittingPage ? "Adding..." : "Add Branch"}
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
