import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface StateDetailData {
    id: string;
    name: string;
    authority: string;
    officialWebsite: string | null;
    currentStage: string;
    history: Array<{
        id: string;
        statusBefore: string;
        statusAfter: string;
        changedAt: string;
        sourceUrl: string | null;
        confidence: string;
        reason: string;
    }>;
    schedules: Array<{
        roundName: string;
        events: Array<{
            eventType: string;
            eventDate: string;
            isTentative: boolean;
        }>;
    }>;
    historicalCutoffs?: Array<{
        category: string;
        quota: string;
        round1?: number;
        round2?: number;
        round3?: number;
        stray?: number;
    }>;
}

export default function NeetStateDetail({ stateId, onBack }: { stateId?: string, onBack?: () => void }) {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const effectiveStateId = stateId || id || '';
    const handleBack = onBack || (() => navigate(-1));
    const [data, setData] = useState<StateDetailData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStateDetail = async () => {
            if (!effectiveStateId) return;
            try {
                const response = await fetch(`/api/neet/states/${effectiveStateId}/timeline`);
                if (response.ok) {
                    const json = await response.json();
                    setData(json);
                }
            } catch (error) {
                console.error("Failed to fetch timeline", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStateDetail();
    }, [effectiveStateId]);

    if (isLoading) {
        return <div className="p-6 bg-white min-h-screen text-center text-gray-500"><p className="mt-20">Loading Timeline Data...</p></div>;
    }

    if (!data) {
        return (
            <div className="p-6 bg-white min-h-screen">
                <button onClick={handleBack} className="mb-6 text-gray-500 hover:text-gray-800">
                    &larr; Back to Dashboard
                </button>
                <div className="text-red-500 text-center">Failed to load state details.</div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8">
            <header className="border-b pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{data.name} NEET UG Counselling</h1>
                        <p className="text-gray-600 mt-1">{data.authority}</p>
                    </div>
                    <div className="text-right">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            Current Stage: {data.currentStage.replace(/_/g, ' ')}
                        </span>
                        {data.officialWebsite && (
                            <a href={data.officialWebsite} target="_blank" rel="noreferrer" className="block mt-2 text-sm text-blue-600 hover:underline">
                                Official Website &rarr;
                            </a>
                        )}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-12">
                {/* Left Column: Official Schedule */}
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Official Schedule</h2>
                    {data.schedules.length === 0 && (
                        <p className="text-gray-500 italic">No schedules published yet.</p>
                    )}
                    {data.schedules.map(round => (
                        <div key={round.roundName} className="mb-8 border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                <h3 className="font-bold text-gray-800">{round.roundName}</h3>
                            </div>
                            <ul className="divide-y divide-gray-100">
                                {round.events.map(event => {
                                    const isPast = new Date(event.eventDate).getTime() < Date.now();
                                    return (
                                        <li key={event.eventType} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                            <div>
                                                <p className="font-medium text-gray-900">
                                                    {event.eventType.replace(/_/g, ' ')}
                                                </p>
                                                {event.isTentative && <span className="text-xs text-orange-600 font-medium">Tentative</span>}
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-medium ${isPast ? 'text-gray-400 line-through' : 'text-blue-700'}`}>
                                                    {new Date(event.eventDate).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                    {/* TASK 5: Historical Cutoffs */}
                    {data.historicalCutoffs && data.historicalCutoffs.length > 0 && (
                        <section className="mt-8">
                            <h2 className="text-xl font-semibold mb-4 text-gray-800">2025 Closing Ranks (Historical)</h2>
                            <div className="bg-white shadow overflow-hidden border border-gray-200 sm:rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Round</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Closing Rank</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Closing Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {data.historicalCutoffs.map((cutoff: any) => (
                                            <tr key={cutoff.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cutoff.category}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Round {cutoff.roundNumber}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cutoff.closingRank.toLocaleString()}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cutoff.closingScore || 'N/A'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}
                </div>

                {/* Right Column: Immutable Audit Timeline */}
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Verification Timeline</h2>
                    <div className="relative border-l-2 border-gray-200 ml-4 pl-8 py-2 space-y-10">
                        {data.history.length === 0 && (
                            <p className="text-gray-500 italic">No history available for this state yet.</p>
                        )}
                        {data.history.map(audit => (
                            <div key={audit.id} className="relative">
                                {/* Timeline Node */}
                                <div className="absolute -left-[41px] top-1 h-5 w-5 rounded-full border-4 border-white bg-blue-500"></div>
                                
                                <p className="text-sm text-gray-500 mb-1">
                                    {new Date(audit.changedAt).toLocaleString()}
                                </p>
                                <h4 className="text-lg font-bold text-gray-800">
                                    {audit.statusBefore} &rarr; <span className="text-blue-600">{audit.statusAfter}</span>
                                </h4>
                                <p className="text-gray-600 mt-2 text-sm">{audit.reason}</p>
                                
                                {audit.sourceUrl && (
                                    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                audit.confidence === 'HIGH' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {audit.confidence} CONFIDENCE
                                            </span>
                                            <span className="text-xs text-gray-500">Source of Truth</span>
                                        </div>
                                        <a href={audit.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate block">
                                            {audit.sourceUrl}
                                        </a>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
