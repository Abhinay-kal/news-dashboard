import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import DailyView from "./components/DailyView";
import NeetDashboard from "./components/neet/NeetDashboard";
import NeetStateDetail from "./components/neet/NeetStateDetail";
import AdminReviewQueue from "./components/neet/AdminReviewQueue";
import { SiteMonitorDashboard } from "./components/monitor/SiteMonitorDashboard";
import "./App.css";

const socket = io();

interface Alert {
	id: string;
	title: string;
	message: string;
	url: string;
}

// A sleek top navigation bar
function Navigation() {
    const location = useLocation();
    
    return (
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
            <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <div className="flex-shrink-0 flex items-center">
                            <span className="text-xl font-extrabold text-blue-900 tracking-tight">MATRIX<span className="text-gray-500 font-medium ml-1">HUB</span></span>
                        </div>
                        <div className="sm:ml-10 sm:flex sm:space-x-8">
                            <Link 
                                to="/" 
                                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-semibold transition-colors duration-200 ${
                                    location.pathname === '/' || location.pathname.startsWith('/site-monitor') 
                                    ? 'border-neutral-900 text-neutral-900' 
                                    : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800'
                                }`}
                            >
                                Site Monitor
                                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-neutral-900 text-white">
                                    Primary
                                </span>
                            </Link>
                            <Link 
                                to="/news" 
                                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-semibold transition-colors duration-200 ${
                                    location.pathname.startsWith('/news') 
                                    ? 'border-blue-600 text-gray-900' 
                                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                }`}
                            >
                                General News
                            </Link>
                            <Link 
                                to="/neet-tracker" 
                                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-semibold transition-colors duration-200 ${
                                    location.pathname.startsWith('/neet-tracker') 
                                    ? 'border-blue-600 text-gray-900' 
                                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                }`}
                            >
                                NEET UG Tracker
                            </Link>
                            <Link 
                                to="/admin/review-queue" 
                                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-semibold transition-colors duration-200 ${
                                    location.pathname.startsWith('/admin') 
                                    ? 'border-red-600 text-red-700' 
                                    : 'border-transparent text-red-500 hover:border-red-400 hover:text-red-700'
                                }`}
                            >
                                Admin Queue
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}

