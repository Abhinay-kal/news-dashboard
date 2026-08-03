"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NEGATIVE_KEYWORDS = exports.POSITIVE_KEYWORDS = void 0;
exports.evaluateArticleRelevance = evaluateArticleRelevance;
exports.POSITIVE_KEYWORDS = [
    "Matrix Education", "Matrix Sikar", "Matrix Academy", "Matrix JEE", "Matrix NEET",
    "Matrix Olympiad", "Matrix Foundation", "Matrix High School", "Matrix scholarship test", "MOF",
    "CLC Sikar", "Choudhary Coaching", "Gurukripa Career Institute", "GCI Sikar", "Prince Career Pioneer",
    "PCP Sikar", "Kautilya Sikar", "Allen Sikar", "PW Sikar", "Physics Wallah Sikar",
    "Allen Career Institute", "Physics Wallah", "PW Vidyapeeth", "Aakash Institute", "Aakash BYJU",
    "Motion Education", "Nitin Vijay", "Resonance Kota", "Narayana Educational Institutions", "Sri Chaitanya",
    "FIITJEE", "Unacademy Centre", "Vibrant Academy", "National Testing Agency", "NTA",
    "JEE Main", "JEE Advanced", "NEET UG", "NEET 2026", "JoSAA", "CSAB",
    "Ministry of Education", "MoE", "UGC", "AICTE", "NCERT", "CBSE",
    "Medical Counselling Committee", "MCC", "Coaching guidelines", "Dummy school", "Non-attending school",
    "District Collector Sikar", "Sikar DM", "Sikar Hostel", "Hostel association Sikar", "Rajasthan coaching bill",
    "Rajasthan coaching regulation", "Mental health coaching", "Student suicide", "Fee refund policy", "Refund rules",
    "Fire NOC coaching", "Safety audit Sikar", "Supreme Court NEET", "Supreme Court JEE", "Rajasthan High Court",
    "PIL coaching", "CBI exam leak", "Paper leak", "सीकर कोचिंग", "मैट्रिक्स सीकर",
    "एनटीए ताज़ा खबर", "कोचिंग गाइडलाइन", "हॉस्टल नियम सीकर", "नीट परीक्षा", "जी मेन"
];
exports.NEGATIVE_KEYWORDS = [
    // SEO & Organic Search Spam
    "How to prepare for", "Sample paper PDF", "Answer key PDF download", "Chapter-wise weightage",
    "Best books for JEE", "Mock test series online buy", "Important questions for", "Cutoff prediction calculator",
    "Top 10 tips to crack", "How to crack", "Daily timetable", "Mistakes to avoid", "Download FREE",
    // Speculative & "No-Update" Clickbait
    "Expected Soon", "Check direct link", "Answer Key expected", "Is NEET UG result released", "Stay tuned on this page",
    // Unrelated Competitive Exams
    "SSC CGL", "CHSL", "UPSC", "IBPS", "SBI PO", "RRB", "NDA", "CDS", "AFCAT", "REET", "CTET",
    "GATE", "CAT", "XAT", "MAT", "GRE", "GMAT", "IELTS", "TOEFL", "USMLE", "CLAT", "CA/CS/CMA", "UPPSC", "BPSC",
    // Private University Lead Generation
    "Direct admission", "low JEE percentile", "LPU", "Amity", "Chandigarh University", "Bennett",
    "Study MBBS in", "foreign engineering scholarships",
    // Non-Target Regional School Boards
    "UP Board", "BSEB", "MSBSHSE", "WBCHSE", "Karnataka SSLC", "MP Board",
    // Commercial PR & Ads
    "Why X Coaching is the best", "5 reasons to join", "Top 5 apps", "Best tablets", "Discount code", "Buy Allen test series",
    // Social Media Lead Traps
    "Join Telegram group", "WhatsApp group"
];
/**
 * Evaluates whether an article is relevant based on positive and negative keyword matching.
 * Returns an object with `isRelevant` boolean and a `reason` string for logging.
 */
function evaluateArticleRelevance(title, contentSnippet) {
    const textToEvaluate = `${title} ${contentSnippet}`.toLowerCase();
    // 1. Check for Negative Keywords (Hard Reject)
    for (const keyword of exports.NEGATIVE_KEYWORDS) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(textToEvaluate)) {
            return { isRelevant: false, reason: `Contains negative keyword: "${keyword}"` };
        }
    }
    // 2. Check for Positive Keywords (Accept)
    for (const keyword of exports.POSITIVE_KEYWORDS) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(textToEvaluate)) {
            return { isRelevant: true, reason: `Contains positive keyword: "${keyword}"` };
        }
    }
    // 3. Default Reject (if it contains neither, it's likely noise)
    return { isRelevant: false, reason: "Does not contain any highly relevant positive keywords." };
}
//# sourceMappingURL=filteringService.js.map