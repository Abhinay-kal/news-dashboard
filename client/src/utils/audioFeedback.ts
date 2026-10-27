// Emil Kowalski-inspired Web Audio tactile feedback generator
// Completely self-contained: synthesizes organic micro-clicks and chimes in real-time.

class SoundManager {
	private ctx: AudioContext | null = null;
	private muted: boolean = false;

	constructor() {
		if (typeof window !== "undefined") {
			this.muted = localStorage.getItem("site-diff-sound-muted") === "true";
		}
	}

	private getContext(): AudioContext | null {
		if (typeof window === "undefined") return null;
		if (!this.ctx) {
			const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
			if (AudioContextClass) {
				this.ctx = new AudioContextClass();
			}
		}
		if (this.ctx && this.ctx.state === "suspended") {
			this.ctx.resume().catch(() => {});
		}
		return this.ctx;
	}

	public isMuted(): boolean {
		return this.muted;
	}

	public setMuted(muted: boolean) {
		this.muted = muted;
		if (typeof window !== "undefined") {
			localStorage.setItem("site-diff-sound-muted", muted ? "true" : "false");
		}
	}

	public toggleMute(): boolean {
		this.setMuted(!this.muted);
		return this.muted;
	}

	// Micro-click on button press / tab switch (tactile 12ms pop)
	public playClick() {
		if (this.muted) return;
		const ctx = this.getContext();
		if (!ctx) return;

		try {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();

			osc.type = "sine";
			const now = ctx.currentTime;
			osc.frequency.setValueAtTime(1400, now);
			osc.frequency.exponentialRampToValueAtTime(320, now + 0.018);

			gain.gain.setValueAtTime(0.04, now);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

			osc.connect(gain);
			gain.connect(ctx.destination);

			osc.start(now);
			osc.stop(now + 0.02);
		} catch {
			// Ignore audio errors
		}
	}

	// Soft tactile tap (accordion expand/collapse)
	public playTap() {
		if (this.muted) return;
		const ctx = this.getContext();
		if (!ctx) return;

		try {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();

			osc.type = "triangle";
			const now = ctx.currentTime;
			osc.frequency.setValueAtTime(380, now);
			osc.frequency.exponentialRampToValueAtTime(120, now + 0.035);

			gain.gain.setValueAtTime(0.05, now);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

			osc.connect(gain);
			gain.connect(ctx.destination);

			osc.start(now);
			osc.stop(now + 0.04);
		} catch {
			// Ignore
		}
	}

	// High-contrast diff detected chime (subtle pleasant double-ping)
	public playDiffChime() {
		if (this.muted) return;
		const ctx = this.getContext();
		if (!ctx) return;

		try {
			const now = ctx.currentTime;

			// Ping 1
			const osc1 = ctx.createOscillator();
			const gain1 = ctx.createGain();
			osc1.type = "sine";
			osc1.frequency.setValueAtTime(880, now);
			gain1.gain.setValueAtTime(0.05, now);
			gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
			osc1.connect(gain1);
			gain1.connect(ctx.destination);
			osc1.start(now);
			osc1.stop(now + 0.09);

			// Ping 2 (higher fifth)
			const osc2 = ctx.createOscillator();
			const gain2 = ctx.createGain();
			osc2.type = "sine";
			osc2.frequency.setValueAtTime(1318.5, now + 0.06);
			gain2.gain.setValueAtTime(0.04, now + 0.06);
			gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
			osc2.connect(gain2);
			gain2.connect(ctx.destination);
			osc2.start(now + 0.06);
			osc2.stop(now + 0.17);
		} catch {
			// Ignore
		}
	}

	// Clean completion chime
	public playSuccess() {
		if (this.muted) return;
		const ctx = this.getContext();
		if (!ctx) return;

		try {
			const now = ctx.currentTime;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sine";
			osc.frequency.setValueAtTime(587.33, now); // D5
			osc.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5

			gain.gain.setValueAtTime(0.04, now);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

			osc.connect(gain);
			gain.connect(ctx.destination);

			osc.start(now);
			osc.stop(now + 0.15);
		} catch {
			// Ignore
		}
	}
}

export const sounds = new SoundManager();
