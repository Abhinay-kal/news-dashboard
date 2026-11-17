import { ConfidenceEnum, ValidationStatus, StateType, CounsellingStatus, EventType, SourceType } from "./enums";

export interface State {
	id: string;
	name: string;
	type: StateType;
}

export interface CounsellingAuthority {
	id: string;
	stateId: string;
	name: string;
	primaryWebsite?: string;
	portalWebsite?: string;
}

export interface CounsellingCycle {
	id: string;
	authorityId: string;
	year: number;
	currentStatus: CounsellingStatus;
	statusValidation: ValidationStatus;
}

export interface CounsellingRound {
	id: string;
	cycleId: string;
	roundName: string;
	isActive: boolean;
}

export interface EventModel {
	id: string;
	roundId: string;
	eventType: EventType;
	eventDate: Date | string;
	isTentative: boolean;
}

export interface SourceModel {
	id: string;
	url: string;
	sourceType: SourceType;
	confidence: ConfidenceEnum;
	contentHash?: string;
	publishedAt?: Date | string;
	detectedAt: Date | string;
}

export interface AuditModel {
	id: string;
	cycleId: string;
	statusBefore?: CounsellingStatus;
	statusAfter: CounsellingStatus;
	sourceId?: string;
	changedAt: Date | string;
	reason?: string;
}

// API Models
export interface StateDashboardOverviewAPI {
	states: {
		id: string;
		name: string;
		authority: string;
		currentStage: CounsellingStatus;
		validationStatus: ValidationStatus;
		nextDeadline?: {
			event: EventType;
			date: Date | string;
		};
		lastUpdate: Date | string;
	}[];
	metrics: {
		totalStates: number;
		counsellingAnnounced: number;
		registrationOpen: number;
		choiceFillingOpen: number;
		seatAllotmentActive: number;
		counsellingCompleted: number;
		postponed: number;
		needsVerification: number;
	};
}

export interface StateLifecycleTimelineAPI {
	stateId: string;
	stateName: string;
	authorityName: string;
	primaryWebsite: string;
	cycleYear: number;
	history: {
		changedAt: string;
		statusBefore?: CounsellingStatus;
		statusAfter: CounsellingStatus;
		sourceUrl?: string;
		confidence?: ConfidenceEnum;
		reason?: string;
	}[];
	currentSchedules: {
		roundName: string;
		events: {
			eventType: EventType;
			eventDate: string;
			isTentative: boolean;
		}[];
	}[];
}
