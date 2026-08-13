import { google } from "googleapis";
import { createGoogleAuth } from "./backend/apis/google/googleAuth";

async function main() {
    const auth = createGoogleAuth(["https://www.googleapis.com/auth/spreadsheets"]);
    const sheets = google.sheets({ version: "v4", auth });
    const sheetId = "1epFqaKMo1tpr2bgC2JbrQJM_yVTYz3q78zuOBaaBM_Q";

    try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheetTitle = meta.data.sheets?.[0]?.properties?.title || "Sheet1";
        console.log("Sheet Title:", sheetTitle);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${sheetTitle}!A1:ZZ100`
        });
        console.log("Values in Sheet:");
        console.log(JSON.stringify(response.data.values, null, 2));
    } catch (e: any) {
        console.error("Error reading sheet:", e.message);
    }
}

main();
