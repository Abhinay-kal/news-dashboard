import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState, useEffect, useRef, useMemo } from "react";
import ArticleCard, { type Article } from "./ArticleCard";

const API_URL = "/api";

import { P0ScraperPreview } from "./P0ScraperPreview";

export default function DailyView() {
	const queryClient = useQueryClient();
	// State for the currently viewed date (defaults to today)
	const [runDate, setRunDate] = useState(
		() => new Date().toISOString().split("T")[0],
	);
	const [manualInput, setManualInput] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const searchInputRef = useRef<HTMLInputElement>(null);
	const [isAdding, setIsAdding] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [refreshProgress, setRefreshProgress] = useState("");

	// Global keyboard shortcuts: '/' or 'Cmd+K' / 'Ctrl+K' jumps to today search bar
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const activeTag = document.activeElement?.tagName.toLowerCase();
			const isTyping = activeTag === "input" || activeTag === "textarea";

			if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
				setSearchQuery("");
				searchInputRef.current?.blur();
				return;
			}

			if ((e.key === "/" && !isTyping) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
				e.preventDefault();
				searchInputRef.current?.focus();
				searchInputRef.current?.select();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	// Fetch articles using React Query
	const {
		data: articles = [],
		isLoading,
		isError,
	} = useQuery({
		queryKey: ["articles", runDate],
		queryFn: async () => {
			const response = await axios.get<Article[]>(`${API_URL}/articles`, {
				params: { runDate },
			});
			return response.data;
		},
		refetchInterval: isRefreshing ? 3000 : false,
	});

	// Auto-detect if a background scrape job is currently running on mount or date change
	useEffect(() => {
		let interval: ReturnType<typeof setInterval> | null = null;
		const checkStatus = async () => {
			try {
				const statusRes = await fetch(`${API_URL}/refresh/status`);
				const status = await statusRes.json();
				if (status.isScraping) {
					setIsRefreshing(true);
					setRefreshProgress(status.message);
					if (!interval) {
						interval = setInterval(async () => {
							try {
								const sRes = await fetch(`${API_URL}/refresh/status`);
								const s = await sRes.json();
								if (s.isScraping) {
									setRefreshProgress(s.message);
									queryClient.invalidateQueries({ queryKey: ["articles", runDate] });
								} else {
									if (interval) clearInterval(interval);
									setIsRefreshing(false);
									setRefreshProgress("");
									queryClient.invalidateQueries({ queryKey: ["articles", runDate] });
								}
							} catch (e) {
								console.error("Status polling error", e);
							}
						}, 2500);
					}
				}
			} catch (e) {
				console.error("Failed to check scraping status", e);
			}
		};

		checkStatus();

		return () => {
			if (interval) clearInterval(interval);
		};
	}, [runDate, queryClient]);

	// Mutation to update article status
	const updateStatusMutation = useMutation({
		mutationFn: async ({
			id,
			status,
		}: {
			id: string;
			status: "APPROVED" | "REJECTED" | "PENDING";
		}) => {
			await axios.patch(`${API_URL}/articles/${id}/status`, { status });
		},
		onSuccess: () => {
			// Invalidate the cache to trigger a refetch and update UI
			queryClient.invalidateQueries({ queryKey: ["articles", runDate] });
		},
	});

	// Mutation to update article post status
	const updatePostStatusMutation = useMutation({
		mutationFn: async ({
			id,
			postStatus,
		}: {
			id: string;
			postStatus: "PENDING" | "POSTED" | "NOT_POSTED";
		}) => {
			await axios.patch(`${API_URL}/articles/${id}/postStatus`, { postStatus });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["articles", runDate] });
		},
	});

	// Mutation to delete an article
	const deleteArticleMutation = useMutation({
		mutationFn: async (id: string) => {
			await axios.delete(`${API_URL}/articles/${id}`);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["articles", runDate] });
		},
	});

	// Mutation to assign an article
	const updateAssignMutation = useMutation({
		mutationFn: async ({ id, assignedTo }: { id: string; assignedTo: string }) => {
			await axios.patch(`${API_URL}/articles/${id}/assign`, { assignedTo });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["articles", runDate] });
		},
	});

	// Mutation to send email notification via Resend
	const notifyWriterMutation = useMutation({
		mutationFn: async (id: string) => {
			await axios.post(`${API_URL}/articles/${id}/notify`);
		},
		onSuccess: () => {
			alert("Email sent successfully!");
		},
		onError: (error: any) => {
			console.error(error);
			alert(`Failed to send email. Error: ${error?.response?.data?.error || error.message}`);
		}
	});

	// Date Navigation Helpers
	const changeDate = (days: number) => {
		const date = new Date(runDate);
		date.setDate(date.getDate() + days);
		setRunDate(date.toISOString().split("T")[0]);
	};

	const handleStatusChange = (
		id: string,
		newStatus: "APPROVED" | "REJECTED" | "PENDING",
	) => {
		updateStatusMutation.mutate({ id, status: newStatus });
	};

	const handlePostStatusChange = (
		id: string,
		newStatus: "PENDING" | "POSTED" | "NOT_POSTED",
	) => {
		updatePostStatusMutation.mutate({ id, postStatus: newStatus });
	};

	const handleDelete = (id: string) => {
		deleteArticleMutation.mutate(id);
	};

	const handleAssign = (id: string, assignedTo: string) => {
		updateAssignMutation.mutate({ id, assignedTo });
	};

	const handleNotify = (id: string) => {
		notifyWriterMutation.mutate(id);
	};

	const handleManualSubmit = async () => {
		if (!manualInput.trim()) return;
		setIsAdding(true);
		try {
			const res = await fetch(`${API_URL}/articles/manual`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input: manualInput }),
			});
			if (!res.ok) throw new Error("Failed to add article");
			
			// Refresh articles list
			queryClient.invalidateQueries({ queryKey: ["articles", runDate] });
			setManualInput("");
		} catch (error) {
			console.error(error);
			alert("Error adding manual article or no articles found. Check console for details.");
		} finally {
			setIsAdding(false);
		}
	};

	const handleRefresh = async () => {
		setIsRefreshing(true);
		setRefreshProgress("Starting...");
		try {
			await fetch(`${API_URL}/refresh`, { method: "POST" });
			
			// Start polling for status
			const interval = setInterval(async () => {
				try {
					const statusRes = await fetch(`${API_URL}/refresh/status`);
					const status = await statusRes.json();
					if (status.isScraping) {
						setRefreshProgress(status.message);
						queryClient.invalidateQueries({ queryKey: ["articles", runDate] });
					} else {
						clearInterval(interval);
						setIsRefreshing(false);
						setRefreshProgress("");
						queryClient.invalidateQueries({ queryKey: ["articles", runDate] });
					}
				} catch (err) {
					console.error("Failed to fetch status", err);
				}
			}, 2000);
			
		} catch (error) {
			console.error(error);
			alert("Error starting refresh job.");
			setIsRefreshing(false);
			setRefreshProgress("");
		}
	};

	const handleScrapeAndEmail = async () => {
		setIsRefreshing(true);
		setRefreshProgress("Starting (w/ Email)...");
		try {
			await fetch(`${API_URL}/scrape-and-email`, { method: "POST" });
			
			// Start polling for status
			const interval = setInterval(async () => {
				try {
					const statusRes = await fetch(`${API_URL}/refresh/status`);
					const status = await statusRes.json();
					if (status.isScraping) {
						setRefreshProgress(status.message);
						queryClient.invalidateQueries({ queryKey: ["articles", runDate] });
					} else {
						clearInterval(interval);
						setIsRefreshing(false);
						setRefreshProgress("");
						queryClient.invalidateQueries({ queryKey: ["articles", runDate] });
						alert("Scraping finished. Emails are being sent now!");
					}
				} catch (err) {
					console.error("Failed to fetch status", err);
				}
			}, 2000);
			
		} catch (error) {
			console.error(error);
			alert("Error starting scrape & email job.");
			setIsRefreshing(false);
			setRefreshProgress("");
		}
	};

	// Clean search query
	const cleanQuery = searchQuery.trim().toLowerCase();

	// Live client-side filtered articles
	const filteredArticles = useMemo(() => {
		if (!cleanQuery) return articles;
		return articles.filter(article => {
			const title = (article.title || "").toLowerCase();
			const summaryText = (article.summary || []).join(" ").toLowerCase();
			const source = (article.sourceUrl || "").toLowerCase();
			const category = (article.topicCategory || "").toLowerCase();
			const assigned = (article.assignedTo || "").toLowerCase();

			return (
				title.includes(cleanQuery) ||
				summaryText.includes(cleanQuery) ||
				source.includes(cleanQuery) ||
				category.includes(cleanQuery) ||
				assigned.includes(cleanQuery)
			);
		});
	}, [articles, cleanQuery]);

	// Filtered sections
	const p0Articles = useMemo(
		() => filteredArticles.filter(a => a.topicCategory === "P0_ALERT"),
		[filteredArticles]
	);
	const mainSiteArticles = useMemo(
		() => filteredArticles.filter(a => a.topicCategory === "Main_Site_News"),
		[filteredArticles]
	);
	const regularArticles = useMemo(
		() => filteredArticles.filter(a => a.topicCategory !== "P0_ALERT" && a.topicCategory !== "Main_Site_News"),
		[filteredArticles]
	);

	// Cluster regular articles
	const clusteredArticles = useMemo(
		() => Object.values(
			regularArticles.reduce((acc, article) => {
				const id = article.storyId || article._id;
				if (!acc[id]) acc[id] = [];
				acc[id].push(article);
				return acc;
			}, {} as Record<string, Article[]>)
		),
		[regularArticles]
	);

	return (
		<div className="w-full py-8 px-[80px]">
			{/* Header and Date Navigation */}
			<header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 gap-4 sm:gap-0">
				<div>
					<h1 className="text-2xl font-bold text-black">Daily Curation</h1>
					<p className="text-gray-500 text-sm">
						Reviewing articles for {runDate}
					</p>
				</div>

				<div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
					<button
						type="button"
						onClick={handleScrapeAndEmail}
						disabled={isRefreshing}
						className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium focus:outline-none transition-colors disabled:opacity-50 shrink-0 cursor-pointer min-w-[170px]"
					>
						{isRefreshing ? (
							<span className="flex items-center gap-2 justify-center">
								<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
								{refreshProgress || "Running..."}
							</span>
						) : "Scrape & Email News"}
					</button>
					<button
						type="button"
						onClick={handleRefresh}
						disabled={isRefreshing}
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium focus:outline-none transition-colors disabled:opacity-50 shrink-0 cursor-pointer min-w-[150px]"
					>
						{isRefreshing ? (
							<span className="flex items-center gap-2 justify-center">
								<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
								Running...
							</span>
						) : "Run Scraping Only"}
					</button>
					<button
						type="button"
						onClick={() => changeDate(-1)}
						className="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer"
						aria-label="Previous Day"
					>
						← Prev
					</button>
					<span className="font-semibold text-gray-800">{runDate}</span>
					<button
						type="button"
						onClick={() => changeDate(1)}
						className="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer"
						aria-label="Next Day"
					>
						Next →
					</button>
				</div>
			</header>

			{/* Manual Add Section */}
			<div className="mb-8 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
				<input 
					type="text" 
					placeholder="Paste article URL or topic to manually scrape & add to database..." 
					className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
					value={manualInput}
					onChange={(e) => setManualInput(e.target.value)}
					disabled={isAdding}
				/>
				<button 
					type="button"
					onClick={handleManualSubmit} 
					disabled={isAdding || !manualInput}
					className="px-6 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 transition-colors shrink-0 cursor-pointer text-sm"
				>
					{isAdding ? "Searching & Parsing..." : "Add Article"}
				</button>
			</div>

			<P0ScraperPreview />

			{/* Prominent Live Search Bar for Today Scraped Articles */}
			<div className="mb-8 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-200/90 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
				<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
					<div className="relative flex-1 flex items-center">
						<div className="absolute left-3.5 text-gray-400 pointer-events-none flex items-center">
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
							</svg>
						</div>
						<input
							ref={searchInputRef}
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search today's scraped articles (by title, portal, summary, keyword)..."
							className="w-full pl-11 pr-24 py-2.5 bg-gray-50/70 hover:bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-500 transition-colors text-sm font-medium"
						/>
						<div className="absolute right-3 flex items-center gap-1.5">
							{searchQuery ? (
								<button
									type="button"
									onClick={() => {
										setSearchQuery("");
										searchInputRef.current?.focus();
									}}
									className="p-1 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
									title="Clear search (Esc)"
								>
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							) : (
								<div className="hidden sm:flex items-center gap-1">
									<kbd className="px-1.5 py-0.5 text-[11px] font-mono text-gray-400 bg-gray-100 rounded border border-gray-200 shadow-2xs">
										/
									</kbd>
									<span className="text-gray-300 text-xs">or</span>
									<kbd className="px-1.5 py-0.5 text-[11px] font-mono text-gray-400 bg-gray-100 rounded border border-gray-200 shadow-2xs">
										⌘K
									</kbd>
								</div>
							)}
						</div>
					</div>

					<div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
						<span className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
							cleanQuery 
								? filteredArticles.length > 0
									? "bg-blue-50 text-blue-700 border-blue-200"
									: "bg-amber-50 text-amber-700 border-amber-200"
								: "bg-gray-100 text-gray-600 border-gray-200"
						}`}>
							{cleanQuery
								? `Showing ${filteredArticles.length} of ${articles.length} articles`
								: `${articles.length} articles scraped for ${runDate}`}
						</span>
						{cleanQuery && (
							<button
								type="button"
								onClick={() => setSearchQuery("")}
								className="text-xs text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2 cursor-pointer"
							>
								Reset
							</button>
						)}
					</div>
				</div>
			</div>

			{/* Loading & Error States */}
			{isLoading && (
				<div className="text-center py-12 text-gray-500">
					<div
						className="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-blue-600 rounded-full"
						role="status"
						aria-label="loading"
					></div>
					<p className="mt-4">Loading articles...</p>
				</div>
			)}

			{isError && (
				<div className="text-center py-12 text-red-500 bg-red-50 rounded-xl flex flex-col items-center justify-center gap-3">
					<p className="font-semibold">
						Error loading articles. Please ensure the backend is running.
					</p>
					<button
						onClick={() => queryClient.invalidateQueries({ queryKey: ["articles", runDate] })}
						className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition cursor-pointer shadow-sm"
					>
						Retry Connection
					</button>
				</div>
			)}

			{/* Article List */}
			{!isLoading && !isError && articles.length === 0 && (
				<div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
					{isRefreshing ? (
						<div className="flex flex-col items-center justify-center gap-2">
							<div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
							<p className="text-base font-semibold text-gray-800">Scraping in progress ({refreshProgress || "Running..."})</p>
							<p className="text-sm text-gray-500">Articles will appear live on this screen as they are parsed and verified.</p>
						</div>
					) : (
						<p className="text-lg">No articles found for this date.</p>
					)}
				</div>
			)}

			{/* Search No Results State */}
			{!isLoading && !isError && articles.length > 0 && filteredArticles.length === 0 && cleanQuery && (
				<div className="text-center py-14 bg-white rounded-2xl border border-gray-200/90 shadow-sm flex flex-col items-center justify-center gap-3">
					<div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
						🔍
					</div>
					<h3 className="text-lg font-bold text-gray-900">No articles match your search</h3>
					<p className="text-sm text-gray-500 max-w-md">
						No scraped articles for <span className="font-semibold text-gray-800">{runDate}</span> match <span className="font-semibold text-blue-600">"{searchQuery}"</span>.
					</p>
					<button
						type="button"
						onClick={() => {
							setSearchQuery("");
							searchInputRef.current?.focus();
						}}
						className="mt-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer shadow-sm"
					>
						Clear Search Query
					</button>
				</div>
			)}

			{!isLoading && !isError && filteredArticles.length > 0 && (
				<>
					{/* P0 Mission Critical Section */}
					{p0Articles.length > 0 && (
						<div className="mb-10">
							<h2 className="text-xl font-bold text-red-600 flex items-center gap-2 mb-4">
								<span className="relative flex h-3 w-3">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
									<span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
								</span>
								P0 Mission Critical Updates ({p0Articles.length})
							</h2>
							<div className="space-y-6">
								{p0Articles.map(article => (
									<div key={article._id} className="ring-2 ring-red-500 rounded-2xl shadow-lg">
										<ArticleCard
											article={article}
											onStatusChange={handleStatusChange}
											onPostStatusChange={handlePostStatusChange}
											onDelete={handleDelete}
											onAssign={handleAssign}
											onNotify={handleNotify}
										/>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Main Site News Section */}
					{mainSiteArticles.length > 0 && (
						<div className="mb-10">
							<h2 className="text-xl font-bold text-blue-600 flex items-center gap-2 mb-4">
								<span className="relative flex h-3 w-3">
									<span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
								</span>
								Main Site News (48-hour Freshness) ({mainSiteArticles.length})
							</h2>
							<div className="space-y-6">
								{mainSiteArticles.map(article => (
									<div key={article._id} className="ring-2 ring-blue-500 rounded-2xl shadow-sm">
										<ArticleCard
											article={article}
											onStatusChange={handleStatusChange}
											onPostStatusChange={handlePostStatusChange}
											onDelete={handleDelete}
											onAssign={handleAssign}
											onNotify={handleNotify}
										/>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Regular Articles Section */}
					{clusteredArticles.length > 0 && (
						<div>
							<h2 className="text-xl font-bold text-gray-800 mb-4">
								Daily News Feed ({regularArticles.length})
							</h2>
							<div className="space-y-8">
								{clusteredArticles.map(group => {
									const mainArticle = group[0];
									const duplicates = group.slice(1);
								
								return (
									<div key={mainArticle.storyId || mainArticle._id} className="relative">
										<ArticleCard
											article={mainArticle}
											onStatusChange={handleStatusChange}
											onPostStatusChange={handlePostStatusChange}
											onDelete={handleDelete}
											onAssign={handleAssign}
											onNotify={handleNotify}
										/>
										
										{duplicates.length > 0 && (
											<div className="mt-3 ml-6 pl-4 border-l-2 border-gray-200">
												<details className="group cursor-pointer">
													<summary className="text-sm font-medium text-gray-500 hover:text-gray-700 list-none flex items-center gap-2">
														<span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
															+{duplicates.length} duplicate {duplicates.length === 1 ? 'source' : 'sources'}
														</span>
														<span className="text-xs group-open:hidden">Click to view</span>
														<span className="text-xs hidden group-open:inline">Hide duplicates</span>
													</summary>
													<div className="mt-4 space-y-4">
														{duplicates.map(dup => (
															<div key={dup._id} className="opacity-80 scale-[0.98] transform origin-top-left">
																<ArticleCard
																	article={dup}
																	onStatusChange={handleStatusChange}
																	onPostStatusChange={handlePostStatusChange}
																	onDelete={handleDelete}
																	onAssign={handleAssign}
																	onNotify={handleNotify}
																/>
															</div>
														))}
													</div>
												</details>
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
					)}
				</>
			)}
		</div>
	);
}
