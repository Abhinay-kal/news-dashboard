import fs from "fs";
import axios from "axios";
import * as cheerio from "cheerio";
import https from "https";

const targets = [
	{ name: "NTA", url: "https://nta.ac.in/NoticeBoard", category: "national" },
	{ name: "CBSE", url: "https://www.cbse.gov.in/cbsenew/cbse.html", category: "national" },
	{ name: "MCC", url: "https://mcc.nic.in/", category: "national" },
	{ name: "JoSAA", url: "https://josaa.nic.in/", category: "national" },
	{ name: "CSAB", url: "https://csab.nic.in/", category: "national" },
	{ name: "NMC", url: "https://www.nmc.org.in/", category: "national" },
	{ name: "UGC", url: "https://www.ugc.gov.in/", category: "national" },
	{ name: "RBSE", url: "https://rajeduboard.rajasthan.gov.in/", category: "national" },
	{ name: "Andhra Pradesh", url: "https://drntr.uhsap.in/index/", category: "counselling" },
	{ name: "Arunachal Pradesh", url: "https://apdhte.nic.in/", category: "counselling" },
	{ name: "Assam", url: "https://dme.assam.gov.in/", category: "counselling" },
	{ name: "Bihar", url: "https://bceceboard.bihar.gov.in/", category: "counselling" },
	{ name: "Chhattisgarh", url: "https://cgdme.in/", category: "counselling" },
	{ name: "Goa", url: "https://dte.goa.gov.in/", category: "counselling" },
	{ name: "Gujarat", url: "https://www.medadmgujarat.org/", category: "counselling" },
	{ name: "Haryana", url: "https://dmer.haryana.gov.in/", category: "counselling" },
	{ name: "Himachal Pradesh", url: "https://amruhp.ac.in/", category: "counselling" },
	{ name: "Jharkhand", url: "https://jceceb.jharkhand.gov.in/", category: "counselling" },
	{ name: "Karnataka", url: "https://cetonline.karnataka.gov.in/kea/", category: "counselling" },
	{ name: "Kerala", url: "https://cee.kerala.gov.in/cee/index.php", category: "counselling" },
	{ name: "Madhya Pradesh", url: "https://dme.mponline.gov.in/Portal/Services/DMEMP/DMEUG/Profile/ProfileLoginHome.aspx", category: "counselling" },
	{ name: "Maharashtra", url: "https://cetcell.mahacet.org/", category: "counselling" },
	{ name: "Manipur", url: "https://manipurhealthdirectorate.mn.gov.in/", category: "counselling" },
	{ name: "Meghalaya", url: "https://www.meghealth.gov.in/", category: "counselling" },
	{ name: "Mizoram", url: "https://dhte.mizoram.gov.in/", category: "counselling" },
	{ name: "Nagaland", url: "https://dte.nagaland.gov.in/", category: "counselling" },
	{ name: "Odisha", url: "https://ojee.nic.in/", category: "counselling" },
	{ name: "Punjab", url: "https://bfuhs.ggsmch.org/", category: "counselling" },
	{ name: "Rajasthan", url: "https://ug.neetrajasthan.com/home", category: "counselling" },
	{ name: "Sikkim", url: "https://statequota.sikkim.gov.in/", category: "counselling" },
	{ name: "Tamil Nadu", url: "https://tnmedicalselection.net/", category: "counselling" },
	{ name: "Telangana", url: "https://www.knruhs.telangana.gov.in/", category: "counselling" },
	{ name: "Tripura", url: "https://trmcc.admissions.nic.in/", category: "counselling" },
	{ name: "Uttar Pradesh", url: "https://dgme.up.gov.in/", category: "counselling" },
	{ name: "Uttarakhand", url: "https://www.hnbumu.ac.in/", category: "counselling" },
	{ name: "West Bengal", url: "https://wbmcc.nic.in/", category: "counselling" }
];

const agent = new https.Agent({ rejectUnauthorized: false });

async function findBestSelector(url: string): Promise<string> {
    try {
        const response = await axios.get(url, { httpsAgent: agent, timeout: 8000 });
        const $ = cheerio.load(response.data);
        
        const candidateSelectors = [
            "#notice-board-container a",
            ".latest-updates marquee a",
            ".notice-board a",
            "#notice a",
            ".notice a",
            ".news a",
            "#news a",
            "marquee a",
            ".marquee a",
            "#updates a",
            ".updates a",
            ".Whatsnew a",
            ".circulars a",
            "#announcements a",
            ".news-events a",
            ".latest-news a"
        ];
        
        for (const sel of candidateSelectors) {
            if ($(sel).length > 0) return sel;
        }
        
        return "a";
    } catch(e) {
        return "a";
    }
}

async function run() {
    let output = "export const P0_TARGETS = [\n";
    for (const t of targets) {
        console.log("Checking " + t.name);
        // Hardcode a few we know
        let sel = "a";
        if (t.name === "NTA") sel = ".tab-content a"; // NTA Notice board uses tabs usually
        else if (t.name === "MCC") sel = "marquee a"; 
        else sel = await findBestSelector(t.url);
        
        output += `  { name: "${t.name}", url: "${t.url}", selector: "${sel}", category: "${t.category}" },\n`;
    }
    output += "];\n";
    fs.writeFileSync("new_targets.ts", output);
    console.log("Done. Wrote to new_targets.ts");
}

run();
