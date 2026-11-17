import { VerificationEngine } from "../verificationEngine";
import { ConfidenceEnum, SourceType, CounsellingStatus } from "../../models/neet/enums";

describe("VerificationEngine", () => {
	let engine: VerificationEngine;

	beforeEach(() => {
		engine = new VerificationEngine();
	});

	describe("evaluateConfidence", () => {
		it("should return HIGH for .gov.in domains", () => {
			const confidence = engine.evaluateConfidence("https://upneet.gov.in/notice", SourceType.GOVERNMENT);
			expect(confidence).toBe(ConfidenceEnum.HIGH);
		});

		it("should return HIGH for .nic.in domains", () => {
			const confidence = engine.evaluateConfidence("https://mcc.nic.in/ug-counselling", SourceType.GOVERNMENT);
			expect(confidence).toBe(ConfidenceEnum.HIGH);
		});

		it("should return MEDIUM for .ac.in domains", () => {
			const confidence = engine.evaluateConfidence("https://uhsr.ac.in/notice", SourceType.INSTITUTIONAL);
			expect(confidence).toBe(ConfidenceEnum.MEDIUM);
		});

		it("should return LOW for news sites or unknown domains", () => {
			const confidence = engine.evaluateConfidence("https://timesofindia.indiatimes.com/news", SourceType.SECONDARY);
			expect(confidence).toBe(ConfidenceEnum.LOW);
		});
	});

	describe("canOverride (Private Method Exposure for Test)", () => {
		it("should allow HIGH confidence to override HIGH confidence", () => {
			// Using any to test private method logic for QA phase
			const result = (engine as any).canOverride("ANNOUNCED", "REGISTRATION_OPEN", "HIGH", "HIGH");
			expect(result).toBe(true);
		});

		it("should block LOW confidence from overriding HIGH confidence (Conflict Detection)", () => {
			const result = (engine as any).canOverride("ANNOUNCED", "REGISTRATION_OPEN", "LOW", "HIGH");
			expect(result).toBe(false); // News site cannot trigger registration state if official site hasn't
		});

		it("should allow LOW confidence to override LOW confidence", () => {
			const result = (engine as any).canOverride("NOT_ANNOUNCED", "ANNOUNCED", "LOW", "LOW");
			expect(result).toBe(true);
		});
	});
});
