import { CounsellingStatus } from "../models/neet/enums";

const ROUNDS = [
	{ id: "ROUND_1", rank: 100, regex: /\b(round\s*1|round\s*i\b|first\s*round|1st\s*round)\b/i },
	{ id: "ROUND_2", rank: 200, regex: /\b(round\s*2|round\s*ii\b|second\s*round|2nd\s*round)\b/i },
	{ id: "ROUND_3", rank: 300, regex: /\b(round\s*3|round\s*iii\b|third\s*round|3rd\s*round|mop\s*up|mop-up)\b/i },
	{ id: "STRAY_VACANCY", rank: 400, regex: /\b(stray\s*vacancy|stray\s*round)\b/i },
];

const STAGES = [
	{ id: "REGISTRATION", rank: 10, regex: /\b(registration|apply online|application form)\b/i },
	{ id: "PROVISIONAL_SEAT_MATRIX", rank: 20, regex: /\b(provisional\s*seat\s*matrix|tentative\s*seat\s*matrix)\b/i },
	{ id: "FINAL_SEAT_MATRIX", rank: 30, regex: /\b(final\s*seat\s*matrix)\b/i },
	{ id: "CHOICE_FILLING", rank: 40, regex: /\b(choice\s*filling|fill\s*choices|preference\s*form)\b/i },
	{ id: "CHOICE_LOCKING", rank: 50, regex: /\b(choice\s*locking|lock\s*choices)\b/i },
	{
		id: "PROVISIONAL_MERIT_LIST",
		rank: 60,
		regex: /\b(provisional\s*merit\s*list|provisional\s*allotment\s*list|provisional\s*selection\s*list)\b/i,
	},
	{ id: "GRIEVANCE", rank: 70, regex: /\b(grievance|objection|challenge)\b/i },
	{ id: "FINAL_MERIT_LIST", rank: 80, regex: /\b(final\s*merit\s*list|final\s*selection\s*list)\b/i },
	{
		id: "SEAT_ALLOCATION_REPORTING",
		rank: 90,
		regex: /\b(seat\s*allocation|allotment\s*result|reporting|joining|seat\s*allotment)\b/i,
	},
];

const MODIFIERS = {
	ACTIVE: /\b(released|published|declared|started|open|commenced|now\s*active|available)\b/i,
	FUTURE: /\b(expected|will\s*be|shortly|tentative|to\s*be\s*released|upcoming|soon)\b/i,
	CLOSED: /\b(closed|ended|over|deadline\s*passed)\b/i,
	EXTENDED: /\b(extended|prolonged|further\s*notice)\b/i,
	POSTPONED: /\b(postponed|delayed|withheld|suspended|deferred)\b/i,
	DEADLINE:
		/\b(upto|till|before|by|deadline\s*is|ends\s*on)\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\b/i,
};

// 1. STATE-SPECIFIC JARGON MAP
const JARGON_MAP: Record<string, { regex: RegExp; replace: string }[]> = {
	"State Common Entrance Test Cell (CET Cell) Maharashtra": [
		{ regex: /\b(CAP\s*Round\s*1)\b/gi, replace: "Round 1" },
		{ regex: /\b(CAP\s*Round\s*2)\b/gi, replace: "Round 2" },
		{ regex: /\b(CAP\s*Round\s*3)\b/gi, replace: "Round 3" },
		{ regex: /\b(SML|State\s*Merit\s*List)\b/gi, replace: "Provisional Merit List" },
	],
	"Kaloji Narayana Rao University of Health Sciences (KNRUHS)": [
		{ regex: /\b(web\s*options)\b/gi, replace: "Choice Filling" },
		{ regex: /\b(exercising\s*options)\b/gi, replace: "Choice Filling" },
	],
	"Dr. YSR University of Health Sciences": [{ regex: /\b(web\s*options)\b/gi, replace: "Choice Filling" }],
};

export interface InferenceResult {
	status: CounsellingStatus;
	deadline?: string;
}

export function inferCounsellingStatusSync(text: string, authorityName: string): InferenceResult {
	let normalizedText = text;

	if (JARGON_MAP[authorityName]) {
		for (const j of JARGON_MAP[authorityName]) {
			normalizedText = normalizedText.replace(j.regex, j.replace);
		}
	}

	const sentences = normalizedText.split("\n");
	let highestRank = -1;
	let bestStatus: CounsellingStatus | null = null;
	let extractedDeadline: string | undefined = undefined;

	for (const sentence of sentences) {
		if (!sentence.trim()) continue;

		let foundRound = null;
		let foundStage = null;

		for (const r of ROUNDS) {
			if (r.regex.test(sentence)) foundRound = r;
		}
		for (const s of STAGES) {
			if (s.regex.test(sentence)) foundStage = s;
		}

		if (foundRound && foundStage) {
			const isFuture = MODIFIERS.FUTURE.test(sentence);
			const isActive = MODIFIERS.ACTIVE.test(sentence);
			const isClosed = MODIFIERS.CLOSED.test(sentence);
			const isExtended = MODIFIERS.EXTENDED.test(sentence);
			const isPostponed = MODIFIERS.POSTPONED.test(sentence);

			// Extract Deadline Date (2. Auto-Closing Deadlines)
			const deadlineMatch = sentence.match(MODIFIERS.DEADLINE);
			if (deadlineMatch && deadlineMatch[2]) {
				extractedDeadline = deadlineMatch[2]; // e.g. "25th Aug"
			}

			if (isFuture && !isActive && !isPostponed) continue;

			const currentRank = foundRound.rank + foundStage.rank;
			if (currentRank > highestRank) {
				highestRank = currentRank;

				let stateModifier = "";
				const isListStage = foundStage.id.includes("MATRIX") || foundStage.id.includes("LIST");

				if (isListStage) {
					stateModifier = isPostponed ? "POSTPONED" : "RELEASED";
				} else {
					if (isPostponed) stateModifier = "POSTPONED";
					else if (isClosed) stateModifier = "CLOSED";
					else if (isExtended) stateModifier = "EXTENDED";
					else stateModifier = "OPEN";
				}

				const statusStr = `${foundRound.id}_${foundStage.id}_${stateModifier}`;

				if (Object.values(CounsellingStatus).includes(statusStr as CounsellingStatus)) {
					bestStatus = statusStr as CounsellingStatus;
				}
			}
		}
	}

	return {
		status: bestStatus || CounsellingStatus.UNKNOWN,
		deadline: extractedDeadline,
	};
}
