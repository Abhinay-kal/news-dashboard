import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import ArticleCard, { type Article } from "./ArticleCard";

const API_URL = "http://localhost:5001/api";

export default function DailyView() {
	const queryClient = useQueryClient();
	// State for the currently viewed date (defaults to today)
	const [runDate, setRunDate] = useState(
		() => new Date().toISOString().split("T")[0],
	);
	const [manualInput, setManualInput] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [refreshProgress, setRefreshProgress] = useState("");

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
	});

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

	// Cluster regular articles
	const regularArticles = articles.filter(a => a.topicCategory !== "P0_ALERT");
	const clusteredArticles = Object.values(
		regularArticles.reduce((acc, article) => {
			const id = article.storyId || article._id;
			if (!acc[id]) acc[id] = [];
			acc[id].push(article);
			return acc;
		}, {} as Record<string, Article[]>)
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
						onClick={handleRefresh}
						disabled={isRefreshing}
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium focus:outline-none transition-colors disabled:opacity-50 shrink-0 cursor-pointer min-w-[150px]"
					>
						{isRefreshing ? (
							<span className="flex items-center gap-2 justify-center">
								<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
								{refreshProgress || "Running..."}
							</span>
						) : "Run Scraping Now"}
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
					placeholder="Enter an article URL or plain text to search..." 
					className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
					value={manualInput}
					onChange={(e) => setManualInput(e.target.value)}
					disabled={isAdding}
				/>
				<button 
					type="button"
					onClick={handleManualSubmit} 
					disabled={isAdding || !manualInput}
					className="px-6 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 transition-colors shrink-0"
				>
					{isAdding ? "Searching & Parsing..." : "Add Article"}
				</button>
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
				<div className="text-center py-12 text-red-500 bg-red-50 rounded-xl">
					<p className="font-semibold">
						Error loading articles. Please ensure the backend is running.
					</p>
				</div>
			)}

			{/* Article List */}
			{!isLoading && !isError && articles.length === 0 && (
				<div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
					<p className="text-lg">No articles found for this date.</p>
				</div>
			)}

			{!isLoading && !isError && articles.length > 0 && (
				<>
					{/* P0 Mission Critical Section */}
					{articles.filter(a => a.topicCategory === "P0_ALERT").length > 0 && (
						<div className="mb-10">
							<h2 className="text-xl font-bold text-red-600 flex items-center gap-2 mb-4">
								<span className="relative flex h-3 w-3">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
									<span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
								</span>
								P0 Mission Critical Updates
							</h2>
							<div className="space-y-6">
								{articles
									.filter(a => a.topicCategory === "P0_ALERT")
									.map(article => (
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

					{/* Regular Articles Section */}
					<div>
						{articles.filter(a => a.topicCategory === "P0_ALERT").length > 0 && (
							<h2 className="text-xl font-bold text-gray-800 mb-4">Daily News Feed</h2>
						)}
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
				</>
			)}
		</div>
	);
}
