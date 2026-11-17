import { useState, useEffect } from 'react';
import NeetStateDetail from './NeetStateDetail';

interface MetricData {
    totalStates: number;
    counsellingAnnounced: number;
    registrationOpen: number;
    needsVerification: number;
}

interface StateOverview {
    id: string;
    name: string;
    authority: string;
    currentStage: string;
    validationStatus: string;
    nextDeadline: { event: string; date: string } | null;
    lastUpdate: string;
}

export default function NeetDashboard() {
    const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
    const [states, setStates] = useState<StateOverview[]>([]);
    const [metrics, setMetrics] = useState<MetricData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const response = await fetch('/api/neet/states');
                if (response.ok) {
                    const data = await response.json();
                    setStates(data.states);
                    setMetrics(data.metrics);
                }
            } catch (error) {
                console.error("Failed to fetch NEET overview", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const getStatusIndicator = (stage: string, validation: string) => {
        if (validation === 'NEEDS_VERIFICATION') return '⚠️ Needs Verification';
        if (validation === 'CONFLICTING') return '❌ Conflicting Data';
        
        switch (stage) {
            case 'REGISTRATION_OPEN': return '🟢 Registration Open';
            case 'CHOICE_FILLING_OPEN': return '🔵 Choice Filling';
            case 'SEAT_ALLOTMENT_PENDING': return '🟡 Awaiting Result';
            case 'POSTPONED': return '🔴 Postponed';
            case 'COUNSELLING_COMPLETED': return '⚫ Completed';
            case 'NOT_ANNOUNCED': return '⚪ Not Announced';
            default: return `⚪ ${stage.replace(/_/g, ' ')}`;
        }
    };

    if (selectedStateId) {
        return <NeetStateDetail stateId={selectedStateId} onBack={() => setSelectedStateId(null)} />;
    }

    if (isLoading || !metrics) {
        return <div className="p-6 bg-gray-50 min-h-screen text-center"><p className="text-gray-500 mt-20">Loading NEET Database...</p></div>;
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">NEET UG Counselling Tracker 2026</h1>

            {/* Metrics Overview */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Total States/UTs</p>
                    <p className="text-2xl font-semibold">{metrics.totalStates}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Announced</p>
                    <p className="text-2xl font-semibold text-blue-600">{metrics.counsellingAnnounced}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Registration Open</p>
                    <p className="text-2xl font-semibold text-green-600">{metrics.registrationOpen}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-red-200 bg-red-50">
                    <p className="text-sm text-red-600 font-medium">Needs Verification Queue</p>
                    <p className="text-2xl font-bold text-red-700">{metrics.needsVerification}</p>
                </div>
            </div>

            {/* Global Search & Filters */}
            <div className="flex gap-4 mb-6">
                <input 
                    type="text" 
                    placeholder="Search State, Authority, or Stage..." 
                    className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <select className="p-3 border border-gray-300 rounded-md bg-white">
                    <option>All Stages</option>
                    <option>Registration Open</option>
                    <option>Choice Filling</option>
                </select>
            </div>

            {/* State/UT Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                            <th className="p-4 font-medium">State / UT</th>
                            <th className="p-4 font-medium">Authority</th>
                            <th className="p-4 font-medium">Current Stage</th>
                            <th className="p-4 font-medium">Next Deadline</th>
                            <th className="p-4 font-medium">Last Verified</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {states.map(state => (
                            <tr key={state.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="p-4 font-medium text-gray-800">{state.name}</td>
                                <td className="p-4 text-gray-600">{state.authority}</td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        state.validationStatus === 'NEEDS_VERIFICATION' ? 'bg-yellow-100 text-yellow-800' :
                                        state.currentStage.includes('OPEN') ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                        {getStatusIndicator(state.currentStage, state.validationStatus)}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-600">
                                    {state.nextDeadline ? (
                                        <div>
                                            <div className="font-medium text-red-600">
                                                {new Date(state.nextDeadline.date).toLocaleDateString()}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {state.nextDeadline.event.replace(/_/g, ' ')}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-gray-400">None</span>
                                    )}
                                </td>
                                <td className="p-4 text-gray-500">
                                    {new Date(state.lastUpdate).toLocaleString()}
                                </td>
                                <td className="p-4 text-right">
                                    <button 
                                        onClick={() => setSelectedStateId(state.id)}
                                        className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                                    >
                                        View Timeline &rarr;
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {states.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        No states found. Please run the database seeder!
                    </div>
                )}
            </div>
        </div>
    );
}
