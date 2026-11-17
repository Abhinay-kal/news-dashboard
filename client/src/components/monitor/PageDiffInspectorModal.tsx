import React, { useState, useEffect, useRef } from "react";
import type { MonitoredSite, MonitoredPage } from "./types";
import { sounds } from "../../utils/audioFeedback";

interface PageDiffInspectorModalProps {
	site: MonitoredSite;
	page: MonitoredPage;
	onClose: () => void;
	onRecheck: (siteId: string, pageId: string) => Promise<void>;
}

type ViewMode = "slider" | "diff" | "side-by-side" | "current" | "baseline";

export const PageDiffInspectorModal: React.FC<PageDiffInspectorModalProps> = ({
	site,
	page,
	onClose,
	onRecheck,
}) => {
	const [viewMode, setViewMode] = useState<ViewMode>("slider");
	const [sliderPos, setSliderPos] = useState(50); // 0 - 100%
	const [isDragging, setIsDragging] = useState(false);
	const [isBlinking, setIsBlinking] = useState(false);
	const [isChecking, setIsChecking] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	// Spacebar and Number key shortcuts (1-4, Space, Escape)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				sounds.playTap();
				onClose();
			} else if (e.key === "1") {
				sounds.playClick();
				setViewMode("slider");
			} else if (e.key === "2") {
				sounds.playClick();
				setViewMode("diff");
			} else if (e.key === "3") {
				sounds.playClick();
				setViewMode("side-by-side");
			} else if (e.key === "4") {
				sounds.playClick();
				setViewMode("baseline");
			} else if (e.code === "Space") {
				// Spacebar astronomer blink toggle
				e.preventDefault();
				sounds.playClick();
				setIsBlinking((prev) => !prev);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	// Mouse / Pointer drag for comparison slider
	const handlePointerMove = (e: React.PointerEvent) => {
		if (!isDragging || !containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
		const percent = (x / rect.width) * 100;
		setSliderPos(Math.round(percent * 10) / 10);
	};

	const handlePointerUp = () => {
		if (isDragging) {
			sounds.playTap();
			setIsDragging(false);
		}
	};

	const handleRecheck = async () => {
		sounds.playClick();
		setIsChecking(true);
		try {
			await onRecheck(site.id, page.id);
		} finally {
			setIsChecking(false);
		}
	};

	const currentImg = page.currentScreenshot;
	const baselineImg = page.baselineScreenshot || page.currentScreenshot;
	const diffImg = page.diffScreenshot;

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-neutral-900/60 backdrop-blur-md transition-opacity duration-200"
			onClick={(e) => {
				if (e.target === e.currentTarget) {
					sounds.playTap();
					onClose();
				}
			}}
		>
			<div
				className="apple-card w-full max-w-6xl max-h-[94vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-neutral-200 overflow-hidden transform transition-all duration-200 scale-100"
				style={{ transformOrigin: "center" }}
			>
				{/* Top Modal Header */}
				<div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-neutral-100 bg-white/95">
					<div className="flex items-center gap-3">
						<div className="w-9 h-9 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center font-bold text-neutral-800 text-xs">
							DIFF
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h3 className="font-semibold text-neutral-900 text-base tracking-tight">
									{page.name || "Target Page"}
								</h3>
								{page.hasChange ? (
									<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
										<span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
										{page.diffPercent}% Changed ({page.diffPixels.toLocaleString()} px)
									</span>
								) : (
									<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
										<span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
										100% Match (0 px)
									</span>
								)}
							</div>
							<div className="flex items-center gap-2 text-xs text-neutral-500 font-mono mt-0.5">
								<span>{site.domain}</span>
								<span>•</span>
								<a
									href={page.url}
									target="_blank"
									rel="noreferrer"
									className="text-neutral-600 hover:text-neutral-900 underline truncate max-w-sm"
								>
									{page.url}
								</a>
							</div>
						</div>
					</div>

					{/* Center View Switcher */}
					<div className="flex items-center p-1 rounded-xl bg-neutral-100/90 border border-neutral-200/80">
						<button
							onClick={() => {
								sounds.playClick();
								setViewMode("slider");
							}}
							className={`btn-tactile px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
								viewMode === "slider"
									? "bg-white text-neutral-900 shadow-xs"
									: "text-neutral-600 hover:text-neutral-900"
							}`}
							title="Shortcut: 1"
						>
							Split Slider <span className="text-[10px] opacity-60 ml-1">1</span>
						</button>
						<button
							onClick={() => {
								sounds.playClick();
								setViewMode("diff");
							}}
							className={`btn-tactile px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
								viewMode === "diff"
									? "bg-white text-neutral-900 shadow-xs"
									: "text-neutral-600 hover:text-neutral-900"
							}`}
							title="Shortcut: 2"
						>
							Red Highlight <span className="text-[10px] opacity-60 ml-1">2</span>
						</button>
						<button
							onClick={() => {
								sounds.playClick();
								setViewMode("side-by-side");
							}}
							className={`btn-tactile px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
								viewMode === "side-by-side"
									? "bg-white text-neutral-900 shadow-xs"
									: "text-neutral-600 hover:text-neutral-900"
							}`}
							title="Shortcut: 3"
						>
							Side-by-Side <span className="text-[10px] opacity-60 ml-1">3</span>
						</button>
						<button
							onClick={() => {
								sounds.playClick();
								setIsBlinking(!isBlinking);
							}}
							className={`btn-tactile px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
								isBlinking
									? "bg-amber-100 text-amber-900 border border-amber-300 font-semibold"
									: "text-neutral-600 hover:text-neutral-900"
							}`}
							title="Shortcut: Spacebar"
						>
							<span>Blink</span>
							<span className="text-[10px] opacity-60 font-mono">Space</span>
						</button>
					</div>

					{/* Right Modal Controls */}
					<div className="flex items-center gap-2">
						<button
							onClick={handleRecheck}
							disabled={isChecking}
							className="btn-tactile px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-200 cursor-pointer disabled:opacity-50"
						>
							{isChecking ? "Capturing..." : "Re-Capture Now"}
						</button>
						<button
							onClick={() => {
								sounds.playTap();
								onClose();
							}}
							className="btn-tactile p-1.5 rounded-lg text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 cursor-pointer"
							title="Close modal (Esc)"
						>
							<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>

				{/* Main Inspector Viewport */}
				<div className="flex-1 overflow-auto p-6 bg-neutral-900 flex items-center justify-center min-h-[460px]">
					{/* Mode 1: Emil Kowalski Hardware-Accelerated Clip-Path Comparison Slider */}
					{viewMode === "slider" && (
						<div
							ref={containerRef}
							onPointerMove={handlePointerMove}
							onPointerUp={handlePointerUp}
							className="relative max-w-4xl w-full h-[580px] bg-neutral-950 rounded-xl overflow-hidden select-none border border-neutral-800 shadow-2xl cursor-ew-resize"
						>
							{/* Baseline Image (Underneath) */}
							{baselineImg && (
								<img
									src={isBlinking ? currentImg : baselineImg}
									alt="Baseline Version"
									className="absolute inset-0 w-full h-full object-contain pointer-events-none"
								/>
							)}

							{/* Current Image (Clipped by Emil's clip-path: inset(0 (100-sliderPos)% 0 0)) */}
							{currentImg && !isBlinking && (
								<img
									src={currentImg}
									alt="Current Version"
									className="absolute inset-0 w-full h-full object-contain pointer-events-none"
									style={{
										clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
									}}
								/>
							)}

							{/* Vertical Divider Line & Tactile Handle */}
							<div
								onPointerDown={(e) => {
									e.currentTarget.setPointerCapture(e.pointerId);
									sounds.playClick();
									setIsDragging(true);
								}}
								className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_12px_rgba(0,0,0,0.8)] cursor-ew-resize z-20 flex items-center justify-center transition-opacity"
								style={{ left: `${sliderPos}%` }}
							>
								<div className="w-8 h-8 rounded-full bg-white text-neutral-900 shadow-xl border border-neutral-300 flex items-center justify-center text-xs font-bold font-mono">
									↔
								</div>
							</div>

							{/* Top Tags for Before/After */}
							<div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded bg-black/70 backdrop-blur-sm text-white text-[11px] font-mono border border-white/10">
								Current ({sliderPos}%)
							</div>
							<div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded bg-black/70 backdrop-blur-sm text-white text-[11px] font-mono border border-white/10">
								Baseline ({100 - sliderPos}%)
							</div>
						</div>
					)}

					{/* Mode 2: Red Pixel Diff Overlay */}
					{viewMode === "diff" && (
						<div className="relative max-w-4xl w-full h-[580px] bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center shadow-2xl">
							{diffImg ? (
								<img
									src={diffImg}
									alt="Visual Pixel Diff"
									className="w-full h-full object-contain"
								/>
							) : (
								<div className="text-center text-neutral-400 font-mono text-xs">
									<p>No visual difference detected from baseline.</p>
								</div>
							)}
							<div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-rose-950/80 backdrop-blur-sm text-rose-300 text-[11px] font-mono border border-rose-800/60">
								Red Pixels = Changed Elements
							</div>
						</div>
					)}

					{/* Mode 3: Side-by-Side View */}
					{viewMode === "side-by-side" && (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl w-full h-[580px]">
							<div className="relative bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 flex flex-col">
								<div className="px-3 py-2 bg-neutral-900/90 border-b border-neutral-800 text-neutral-300 text-xs font-medium flex justify-between">
									<span>Baseline Version</span>
									<span className="font-mono text-neutral-500">Original</span>
								</div>
								<div className="flex-1 overflow-auto flex items-center justify-center p-2">
									{baselineImg && (
										<img
											src={baselineImg}
											alt="Baseline"
											className="max-h-full object-contain"
										/>
									)}
								</div>
							</div>
							<div className="relative bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 flex flex-col">
								<div className="px-3 py-2 bg-neutral-900/90 border-b border-neutral-800 text-neutral-300 text-xs font-medium flex justify-between">
									<span>Current Version</span>
									<span className="font-mono text-rose-400 font-semibold">
										{page.diffPercent}% Diff
									</span>
								</div>
								<div className="flex-1 overflow-auto flex items-center justify-center p-2">
									{currentImg && (
										<img
											src={currentImg}
											alt="Current"
											className="max-h-full object-contain"
										/>
									)}
								</div>
							</div>
						</div>
					)}

					{/* Mode 4: Baseline View */}
					{viewMode === "baseline" && (
						<div className="relative max-w-4xl w-full h-[580px] bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center shadow-2xl">
							{baselineImg && (
								<img
									src={baselineImg}
									alt="Baseline Snapshot"
									className="w-full h-full object-contain"
								/>
							)}
							<div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-black/70 backdrop-blur-sm text-neutral-300 text-[11px] font-mono border border-white/10">
								Baseline Screenshot
							</div>
						</div>
					)}
				</div>

				{/* Modal Footer with Help & Metadata */}
				<div className="px-6 py-3.5 bg-neutral-50 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
					<div className="flex items-center gap-4">
						<span className="flex items-center gap-1.5">
							<kbd className="px-1.5 py-0.5 rounded bg-white border border-neutral-200 font-mono text-[10px] text-neutral-700 shadow-2xs">
								1 - 3
							</kbd>
							<span>Switch Views</span>
						</span>
						<span className="flex items-center gap-1.5">
							<kbd className="px-1.5 py-0.5 rounded bg-white border border-neutral-200 font-mono text-[10px] text-neutral-700 shadow-2xs">
								Space
							</kbd>
							<span>Blink Compare</span>
						</span>
						<span className="flex items-center gap-1.5">
							<kbd className="px-1.5 py-0.5 rounded bg-white border border-neutral-200 font-mono text-[10px] text-neutral-700 shadow-2xs">
								Esc
							</kbd>
							<span>Close</span>
						</span>
					</div>

					<div className="font-mono text-neutral-400">
						Capture Engine: Playwright Chromium (1280x720) • Pixelmatch
					</div>
				</div>
			</div>
		</div>
	);
};
