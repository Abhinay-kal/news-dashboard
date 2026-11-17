import { captureP0Screenshots } from "./services/directScraperService";
captureP0Screenshots().then(() => {
  console.log("Done");
  process.exit(0);
}).catch(console.error);
