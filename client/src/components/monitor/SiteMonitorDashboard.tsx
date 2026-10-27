import React, { useState, useEffect } from "react";
import type { MonitoredSite, MonitoredPage } from "./types";
import { SiteHierarchyCard } from "./SiteHierarchyCard";
import { PageDiffInspectorModal } from "./PageDiffInspectorModal";
import { sounds } from "../../utils/audioFeedback";

export const SiteMonitorDashboard: React.FC = () => {
	const [sites, setSites] = useState<MonitoredSite[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// URL Input State
	const [urlInput, setUrlInput] = useState("");
	const [nameInput, setNameInput] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [isCheckingAll, setIsCheckingAll] = useState(false);

	// Filter & Search
	const [searchQuery, setSearchQuery] = useState("");
	const [filterChangedOnly, setFilterChangedOnly] = useState(false);

	// Sound Muted State
	const [isMuted, setIsMuted] = useState(sounds.isMuted());

	// Inspector Modal State
	const [inspectingItem, setInspectingItem] = useState<{
		site: MonitoredSite;
		page: MonitoredPage;
	} | null>(null);

	// Fetch all monitored sites
	const fetchSites = async () => {
		try {
			const res = await fetch("/api/monitor");
			if (!res.ok) throw new Error(`HTTP error ${res.status}`);
			const data = await res.json();
			setSites(Array.isArray(data) ? data : []);
			setError(null);
		} catch (err: any) {
			console.error("Failed to fetch monitored sites:", err);
			setError("Failed to load monitored sites");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchSites();
		const interval = setInterval(fetchSites, 15000);
		return () => clearInterval(interval);
	}, []);

	// Handle Sound Toggle
	const handleToggleSound = () => {
		const newMuted = sounds.toggleMute();
		setIsMuted(newMuted);
		if (!newMuted) {
			sounds.playClick();
		}
	};

	// Add new target URL
	const handleAddTarget = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!urlInput.trim()) return;

		sounds.playClick();
		setIsAdding(true);
		try {
			const res = await fetch("/api/monitor", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: urlInput.trim(),
					name: nameInput.trim() || undefined,
				}),
			});

			if (!res.ok) throw new Error("Failed to add target");
			sounds.playSuccess();
			setUrlInput("");
			setNameInput("");
			await fetchSites();
		} catch (err: any) {
			alert(`Error adding URL: ${err.message}`);
		} finally {
			setIsAdding(false);
		}
	};

	// Add sub-page to existing site
	const handleAddSubPage = async (siteId: string, url: string, name?: string) => {
		try {
			const res = await fetch("/api/monitor", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url,
					name,
					parentSiteId: siteId,
				}),
			});
			if (!res.ok) throw new Error("Failed to add sub-page");
			sounds.playSuccess();
			await fetchSites();
		} catch (err: any) {
			alert(`Error adding sub-page: ${err.message}`);
		}
	};

	// Recheck single page
	const handleCheckPage = async (siteId: string, pageId: string) => {
		try {
			const res = await fetch(`/api/monitor/${siteId}/pages/${pageId}/check`, {
				method: "POST",
			});
			if (!res.ok) throw new Error("Check failed");
			const updatedPage = await res.json();
			if (updatedPage.hasChange) {
				sounds.playDiffChime();
			} else {
				sounds.playSuccess();
			}
			await fetchSites();
		} catch (err: any) {
			alert(`Check failed: ${err.message}`);
		}
	};

	// Recheck entire site
	const handleCheckSite = async (siteId: string) => {
		try {
			const res = await fetch(`/api/monitor/${siteId}/check`, {
				method: "POST",
			});
			if (!res.ok) throw new Error("Site check failed");
			sounds.playSuccess();
			await fetchSites();
		} catch (err: any) {
			alert(`Site check failed: ${err.message}`);
		}
	};

	// Check all sites
	const handleCheckAll = async () => {
		sounds.playClick();
		setIsCheckingAll(true);
		try {
			const res = await fetch("/api/monitor/check-all", { method: "POST" });
			if (!res.ok) throw new Error("Check all failed");
			sounds.playSuccess();
			await fetchSites();
		} catch (err: any) {
			alert(`Failed to check all: ${err.message}`);
		} finally {
			setIsCheckingAll(false);
		}
	};

	// Delete sub-page
	const handleDeletePage = async (siteId: string, pageId: string) => {
		try {
			const res = await fetch(`/api/monitor/${siteId}/pages/${pageId}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Delete failed");
			sounds.playTap();
			await fetchSites();
		} catch (err: any) {
			alert(`Delete failed: ${err.message}`);
		}
	};

	// Delete entire site
	const handleDeleteSite = async (siteId: string) => {
		try {
			const res = await fetch(`/api/monitor/${siteId}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Delete site failed");
			sounds.playTap();
			await fetchSites();
		} catch (err: any) {
			alert(`Delete site failed: ${err.message}`);
		}
	};

	// Load Sample Showcase for the Windows user
	const handleLoadSamples = async () => {
		sounds.playClick();
		try {
			// Add sample targets
			await fetch("/api/monitor", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: "https://example.com",
					name: "Example Domain Showcase",
				}),
			});
			await fetch("/api/monitor", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: "https://example.com/notices",
					name: "Public Notices",
				}),
			});
			await fetch("/api/monitor", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: "https://example.com/pricing",
					name: "Subscription Tiers",
				}),
			});
			sounds.playSuccess();
			await fetchSites();
		} catch (err: any) {
			alert(`Failed to load samples: ${err.message}`);
		}
	};

	// Auto-domain detection for the paste input preview
	let detectedDomain = "";
	try {
		if (urlInput.trim().startsWith("http")) {
			detectedDomain = new URL(urlInput.trim()).hostname;
		}
	} catch {
		// Ignore invalid URL typing
	}

	// Filtered list
	const filteredSites = sites.filter((site) => {
		const matchesSearch =
			site.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
			site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			site.pages.some((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.path.toLowerCase().includes(searchQuery.toLowerCase()));

		if (!matchesSearch) return false;
		if (filterChangedOnly) {
			return site.pages.some((p) => p.hasChange);
		}
		return true;
	});

	// Totals
	const totalPages = sites.reduce((sum, s) => sum + s.pages.length, 0);
	const totalChanged = sites.reduce(
		(sum, s) => sum + s.pages.filter((p) => p.hasChange).length,
		0
	);

	return (
		<div className="min-h-screen bg-[#fbfbfd] text-neutral-900 pb-20">
			{/* Top Hero Header Bar */}
			<div className="border-b border-neutral-200/80 bg-white/80 backdrop-blur-xl sticky top-16 z-40">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
					<div>
						<div className="flex items-center gap-2.5">
							<span className="w-2.5 h-2.5 rounded-full bg-neutral-900 animate-pulse" />
							<h1 className="text-xl font-bold tracking-tight text-neutral-900 m-0">
								Site & Page Visual Diff Engine
							</h1>
							<span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
								v1.2 Studio Craft
							</span>
						</div>
						<p className="text-xs text-neutral-500 mt-1">
							Hierarchical per-site page diffing with pixel highlighting, branch rails, and clip-path comparisons.
						</p>
					</div>

					{/* Right Quick Stats & Sound Toggle */}
					<div className="flex items-center gap-2.5">
						<div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100/80 border border-neutral-200/60 text-xs font-mono">
							<span className="font-semibold text-neutral-800">{sites.length}</span>
							<span className="text-neutral-500">sites</span>
							<span className="text-neutral-300">•</span>
							<span className="font-semibold text-neutral-800">{totalPages}</span>
							<span className="text-neutral-500">pages</span>
							{totalChanged > 0 && (
								<>
									<span className="text-neutral-300">•</span>
									<span className="font-bold text-rose-600 animate-pulse">{totalChanged} changed</span>
								</>
							)}
						</div>

						{/* Sound Toggle Button */}
						<button
							onClick={handleToggleSound}
							className={`btn-tactile p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
								isMuted
									? "bg-neutral-100 text-neutral-400 border-neutral-200"
									: "bg-white text-neutral-800 border-neutral-300 shadow-2xs"
							}`}
							title={isMuted ? "Unmute audio feedback" : "Mute audio feedback"}
						>
							{isMuted ? (
								<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
								</svg>
							) : (
								<svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
								</svg>
							)}
						</button>
					</div>
				</div>
			</div>

			<div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
				{/* Quick Add URL Banner */}
				<div className="apple-card rounded-2xl p-6 border border-neutral-200/90 shadow-sm bg-white">
					<form onSubmit={handleAddTarget} className="space-y-4">
						<div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
							<div className="flex-1 relative">
								<input
									type="text"
									placeholder="Paste any URL e.g. https://example.com/notices or https://stripe.com/pricing"
									value={urlInput}
									onChange={(e) => setUrlInput(e.target.value)}
									className="w-full text-sm font-mono bg-neutral-50/70 border border-neutral-200 rounded-xl px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:bg-white transition-all"
								/>
								{detectedDomain && (
									<div className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-neutral-200/80 text-neutral-700 text-[11px] font-mono">
										branches into {detectedDomain}
									</div>
								)}
							</div>

							<div className="w-full md:w-56">
								<input
									type="text"
									placeholder="Label (Optional)"
									value={nameInput}
									onChange={(e) => setNameInput(e.target.value)}
									className="w-full text-sm bg-neutral-50/70 border border-neutral-200 rounded-xl px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:bg-white transition-all"
								/>
							</div>

							<button
								type="submit"
								disabled={isAdding || !urlInput.trim()}
								className="btn-tactile px-6 py-3 rounded-xl text-sm font-semibold bg-neutral-900 hover:bg-neutral-800 text-white shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
							>
								{isAdding ? (
									<>
										<svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
											<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
											<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
										</svg>
										<span>Capturing...</span>
									</>
								) : (
									<>
										<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
										</svg>
										<span>Add Target</span>
									</>
								)}
							</button>
						</div>

						<div className="flex flex-wrap items-center justify-between text-xs text-neutral-500 pt-1">
							<p>
								💡 Sub-pages sharing the same domain automatically branch underneath their parent card with curved rails.
							</p>
							{sites.length === 0 && (
								<button
									type="button"
									onClick={handleLoadSamples}
									className="text-neutral-700 underline font-medium hover:text-black cursor-pointer"
								>
									Load Sample Showcase Sites →
								</button>
							)}
						</div>
					</form>
				</div>

				{/* Toolbar / Search & Filters */}
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="flex items-center gap-2.5 flex-1 max-w-md">
						<div className="relative w-full">
							<input
								type="text"
								placeholder="Search sites, sub-paths, or labels..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full text-xs bg-white border border-neutral-200/80 rounded-xl pl-9 pr-4 py-2 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
							/>
							<svg
								className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
							</svg>
						</div>

						<button
							onClick={() => {
								sounds.playTap();
								setFilterChangedOnly(!filterChangedOnly);
							}}
							className={`btn-tactile px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 shrink-0 cursor-pointer ${
								filterChangedOnly
									? "bg-rose-50 text-rose-700 border-rose-300 font-semibold"
									: "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
							}`}
						>
							<span className={`w-2 h-2 rounded-full ${filterChangedOnly ? "bg-rose-500" : "bg-neutral-300"}`} />
							<span>Changed Only</span>
						</button>
					</div>

					<div className="flex items-center gap-2">
						<button
							onClick={handleCheckAll}
							disabled={isCheckingAll || sites.length === 0}
							className="btn-tactile px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-40"
						>
							{isCheckingAll ? (
								<>
									<svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
										<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
									</svg>
									<span>Checking All...</span>
								</>
							) : (
								<>
									<svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
									</svg>
									<span>Check All Sites</span>
								</>
							)}
						</button>
					</div>
				</div>

				{/* Sites Hierarchy Cards Grid */}
				{loading ? (
					<div className="apple-card rounded-2xl p-12 text-center text-neutral-400 font-mono text-sm">
						Loading monitored sites...
					</div>
				) : filteredSites.length === 0 ? (
					<div className="apple-card rounded-2xl p-12 text-center border-2 border-dashed border-neutral-200 bg-white">
						<div className="w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center mx-auto mb-3 text-xl">
							🌐
						</div>
						<h3 className="font-semibold text-neutral-900 text-base">No Monitored Sites Found</h3>
						<p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 mb-5">
							Paste any website or webpage URL above to start tracking visual pixel changes with automatic tree branching.
						</p>
						<button
							onClick={handleLoadSamples}
							className="btn-tactile px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm cursor-pointer"
						>
							Load Sample Showcase Sites
						</button>
					</div>
				) : (
					<div className="space-y-6">
						{filteredSites.map((site) => (
							<SiteHierarchyCard
								key={site.id}
								site={site}
								onCheckSite={handleCheckSite}
								onCheckPage={handleCheckPage}
								onDeleteSite={handleDeleteSite}
								onDeletePage={handleDeletePage}
								onInspectPage={(s, p) => setInspectingItem({ site: s, page: p })}
								onAddSubPage={handleAddSubPage}
							/>
						))}
					</div>
				)}
			</div>

			{/* Inspector Modal */}
			{inspectingItem && (
				<PageDiffInspectorModal
					site={inspectingItem.site}
					page={inspectingItem.page}
					onClose={() => setInspectingItem(null)}
					onRecheck={handleCheckPage}
				/>
			)}
		</div>
	);
};
