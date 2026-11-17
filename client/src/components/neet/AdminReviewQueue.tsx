import { useEffect, useState } from 'react';

export default function AdminReviewQueue() {
    const [queue, setQueue] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchQueue = async () => {
        try {
            const res = await fetch('/api/neet/admin/queue');
            if (res.ok) {
                const data = await res.json();
                setQueue(data);
            }
        } catch (error) {
            console.error('Error fetching admin queue:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
    }, []);

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        try {
            const res = await fetch(`/api/neet/admin/queue/${id}/${action}`, {
                method: 'POST'
            });
            if (res.ok) {
                // Remove from local state
                setQueue(queue.filter(q => q.id !== id));
            }
        } catch (error) {
            console.error(`Error ${action}ing queue item:`, error);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500 font-medium">Loading manual review queue...</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <header className="mb-8 border-b pb-4">
                <h1 className="text-3xl font-bold text-gray-900">Admin Action Required: Manual Review Queue</h1>
                <p className="text-gray-600 mt-2">These scraping events triggered conflict detection or were sourced from low-confidence portals. They require human verification before updating the official state tracker.</p>
            </header>

            {queue.length === 0 ? (
                <div className="bg-green-50 border border-green-200 text-green-700 p-8 text-center rounded-lg shadow-sm">
                    <svg className="w-12 h-12 mx-auto mb-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <h3 className="text-xl font-bold">All caught up!</h3>
                    <p>There are no conflicts requiring manual review.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {queue.map(item => (
                        <div key={item.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-red-200">
                            <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
                                <div>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mb-1">
                                        Conflict Detected
                                    </span>
                                    <h3 className="text-lg font-bold text-gray-900">{item.stateName} - {item.authorityName}</h3>
                                </div>
                                <div className="text-sm text-gray-500">
                                    Detected: {new Date(item.detectedAt).toLocaleString()}
                                </div>
                            </div>
                            
                            <div className="p-6">
                                <div className="grid grid-cols-2 gap-6 mb-6">
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Current Official Status</div>
                                        <div className="text-lg font-bold text-gray-800">{item.currentStatus}</div>
                                    </div>
                                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-inner">
                                        <div className="text-xs text-yellow-700 uppercase tracking-wider font-semibold mb-1">Proposed Update</div>
                                        <div className="text-lg font-bold text-yellow-900">{item.proposedStatus}</div>
                                        <div className="text-sm text-yellow-700 mt-2">Source Confidence: <span className="font-bold">{item.confidence}</span></div>
                                    </div>
                                </div>
                                
                                <div className="mb-6">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Reason for Flagging:</h4>
                                    <p className="text-gray-600 bg-gray-50 p-3 rounded">{item.conflictReason}</p>
                                </div>

                                <div className="mb-6">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Source Evidence:</h4>
                                    <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">
                                        {item.sourceUrl}
                                    </a>
                                </div>

                                <div className="flex gap-4 pt-4 border-t border-gray-100">
                                    <button 
                                        onClick={() => handleAction(item.id, 'approve')}
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded shadow transition"
                                    >
                                        Approve &amp; Force Update
                                    </button>
                                    <button 
                                        onClick={() => handleAction(item.id, 'reject')}
                                        className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-bold py-3 px-4 rounded shadow-sm transition"
                                    >
                                        Reject (Keep Current Status)
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
