import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Screenshot {
  name: string;
  url: string;
  diffUrl?: string;
  targetUrl?: string;
  category: string;
  lastUpdated: string;
}

export function P0ScraperPreview() {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDiffs, setShowDiffs] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'national' | 'iit' | 'counselling'>('all');

  useEffect(() => {
    let isMounted = true;
    
    async function fetchScreenshots() {
      try {
        const response = await fetch('/api/neet/screenshots');
        if (!response.ok) {
          if (isMounted) setScreenshots([]);
          return;
        }
        const data = await response.json();
        if (isMounted) setScreenshots(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch screenshots:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    fetchScreenshots();
    const intervalId = setInterval(fetchScreenshots, 60000); // Poll every 60 seconds
    
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  if (loading) {
    return (
      <div className="w-full py-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (screenshots.length === 0) {
    return (
      <section className="mb-12 mt-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
            Direct Polling Targets
          </h3>
          <span className="text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full">
            Updated Hourly
          </span>
        </div>
        <div className="w-full py-12 bg-slate-50 rounded-2xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-slate-500">
          <p>No screenshots captured yet.</p>
          <p className="text-sm mt-1">The next capture is scheduled at the 30-minute mark.</p>
        </div>
      </section>
    );
  }

  const safeScreenshots = Array.isArray(screenshots) ? screenshots : [];
  const nationalScreenshots = safeScreenshots.filter(s => s.category !== 'counselling' && s.category !== 'iit');
  const iitScreenshots = safeScreenshots.filter(s => s.category === 'iit');
  const counsellingScreenshots = safeScreenshots.filter(s => s.category === 'counselling');

  const renderGrid = (items: Screenshot[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {items.map((shot, index) => (
        <motion.div
          key={shot.url || shot.name || index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4) }}
          whileHover={{ scale: 1.02, y: -2 }}
          onClick={() => shot.targetUrl && window.open(shot.targetUrl, '_blank')}
          className="group relative bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden hover:shadow-md transition-all cursor-pointer"
        >
          <div className="aspect-[16/9] w-full bg-slate-100 overflow-hidden relative">
            <img
              src={`${(showDiffs && shot.diffUrl) ? shot.diffUrl : shot.url}?t=${new Date(shot.lastUpdated).getTime()}`}
              alt={`${shot.name} Website Screenshot`}
              className="object-cover object-top w-full h-full opacity-90 group-hover:opacity-100 transition-opacity"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-2.5 right-2.5">
              {shot.category === 'iit' && (
                <span className="px-2 py-0.5 rounded-md bg-purple-900/80 backdrop-blur-md text-purple-100 text-[10px] font-semibold tracking-wide uppercase">
                  IIT
                </span>
              )}
              {shot.category === 'counselling' && (
                <span className="px-2 py-0.5 rounded-md bg-amber-900/80 backdrop-blur-md text-amber-100 text-[10px] font-semibold tracking-wide uppercase">
                  State
                </span>
              )}
              {shot.category !== 'iit' && shot.category !== 'counselling' && (
                <span className="px-2 py-0.5 rounded-md bg-blue-900/80 backdrop-blur-md text-blue-100 text-[10px] font-semibold tracking-wide uppercase">
                  National
                </span>
              )}
            </div>
          </div>
          
          <div className="p-4 border-t border-slate-100 bg-white relative z-10">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-800 text-sm tracking-tight truncate mr-2" title={shot.name}>{shot.name}</h4>
              {shot.targetUrl && (
                <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Last checked: {new Date(shot.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );

  return (
    <div className="space-y-10">
      {/* Category Pills & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            All Portals ({safeScreenshots.length})
          </button>
          <button
            onClick={() => setCategoryFilter('national')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              categoryFilter === 'national'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            National Boards ({nationalScreenshots.length})
          </button>
          <button
            onClick={() => setCategoryFilter('iit')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              categoryFilter === 'iit'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            IIT Portals ({iitScreenshots.length})
          </button>
          <button
            onClick={() => setCategoryFilter('counselling')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              categoryFilter === 'counselling'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            State Counselling ({counsellingScreenshots.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDiffs(!showDiffs)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-semibold cursor-pointer border border-indigo-200/60"
          >
            {showDiffs ? "Hide Visual Diffs" : "Show Visual Diffs"}
          </button>
          <span className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-lg">
            Updated Hourly
          </span>
        </div>
      </div>

      {/* National Examination & Board Portals */}
      {(categoryFilter === 'all' || categoryFilter === 'national') && nationalScreenshots.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
              Direct Polling Targets — National Boards ({nationalScreenshots.length})
            </h3>
          </div>
          {renderGrid(nationalScreenshots)}
        </section>
      )}

      {/* IIT Portals */}
      {(categoryFilter === 'all' || categoryFilter === 'iit') && iitScreenshots.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse"></span>
              IIT Official Portals ({iitScreenshots.length})
            </h3>
          </div>
          {renderGrid(iitScreenshots)}
        </section>
      )}

      {/* State Counselling Updates */}
      {(categoryFilter === 'all' || categoryFilter === 'counselling') && counsellingScreenshots.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              State Counselling Updates ({counsellingScreenshots.length})
            </h3>
          </div>
          {renderGrid(counsellingScreenshots)}
        </section>
      )}
    </div>
  );
}
