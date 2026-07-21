import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import ArticleCard, { type Article } from "./ArticleCard";

const API_URL = "http://localhost:5000/api";

export default function DailyView() {
	const queryClient = useQueryClient();
	// State for the currently viewed date (defaults to today)
	const [runDate, setRunDate] = useState(
		() => new Date().toISOString().split("T")[0],
	);

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
			status: "APPROVED" | "REJECTED";
		}) => {
			await axios.patch(`${API_URL}/articles/${id}/status`, { status });
		},
		onSuccess: () => {
			// Invalidate the cache to trigger a refetch and update UI
			queryClient.invalidateQueries({ queryKey: ["articles", runDate] });
		},
	});

	// Date Navigation Helpers
	const changeDate = (days: number) => {
		const date = new Date(runDate);
		date.setDate(date.getDate() + days);
		setRunDate(date.toISOString().split("T")[0]);
	};

	const handleStatusChange = (
		id: string,
		newStatus: "APPROVED" | "REJECTED",
	) => {
		updateStatusMutation.mutate({ id, status: newStatus });
	};

	return (
		<div className="max-w-4xl mx-auto py-8 px-4">
			{/* Header and Date Navigation */}
			<header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 gap-4 sm:gap-0">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Daily Curation</h1>
					<p className="text-gray-500 text-sm">
						Reviewing articles for {runDate}
					</p>
				</div>

				<div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
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

			<div className="space-y-6">
				{articles.map((article) => (
					<ArticleCard
						key={article._id}
						article={article}
						onStatusChange={handleStatusChange}
					/>
				))}
			</div>
		</div>
	);
}
