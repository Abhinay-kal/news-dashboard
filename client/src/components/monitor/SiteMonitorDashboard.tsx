import React, { useState, useEffect } from "react";
import type { MonitoredSite, MonitoredPage } from "./types";
import { SiteHierarchyCard } from "./SiteHierarchyCard";
import { PageDiffInspectorModal } from "./PageDiffInspectorModal";
import { sounds } from "../../utils/audioFeedback";
import { isWithin24Hours } from "../../utils/timeUtils";

type FilterTab = "all" | "unreviewed" | "inspected" | "quiet";
type CategoryTab = "all" | "national" | "counselling" | "iit";

export const SiteMonitorDashboard: React.FC = () => {
	const [sites, setSites] = useState<MonitoredSite[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// URL Input State
	const [urlInput, setUrlInput] = useState("");
	const [nameInput, setNameInput] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [isCheckingAll, setIsCheckingAll] = useState(false);
	const [isSeeding, setIsSeeding] = useState(false);

	// Filter & Search
	const [searchQuery, setSearchQuery] = useState("");
	const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>("all");
	const [categoryTab, setCategoryTab] = useState<CategoryTab>("all");

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

	// Mark site/page as inspected (recording 24h review timestamp)
	const handleMarkInspected = async (site: MonitoredSite, page: MonitoredPage) => {
		sounds.playClick();
		setInspectingItem({ site, page });

		try {
			await fetch(`/api/monitor/${site.id}/pages/${page.id}/inspect`, {
				method: "POST",
			});
			const now = new Date().toISOString();
			setSites((prev) =>
				prev.map((s) => {
					if (s.id !== site.id) return s;
					return {
						...s,
						lastInspected: now,
						pages: s.pages.map((p) => (p.id === page.id ? { ...p, lastInspected: now } : p)),
					};
				})
			);
		} catch {
			// Non-blocking
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

	// Seed / Reset to all 37 Official National & State Portals
	const handleSeedOfficial = async () => {
		sounds.playClick();
		setIsSeeding(true);
		try {
			const res = await fetch("/api/monitor/seed-official", { method: "POST" });
			if (!res.ok) throw new Error("Failed to seed official portals");
			sounds.playSuccess();
			await fetchSites();
		} catch (err: any) {
			alert(`Error loading portals: ${err.message}`);
		} finally {
			setIsSeeding(false);
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

	// Auto-domain detection for the paste input preview
	let detectedDomain = "";
	try {
		if (urlInput.trim().startsWith("http")) {
			detectedDomain = new URL(urlInput.trim()).hostname;
		}
	} catch {
		// Ignore
	}

	// Calculate counts
	const totalPages = sites.reduce((sum, s) => sum + s.pages.length, 0);
	const nationalCount = sites.filter((s) => s.category === "national").length;
	const counsellingCount = sites.filter((s) => s.category === "counselling").length;
	const iitCount = sites.filter((s) => s.category === "iit").length;
	const unreviewedDiffsCount = sites.filter(
		(s) => s.pages.some((p) => p.hasChange) && !isWithin24Hours(s.lastInspected)
	).length;
	const inspectedIn24hCount = sites.filter((s) => isWithin24Hours(s.lastInspected)).length;
	const quietSitesCount = sites.filter((s) => !s.pages.some((p) => p.hasChange)).length;

	// Filtered list
	const filteredSites = sites.filter((site) => {
		// Search filter
		const matchesSearch =
			site.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
			site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			site.pages.some(
				(p) =>
					p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					p.path.toLowerCase().includes(searchQuery.toLowerCase())
			);

		if (!matchesSearch) return false;

		// Category tab filter
		if (categoryTab === "national" && site.category !== "national") return false;
		if (categoryTab === "counselling" && site.category !== "counselling") return false;
		if (categoryTab === "iit" && site.category !== "iit") return false;

		// Review status tab filter
		const hasAnyChange = site.pages.some((p) => p.hasChange);
		const isInspected24h = isWithin24Hours(site.lastInspected);

		if (activeFilterTab === "unreviewed") {
			return hasAnyChange && !isInspected24h;
		}
		if (activeFilterTab === "inspected") {
			return isInspected24h;
		}
		if (activeFilterTab === "quiet") {
			return !hasAnyChange;
		}
		return true;
	});

	return (
		<div className="min-h-screen bg-[#fbfbfd] text-neutral-900 pb-24">
			{/* Top Hero Sticky Bar */}
			<div className="border-b border-neutral-200/80 bg-white/80 backdrop-blur-xl sticky top-16 z-40">
				<div className="max-w-[1720px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
					<div>
						<div className="flex items-center gap-2.5">
							<span className="w-2.5 h-2.5 rounded-full bg-neutral-900 animate-pulse" />
							<h1 className="text-xl font-bold tracking-tight text-neutral-900 m-0" style={{ color: "#171717" }}>
								Education & Counselling Portal Visual Diff Engine
							</h1>
							<span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
								{sites.length} Official Portals
							</span>
						</div>
						<p className="text-xs text-neutral-500 mt-1">
							National Examination Boards (CBSE, NTA, MCC, JoSAA) &amp; {counsellingCount} State Counselling Portals with 24-hour change tracking.
						</p>
					</div>

					{/* Right Quick Stats & Sound Toggle */}
					<div className="flex items-center gap-2.5">
						<div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-100/80 border border-neutral-200/60 text-xs font-mono">
							<span className="font-semibold text-neutral-800">{sites.length}</span>
							<span className="text-neutral-500">portals ({totalPages} paths)</span>
							<span className="text-neutral-300">•</span>
							<span className="font-semibold text-blue-700">{nationalCount} national</span>
							<span className="text-neutral-300">•</span>
							<span className="font-semibold text-amber-700">{counsellingCount} state</span>
							{unreviewedDiffsCount > 0 && (
								<>
									<span className="text-neutral-300">•</span>
									<span className="font-bold text-rose-600 animate-pulse">
										{unreviewedDiffsCount} unreviewed
									</span>
								</>
							)}
							{inspectedIn24hCount > 0 && (
								<>
									<span className="text-neutral-300">•</span>
									<span className="font-semibold text-indigo-600">
										{inspectedIn24hCount} reviewed
									</span>
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

			<div className="max-w-[1720px] mx-auto px-4 sm:px-6 pt-7 space-y-6">
				{error && (
					<div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
						<span>{error}</span>
						<button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-800 font-semibold cursor-pointer">✕</button>
					</div>
				)}

				{/* Quick Add URL Banner */}
				<div className="apple-card rounded-2xl p-5 border border-neutral-200/90 shadow-sm bg-white">
					<form onSubmit={handleAddTarget} className="space-y-3">
						<div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
							<div className="flex-1 relative">
								<input
									type="text"
									placeholder="Paste any government notice URL (e.g. https://nta.ac.in/NoticeBoard or state counselling portal)"
									value={urlInput}
									onChange={(e) => setUrlInput(e.target.value)}
									className="w-full text-xs sm:text-sm font-mono bg-neutral-50/70 border border-neutral-200 rounded-xl px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:bg-white transition-all"
								/>
								{detectedDomain && (
									<div className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-neutral-200/80 text-neutral-700 text-[10px] font-mono">
										branches into {detectedDomain}
									</div>
								)}
							</div>

							<div className="w-full md:w-52">
								<input
									type="text"
									placeholder="Portal Label (Optional)"
									value={nameInput}
									onChange={(e) => setNameInput(e.target.value)}
									className="w-full text-xs sm:text-sm bg-neutral-50/70 border border-neutral-200 rounded-xl px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:bg-white transition-all"
								/>
							</div>

							<button
								type="submit"
								disabled={isAdding || !urlInput.trim()}
								className="btn-tactile px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-neutral-900 hover:bg-neutral-800 text-white shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
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
								💡 Sub-pages sharing the same domain branch underneath their parent card with curved rails.
							</p>
							<button
								type="button"
								onClick={handleSeedOfficial}
								disabled={isSeeding}
								className="text-neutral-700 underline font-medium hover:text-black cursor-pointer disabled:opacity-50"
							>
								{isSeeding ? "Seeding official portals..." : "Re-Seed All Official Portals →"}
							</button>
						</div>
					</form>
				</div>

				{/* Primary Filter Toolbar */}
				<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
					{/* Category Segmented Filter Tabs */}
					<div className="flex items-center p-1 rounded-xl bg-neutral-200/60 border border-neutral-300/60 text-xs self-start">
						<button
							onClick={() => {
								sounds.playClick();
								setCategoryTab("all");
							}}
							className={`btn-tactile px-3.5 py-1.5 rounded-lg font-medium transition-all ${
								categoryTab === "all"
									? "bg-white text-neutral-900 shadow-2xs font-semibold"
									: "text-neutral-600 hover:text-neutral-900"
							}`}
						>
							All Portals ({sites.length})
						</button>
						<button
							onClick={() => {
								sounds.playClick();
								setCategoryTab("national");
							}}
							className={`btn-tactile px-3.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
								categoryTab === "national"
									? "bg-blue-600 text-white font-semibold shadow-2xs"
									: "text-neutral-600 hover:text-neutral-900"
							}`}
						>
							<span>National Boards ({nationalCount})</span>
						</button>
						<button
							onClick={() => {
								sounds.playClick();
								setCategoryTab("counselling");
							}}
							className={`btn-tactile px-3.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
								categoryTab === "counselling"
									? "bg-amber-600 text-white font-semibold shadow-2xs"
									: "text-neutral-600 hover:text-neutral-900"
							}`}
						>
							<span>State Counselling ({counsellingCount})</span>
						</button>
						<button
							onClick={() => {
								sounds.playClick();
								setCategoryTab("iit");
							}}
							className={`btn-tactile px-3.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
								categoryTab === "iit"
									? "bg-purple-600 text-white font-semibold shadow-2xs"
									: "text-neutral-600 hover:text-neutral-900"
							}`}
						>
							<span>IIT Portals ({iitCount})</span>
						</button>
					</div>

					{/* Right Action: Check All Portals */}
					<div className="flex items-center gap-2">
						<button
							onClick={handleCheckAll}
							disabled={isCheckingAll || sites.length === 0}
							className="btn-tactile px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-40"
						>
							{isCheckingAll ? (
								<>
									<svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
										<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
									</svg>
									<span>Checking All Portals...</span>
								</>
							) : (
								<>
									<svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
									</svg>
									<span>Check All Portals</span>
								</>
							)}
						</button>
					</div>
				</div>

				{/* Search & Review Status Pills */}
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-2 flex-1">
						{/* Search Input */}
						<div className="relative w-full sm:w-64">
							<input
								type="text"
								placeholder="Search portal name or state..."
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

						{/* Segmented Review Status Filter Pills */}
						<div className="flex items-center p-1 rounded-xl bg-neutral-100/90 border border-neutral-200/70 text-xs">
							<button
								onClick={() => {
									sounds.playClick();
									setActiveFilterTab("all");
								}}
								className={`btn-tactile px-3 py-1.5 rounded-lg font-medium transition-all ${
									activeFilterTab === "all"
										? "bg-white text-neutral-900 shadow-2xs font-semibold"
										: "text-neutral-600 hover:text-neutral-900"
								}`}
							>
								All Status ({sites.length})
							</button>

							<button
								onClick={() => {
									sounds.playClick();
									setActiveFilterTab("unreviewed");
								}}
								className={`btn-tactile px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
									activeFilterTab === "unreviewed"
										? "bg-rose-50 text-rose-700 border border-rose-200 font-bold shadow-2xs"
										: "text-neutral-600 hover:text-neutral-900"
								}`}
							>
								<span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
								<span>Needs Review ({unreviewedDiffsCount})</span>
							</button>

							<button
								onClick={() => {
									sounds.playClick();
									setActiveFilterTab("inspected");
								}}
								className={`btn-tactile px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
									activeFilterTab === "inspected"
										? "bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold shadow-2xs"
										: "text-neutral-600 hover:text-neutral-900"
								}`}
							>
								<span>✓</span>
								<span>Reviewed 24h ({inspectedIn24hCount})</span>
							</button>

							<button
								onClick={() => {
									sounds.playClick();
									setActiveFilterTab("quiet");
								}}
								className={`btn-tactile px-3 py-1.5 rounded-lg font-medium transition-all ${
									activeFilterTab === "quiet"
										? "bg-white text-neutral-900 shadow-2xs font-semibold"
										: "text-neutral-600 hover:text-neutral-900"
								}`}
							>
								Quiet ({quietSitesCount})
							</button>
						</div>
					</div>
				</div>

				{/* Multi-Card Row Grid Layout */}
				{loading ? (
					<div className="apple-card rounded-2xl p-12 text-center text-neutral-400 font-mono text-sm">
						Loading official education & state counselling portals...
					</div>
				) : filteredSites.length === 0 ? (
					<div className="apple-card rounded-2xl p-12 text-center border-2 border-dashed border-neutral-200 bg-white">
						<div className="w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center mx-auto mb-3 text-xl">
							🏛️
						</div>
						<h3 className="font-semibold text-neutral-900 text-base">No Matching Portals Found</h3>
						<p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 mb-5">
							{searchQuery || activeFilterTab !== "all" || categoryTab !== "all"
								? "Try switching category or review status tabs, or clearing your search."
								: "Click below to seed all National & State Counselling portals."}
						</p>
						<button
							onClick={handleSeedOfficial}
							disabled={isSeeding}
							className="btn-tactile px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm cursor-pointer disabled:opacity-50"
						>
							{isSeeding ? "Seeding..." : "Seed All Official Portals"}
						</button>
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
						{filteredSites.map((site) => (
							<SiteHierarchyCard
								key={site.id}
								site={site}
								onCheckSite={handleCheckSite}
								onCheckPage={handleCheckPage}
								onDeleteSite={handleDeleteSite}
								onDeletePage={handleDeletePage}
								onInspectPage={handleMarkInspected}
								onAddSubPage={handleAddSubPage}
							/>
						))}
					</div>
				)}
			</div>

			{/* Full Diff Inspector Modal */}
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
