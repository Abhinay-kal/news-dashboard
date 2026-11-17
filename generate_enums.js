const fs = require('fs');

const rounds = ['ROUND_1', 'ROUND_2', 'ROUND_3', 'STRAY_VACANCY'];
const subStages = [
    'REGISTRATION',
    'PROVISIONAL_SEAT_MATRIX',
    'FINAL_SEAT_MATRIX',
    'CHOICE_FILLING',
    'CHOICE_LOCKING',
    'PROVISIONAL_MERIT_LIST',
    'GRIEVANCE',
    'FINAL_MERIT_LIST',
    'SEAT_ALLOCATION_REPORTING'
];

const modifiers = ['OPEN', 'CLOSED', 'EXTENDED', 'POSTPONED', 'RELEASED'];

let enumStr = `export enum ConfidenceEnum {
    HIGH = 'HIGH',
    MEDIUM = 'MEDIUM',
    LOW = 'LOW'
}

export enum ValidationStatus {
    VERIFIED = 'VERIFIED',
    NEEDS_VERIFICATION = 'NEEDS_VERIFICATION',
    CONFLICTING = 'CONFLICTING',
    UNKNOWN = 'UNKNOWN'
}

export enum StateType {
    STATE = 'STATE',
    UT = 'UT',
    CENTRAL = 'CENTRAL'
}

export enum CounsellingStatus {
    NOT_ANNOUNCED = 'NOT_ANNOUNCED',\n`;

for (const r of rounds) {
    for (const s of subStages) {
        if (s.includes('MATRIX') || s.includes('LIST')) {
            // Lists are just RELEASED or POSTPONED
            enumStr += `    ${r}_${s}_RELEASED = '${r}_${s}_RELEASED',\n`;
            enumStr += `    ${r}_${s}_POSTPONED = '${r}_${s}_POSTPONED',\n`;
        } else {
            // Registration, Choice Filling, Grievance, Reporting have windows
            enumStr += `    ${r}_${s}_OPEN = '${r}_${s}_OPEN',\n`;
            enumStr += `    ${r}_${s}_CLOSED = '${r}_${s}_CLOSED',\n`;
            enumStr += `    ${r}_${s}_EXTENDED = '${r}_${s}_EXTENDED',\n`;
            enumStr += `    ${r}_${s}_POSTPONED = '${r}_${s}_POSTPONED',\n`;
        }
    }
}

enumStr += `    COUNSELLING_COMPLETED = 'COUNSELLING_COMPLETED',
    UNKNOWN = 'UNKNOWN'
}

export enum EventType {
    REGISTRATION_START = 'REGISTRATION_START',
    REGISTRATION_END = 'REGISTRATION_END',
    MERIT_LIST_DATE = 'MERIT_LIST_DATE',
    CHOICE_FILLING_START = 'CHOICE_FILLING_START',
    CHOICE_FILLING_END = 'CHOICE_FILLING_END',
    SEAT_ALLOTMENT_DATE = 'SEAT_ALLOTMENT_DATE',
    REPORTING_START = 'REPORTING_START',
    REPORTING_END = 'REPORTING_END'
}

export enum SourceType {
    GOVERNMENT = 'GOVERNMENT',
    INSTITUTIONAL = 'INSTITUTIONAL',
    SECONDARY = 'SECONDARY'
}
`;

fs.writeFileSync('server/src/models/neet/enums.ts', enumStr);