function AppContent() {
	const [alerts, setAlerts] = useState<Alert[]>([]);
	const audioCtxRef = useRef<AudioContext | null>(null);

	const dismissAlert = (id: string) => {
		setAlerts(prev => prev.filter(a => a.id !== id));
	};

	const dismissAllAlerts = () => {
		setAlerts([]);
	};

	useEffect(() => {
		// Unlock Web Audio on first user gesture so siren can play later.
		const unlock = () => {
			if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
				audioCtxRef.current.resume();
			}
		};
		window.addEventListener("pointerdown", unlock);
		window.addEventListener("keydown", unlock);

		const setupNotifications = async () => {
			if ("Notification" in window && Notification.permission === "default") {
				await Notification.requestPermission();
			}

			socket.on("high-priority-alert", (data) => {
				// Generate guaranteed unique ID to prevent React key reconciler collisions
				const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
				const newAlert: Alert = {
					id: uniqueId,
					title: data.title,
					message: data.message,
					url: data.url,
				};

				setAlerts(prev => {
					// Prevent duplicate toast if an alert with identical URL & title is already active
					if (prev.some(a => a.url === data.url && a.title === data.title)) {
						return prev;
					}
					return [newAlert, ...prev];
				});

				// Auto-dismiss after 30 seconds
				setTimeout(() => dismissAlert(uniqueId), 30000);

				// 2. Native browser notification (best-effort, may fail in Firefox)
				try {
					if ("Notification" in window && Notification.permission === "granted") {
						const notification = new Notification(data.title, {
							body: data.message,
							icon: "/favicon.ico"
						});
						notification.onclick = () => {
							window.open(data.url, "_blank");
						};
					}
				} catch (e) {
					// Silently fail — in-page toast is the primary mechanism
				}

				// 3. Police siren sound using Web Audio API frequency sweep
				try {
					let ctx = audioCtxRef.current;
					if (!ctx) {
						const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
						ctx = new AudioContextClass();
						audioCtxRef.current = ctx;
					}

					const playSiren = () => {
						const oscillator = ctx.createOscillator();
						const gainNode = ctx.createGain();
						oscillator.connect(gainNode);
						gainNode.connect(ctx.destination);
						oscillator.type = "sawtooth"; // sawtooth = harsh siren-like tone

						// Sweep frequency up and down like a police siren, 3 times
						const now = ctx.currentTime;
						gainNode.gain.setValueAtTime(0.4, now);

						// 3 full wail cycles
						for (let i = 0; i < 3; i++) {
							const t = now + i * 0.8;
							oscillator.frequency.setValueAtTime(600, t);          // low wail
							oscillator.frequency.linearRampToValueAtTime(1200, t + 0.4); // sweep up
							oscillator.frequency.linearRampToValueAtTime(600, t + 0.8);  // sweep down
						}

						gainNode.gain.setValueAtTime(0.4, now + 2.3);
						gainNode.gain.linearRampToValueAtTime(0.001, now + 2.4); // fade out

						oscillator.start(now);
						oscillator.stop(now + 2.5);
					};

					// Context starts "suspended" until a user gesture; resume before scheduling.
					if (ctx.state === "suspended") {
						ctx.resume().then(playSiren).catch(() => {});
					} else {
						playSiren();
					}
				} catch (e) {
					// Audio not supported
				}
			});
		};

		setupNotifications();

		return () => {
			window.removeEventListener("pointerdown", unlock);
			window.removeEventListener("keydown", unlock);
			socket.off("high-priority-alert");
		};
	}, []);

	const visibleAlerts = alerts.slice(0, 4);

	return (
		<div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col">
            <Navigation />
			{/* P0 Alert Toast Stack — fixed top-20 right-4, capped at 4 items with Dismiss All */}
			{alerts.length > 0 && (
				<div className="fixed top-20 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-auto">
					{alerts.length > 1 && (
						<div className="bg-neutral-900/95 backdrop-blur text-white px-3.5 py-2 rounded-xl shadow-lg border border-neutral-700 flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2">
							<div className="flex items-center gap-1.5 font-semibold">
								<span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
								<span>{alerts.length} Critical Alerts</span>
								{alerts.length > 4 && (
									<span className="bg-red-950 text-red-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
										+{alerts.length - 4} more
									</span>
								)}
							</div>
							<button
								type="button"
								onClick={dismissAllAlerts}
								className="text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer text-[11px]"
							>
								Dismiss All
							</button>
						</div>
					)}
					{visibleAlerts.map(alert => (
						<div
							key={alert.id}
							className="bg-red-600 text-white rounded-xl shadow-2xl p-4 flex flex-col gap-2 border-2 border-red-400 animate-pulse relative"
							style={{ animation: "pulse 1.2s ease-in-out 3" }}
						>
							<div className="flex items-start justify-between gap-2">
								<div className="flex items-center gap-2">
									<span className="text-xl">🚨</span>
									<span className="font-bold text-xs uppercase tracking-wider">P0 Critical Alert</span>
								</div>
								<button
									type="button"
									aria-label="Dismiss alert"
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										dismissAlert(alert.id);
									}}
									className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-700/60 hover:bg-red-800 active:bg-red-900 text-white transition-all cursor-pointer shrink-0 -mr-1 -mt-1 shadow-sm"
								>
									<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
										<line x1="18" y1="6" x2="6" y2="18"></line>
										<line x1="6" y1="6" x2="18" y2="18"></line>
									</svg>
								</button>
							</div>
							<p className="font-bold text-sm leading-snug">{alert.title}</p>
							<p className="text-red-100 text-xs leading-relaxed line-clamp-3">{alert.message}</p>
							<a
								href={alert.url}
								target="_blank"
								rel="noreferrer"
								className="mt-1 text-xs bg-white text-red-700 font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 text-center transition-colors shadow-sm"
							>
								Read Full Article →
							</a>
						</div>
					))}
				</div>
			)}

            {/* Main Content Area */}
            <main className="flex-1 w-full relative">
                <Routes>
                    <Route path="/" element={<SiteMonitorDashboard />} />
                    <Route path="/site-monitor" element={<SiteMonitorDashboard />} />
                    <Route path="/news" element={<DailyView />} />
                    <Route path="/neet-tracker" element={<NeetDashboard />} />
                    <Route path="/neet-tracker/state/:id" element={<NeetStateDetail />} />
                    <Route path="/admin/review-queue" element={<AdminReviewQueue />} />
                </Routes>
            </main>
		</div>
	);
}

function App() {
    return (
        <BrowserRouter>
            <AppContent />
        </BrowserRouter>
    );
}

export default App;
