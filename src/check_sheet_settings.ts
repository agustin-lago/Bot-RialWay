import { createClient } from "@supabase/supabase-js";
import { vault } from "./backend/db/vault";

const supabase = createClient(vault.supabaseUrl, vault.supabaseKey);

async function main() {
    const { data: rows, error } = await supabase
        .from('settings')
        .select('*')
        .eq('project_id', '79cbfba7-d278-4298-84d3-a29ad021b579')
        .eq('key', 'SHEET_ID_UPDATE');

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Settings for SHEET_ID_UPDATE:");
        console.log(JSON.stringify(rows, null, 2));
    }
}

main();
