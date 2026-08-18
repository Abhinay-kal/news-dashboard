const https = require('https');
const fs = require('fs');

const channels = [
  "ALLEN Career Institute",
  "ALLEN Digital",
  "ALLEN Overseas",
  "Physics Wallah",
  "PW NEET",
  "PW JEE",
  "PW Foundation",
  "PW Pathshala",
  "PW OnlyIAS",
  "Aakash BYJU'S",
  "Motion Education",
  "Unacademy JEE",
  "Unacademy NEET",
  "Resonance Kota",
  "Narayana Coaching",
  "Sri Chaitanya",
  "FIITJEE Official",
  "Career Point",
  "Vibrant Academy Kota",
  "Rao IIT Academy",
  "CLC Sikar",
  "Gurukripa Career Institute",
  "Prince Career Pioneer",
  "PCP Sikar",
  "National Testing Agency NTA",
  "Ministry of Education India",
  "CBSE HQ",
  "NCERT Official",
  "AICTE India",
  "UGC India Official",
  "IIT Delhi",
  "IIT Bombay",
  "IIT Madras",
  "IIT Kanpur",
  "IIT Kharagpur",
  "IIT Roorkee",
  "IIT Guwahati",
  "IIT Hyderabad",
  "IIT PAL",
  "Careers360",
  "Shiksha",
  "CollegeDunia",
  "Jagran Josh",
  "Adda247",
  "Testbook",
  "BYJU'S Exam Prep",
  "Unacademy News",
  "NDTV Education",
  "Indian Express",
  "The Hindu",
  "Hindustan Times",
  "Times of India",
  "Rajasthan Education Department",
  "Rajasthan Patrika",
  "Dainik Bhaskar Rajasthan",
  "News18 Rajasthan",
  "Zee Rajasthan",
  "First India News",
  "District Collector Sikar",
  "District Collector Kota",
  "Rajasthan Government"
];

async function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function findHandle(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  try {
    const html = await fetchHTML(url);
    const matches = html.match(/"\/(@[a-zA-Z0-9_-]+)"/g);
    if (!matches) return null;
    
    const counts = {};
    let bestHandle = null;
    let maxCount = 0;
    
    for (const match of matches) {
      const handle = match.replace(/"|\//g, ''); // Extract just @handle
      counts[handle] = (counts[handle] || 0) + 1;
      if (counts[handle] > maxCount) {
        maxCount = counts[handle];
        bestHandle = handle;
      }
    }
    return bestHandle;
  } catch (err) {
    return null;
  }
}

async function main() {
  const results = [];
  for (const channel of channels) {
    console.log(`Searching for ${channel}...`);
    const handle = await findHandle(channel);
    if (handle) {
      console.log(`Found: ${handle}`);
      results.push(`https://www.youtube.com/feeds/videos.xml?user=${handle.substring(1)}`);
    }
    // Sleep a bit to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }
  
  fs.writeFileSync('youtube_urls.json', JSON.stringify(results, null, 2));
  console.log('Done! Saved to youtube_urls.json');
}

main();
