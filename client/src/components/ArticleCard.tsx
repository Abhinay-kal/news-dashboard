export interface Article {
	_id: string;
	title: string;
	sourceUrl: string;
	topicCategory: string;
	summary: string[];
	status: "PENDING" | "APPROVED" | "REJECTED";
	runDate: string;
}

interface Props {
	article: Article;
	onStatusChange: (id: string, newStatus: "APPROVED" | "REJECTED" | "PENDING") => void;
}

export default function ArticleCard({ article, onStatusChange }: Props) {
	return (
		<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
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

			{/* Footer: Actions & Status */}
			<div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
				<div className="text-sm font-medium text-gray-500">
					Status:{" "}
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

				<div className="flex gap-2">
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
				</div>
			</div>
		</div>
	);
}
