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
	thumbnailUrl?: string;
	storyId?: string;
	createdAt?: string;
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

	const isTwitter = article.sourceUrl.includes("twitter.com") || article.sourceUrl.includes("x.com");

	return (
		<div className={`bg-white rounded-xl shadow-sm border p-6 flex flex-col gap-4 transition-all hover:shadow-md ${isTwitter ? 'border-gray-200' : 'border-gray-100'}`}>
			{isTwitter ? (
				<>
					{/* Twitter X Card Header */}
					<div className="flex justify-between items-start">
						<div className="flex gap-3">
							<div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center shrink-0 border border-gray-200 overflow-hidden">
								<svg viewBox="0 0 24 24" aria-hidden="true" className="w-6 h-6 text-gray-400 fill-current"><g><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></g></svg>
							</div>
							<div className="flex flex-col">
								<div className="flex items-center gap-1">
									<span className="font-bold text-gray-900 font-sans">Twitter Post</span>
									<svg viewBox="0 0 24 24" aria-label="Verified account" className="w-[18px] h-[18px] text-[#1D9BF0] fill-current"><g><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.79-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.727 2.73 1.83 3.397-.043.204-.066.417-.066.634 0 2.21 1.71 3.998 3.918 3.998.47 0 .92-.084 1.336-.25C9.182 21.585 10.49 22.5 12 22.5s2.816-.917 3.337-2.25c.416.165.866.25 1.336.25 2.21 0 3.918-1.79 3.918-4 0-.217-.023-.43-.066-.634 1.103-.667 1.83-1.937 1.83-3.397zm-14.887 2.073l-3.21-3.21 1.414-1.414 1.796 1.795 6.22-6.22 1.415 1.415-7.635 7.634z"></path></g></svg>
								</div>
								<a href={article.sourceUrl} target="_blank" rel="noreferrer" className="text-gray-500 hover:underline text-[15px] font-sans">
									View Original on X
								</a>
							</div>
						</div>
						<div className="flex items-center gap-3">
							{article.createdAt && (
								<span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">
									Scraped: {new Date(article.createdAt).toLocaleString()}
								</span>
							)}
							<span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-wider rounded-full shrink-0">
								{article.topicCategory}
							</span>
							<svg viewBox="0 0 24 24" aria-hidden="true" className="w-6 h-6 text-[#0f1419] fill-current"><g><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></g></svg>
						</div>
					</div>
					
					{/* Tweet Body */}
					<div className="mt-1 text-[16px] leading-relaxed text-[#0f1419] font-sans whitespace-pre-wrap">
						{article.title}
					</div>

					{/* Engagement Fake Buttons for aesthetics */}
					<div className="flex gap-8 text-gray-500 mt-2">
						<div className="flex items-center gap-2 hover:text-[#1d9bf0] cursor-pointer transition-colors">
							<svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current"><g><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path></g></svg>
						</div>
						<div className="flex items-center gap-2 hover:text-[#00ba7c] cursor-pointer transition-colors">
							<svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current"><g><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path></g></svg>
						</div>
						<div className="flex items-center gap-2 hover:text-[#f91880] cursor-pointer transition-colors">
							<svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current"><g><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path></g></svg>
						</div>
					</div>
				</>
			) : (
				<>
					{/* Standard Header: Title and Category Badge */}
					<div className="flex flex-col sm:flex-row sm:justify-between items-start gap-3 sm:gap-4">
						<div className="flex gap-4">
							{article.thumbnailUrl && (
								<img 
									src={article.thumbnailUrl} 
									alt="Thumbnail" 
									className="w-24 h-16 object-cover rounded shadow-sm shrink-0" 
								/>
							)}
							<a
								href={article.sourceUrl}
								target="_blank"
								rel="noreferrer"
								className="text-xl font-semibold text-gray-900 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors"
							>
								{article.title}
							</a>
						</div>
						<div className="flex flex-col items-end gap-1">
							<span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-wider rounded-full shrink-0">
								{article.topicCategory}
							</span>
							{article.createdAt && (
								<span className="text-[11px] text-gray-400 font-medium">
									Scraped: {new Date(article.createdAt).toLocaleString()}
								</span>
							)}
						</div>
					</div>

					{/* Summary Bullet Points */}
					<ul className="list-disc list-outside ml-5 text-gray-600 space-y-2">
						{article.summary.map((point) => (
							<li key={point} className="leading-relaxed">
								{point}
							</li>
						))}
					</ul>
				</>
			)}
			
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
