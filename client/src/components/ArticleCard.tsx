import { useState } from "react";

export interface Article {
	_id: string;
	title: string;
	sourceUrl: string;
	topicCategory: string;
	summary: string[];
	status: "PENDING" | "APPROVED" | "REJECTED";
	postStatus?: "PENDING" | "POSTED" | "NOT_POSTED";
	assignedTo?: string;
	runDate: string;
}

interface Props {
	article: Article;
	onStatusChange: (id: string, newStatus: "APPROVED" | "REJECTED" | "PENDING") => void;
	onPostStatusChange: (id: string, newStatus: "PENDING" | "POSTED" | "NOT_POSTED") => void;
	onDelete: (id: string) => void;
	onAssign: (id: string, email: string) => void;
	onNotify: (id: string) => void;
}

const WRITERS = [
	{ name: "Unassigned", email: "" },
	{ name: "Rachit Dadhich", email: "rachit.dadhich@matrixedu.in" },
	{ name: "Omprakash Jangid", email: "omprakash.jangid@matrixedu.in" },
	{ name: "Abhishek Choudhary", email: "abhishek.choudhary@matrixedu.in" },
	{ name: "Krishna kumar", email: "krishna.kumar@matrixedu.in" },
];

export default function ArticleCard({ article, onStatusChange, onPostStatusChange, onDelete, onAssign, onNotify }: Props) {
	const [showSimilar, setShowSimilar] = useState(false);
	const [similarArticles, setSimilarArticles] = useState<{title: string, sourceUrl: string}[]>([]);
	const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);

	const handleLoadSimilar = async () => {
		if (showSimilar) {
			setShowSimilar(false);
			return;
		}
		
		setShowSimilar(true);
		if (similarArticles.length > 0) return; // Already loaded

		setIsLoadingSimilar(true);
		try {
			const res = await fetch(`http://localhost:5001/api/articles/${article._id}/similar`);
			const data = await res.json();
			if (res.ok) {
				setSimilarArticles(data);
			}
		} catch (error) {
			console.error("Failed to fetch similar articles", error);
		} finally {
			setIsLoadingSimilar(false);
		}
	};

	return (
		<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4 transition-all hover:shadow-md">
			{/* Header: Title and Category Badge */}
			<div className="flex flex-col sm:flex-row sm:justify-between items-start gap-3 sm:gap-4">
				<a
					href={article.sourceUrl}
					target="_blank"
					rel="noreferrer"
					className="text-xl font-semibold text-gray-900 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors"
				>
					{article.title}
				</a>
				<span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-wider rounded-full shrink-0">
					{article.topicCategory}
				</span>
			</div>

			{/* Summary Bullet Points */}
			<ul className="list-disc list-outside ml-5 text-gray-600 space-y-2">
				{article.summary.map((point) => (
					<li key={point} className="leading-relaxed">
						{point}
					</li>
				))}
			</ul>
			
			{/* Similar Articles Section */}
			<div className="mt-2">
				<button 
					type="button" 
					onClick={handleLoadSimilar}
					className="text-sm font-semibold text-blue-600 hover:text-blue-800 focus:outline-none flex items-center gap-1 transition-colors"
				>
					{showSimilar ? "▼ Hide Similar Coverage" : "▶ Show Similar Coverage"}
				</button>
				
				{showSimilar && (
					<div className="mt-3 pl-4 border-l-2 border-blue-100 space-y-2">
						{isLoadingSimilar ? (
							<div className="text-sm text-gray-400 animate-pulse">Searching Google News for alternative sources...</div>
						) : similarArticles.length > 0 ? (
							<ul className="space-y-2">
								{similarArticles.map((sim, i) => (
									<li key={i} className="text-sm">
										<a href={sim.sourceUrl} target="_blank" rel="noreferrer" className="text-gray-700 hover:text-blue-600 hover:underline line-clamp-1">
											↳ {sim.title}
										</a>
									</li>
								))}
							</ul>
						) : (
							<div className="text-sm text-gray-400">No other coverage found for this specific topic.</div>
						)}
					</div>
				)}
			</div>

			{/* Footer: Actions & Status */}
			<div className="mt-4 pt-4 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div className="flex flex-col sm:flex-row gap-4">
					<div className="text-sm font-medium text-gray-500 flex items-center gap-2">
						<span>Review:</span>
						<span
							className={`font-bold ${
								article.status === "APPROVED"
									? "text-green-600"
									: article.status === "REJECTED"
										? "text-red-600"
										: "text-yellow-600"
							}`}
						>
							{article.status}
						</span>
					</div>
					
					<div className="text-sm font-medium text-gray-500 flex items-center gap-2">
						<label htmlFor={`post-status-${article._id}`}>Post Status:</label>
						<select
							id={`post-status-${article._id}`}
							value={article.postStatus || "PENDING"}
							onChange={(e) => onPostStatusChange(article._id, e.target.value as "PENDING" | "POSTED" | "NOT_POSTED")}
							className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1"
						>
							<option value="PENDING">Pending</option>
							<option value="POSTED">Posted</option>
							<option value="NOT_POSTED">Not Posted</option>
						</select>
					</div>

					<div className="text-sm font-medium text-gray-500 flex items-center gap-2">
						<label htmlFor={`writer-select-${article._id}`}>Writer:</label>
						<select
							id={`writer-select-${article._id}`}
							value={article.assignedTo || ""}
							onChange={(e) => onAssign(article._id, e.target.value)}
							className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1"
						>
							{WRITERS.map(writer => (
								<option key={writer.email} value={writer.email}>
									{writer.name}
								</option>
							))}
						</select>
						
						{article.assignedTo && (
							<button
								type="button"
								onClick={() => onNotify(article._id)}
								className="text-blue-600 hover:text-blue-800 focus:outline-none flex items-center gap-1 ml-2 transition-colors border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded cursor-pointer"
								title="Send Assignment Email via Backend"
							>
								✉️ Notify
							</button>
						)}
					</div>
				</div>

				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => onStatusChange(article._id, "PENDING")}
						className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 transition-colors cursor-pointer"
					>
						Reset
					</button>
					<button
						type="button"
						onClick={() => onStatusChange(article._id, "REJECTED")}
						className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-colors cursor-pointer"
					>
						Reject
					</button>
					<button
						type="button"
						onClick={() => onStatusChange(article._id, "APPROVED")}
						className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors cursor-pointer"
					>
						Approve
					</button>
					<button
						type="button"
						onClick={() => {
							if (window.confirm("Are you sure you want to permanently delete this article?")) {
								onDelete(article._id);
							}
						}}
						className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 transition-colors cursor-pointer ml-auto sm:ml-2"
					>
						Delete
					</button>
				</div>
			</div>
		</div>
	);
}
