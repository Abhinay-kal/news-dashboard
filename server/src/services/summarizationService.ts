// Native fetch is used
/**
 * CATEGORIZATION (Keyword Matching)
 * A fast, cost-free way to assign a general topic based on common keywords.
 */
export function determineCategory(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.match(/\b(jee|neet|josaa|csab|nta|cbse|ncert|ugc|aicte|coaching|board exam|admission|counsell|counseling|scholarship|exam result|education ministry)\b/)) {
    return 'Education';
  }
  if (lowerText.match(/\b(ai|artificial intelligence|machine learning|llm|openai|google)\b/)) {
    return 'AI & Tech';
  }
  if (lowerText.match(/\b(startup|funding|vc|raised|valuation|founder)\b/)) {
    return 'Startups & Business';
  }
  if (lowerText.match(/\b(crypto|bitcoin|ethereum|blockchain|web3)\b/)) {
    return 'Crypto';
  }
  if (lowerText.match(/\b(stock|market|economy|inflation|fed|revenue)\b/)) {
    return 'Finance';
  }
  
  return 'General';
}

/**
 * SUMMARIZATION (LLM)
 * Uses an AI API to read the full text and extract exactly 3 bullet points.
 */
export async function generateSummary(text: string): Promise<string[]> {
  console.log('[Summarization] Calling LLM API...');
  
  if (!process.env.API_KEY) {
    console.warn("[Summarization] No API_KEY found in .env, falling back to placeholders.");
    return [
      "This is a placeholder bullet point 1 (Missing API Key).",
      "This is a placeholder bullet point 2.",
      "This is a placeholder bullet point 3."
    ];
  }

  try {
    const prompt = `You are a professional news summarizer. Read the following text and extract the most important information into exactly 3 concise bullet points. 
    Return your response strictly as a raw JSON array of 3 strings. Do NOT wrap it in \`\`\`json markdown blocks, just return the raw array brackets [].
    
    Text:
    ${text.substring(0, 6000)}`;

    let responseJson: any;
    let retries = 3;
    
    while (retries > 0) {
      try {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });
        
        responseJson = await res.json();
        
        if (!res.ok) {
          if (res.status === 429 && retries > 1) {
            console.log("[Summarization] Rate limit (429) hit. Pausing for 15 seconds...");
            await new Promise(resolve => setTimeout(resolve, 15000));
            retries--;
            continue;
          }
          throw new Error(JSON.stringify(responseJson));
        }
        break; 
      } catch (err: any) {
        if (retries === 1) throw err;
        retries--;
      }
    }

    const output = responseJson?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const cleanOutput = output.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    const parsed = JSON.parse(cleanOutput);
    if (Array.isArray(parsed) && parsed.length >= 3) {
      return parsed.slice(0, 3);
    }
    
    // Fallback if the array is malformed
    return ["Summary generated but in invalid format.", "Could not extract 3 bullets.", ""];
  } catch (error) {
    console.error("[Summarization] LLM Error:", error);
    return [
      "Failed to generate summary.",
      "An error occurred while contacting the AI.",
      ""
    ];
  }
}
