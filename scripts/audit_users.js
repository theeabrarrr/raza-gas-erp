const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envPath = path.resolve(__dirname, '../.env.local');
let env = {};
try {
    const data = fs.readFileSync(envPath, 'utf8');
    data.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            env[key.trim()] = value.trim();
        }
    });
} catch (e) {
    console.error("Could not read .env.local");
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deepAudit() {
    console.log("--- 1. Checking 'users' table (ALL ROWS) ---");
    const { data: users, error } = await supabase
        .from('users')
        .select('*');

    if (error) console.error("Error fetching users:", error.message);
    else {
        console.log(`Found ${users.length} users:`);
        console.table(users.map(u => ({ name: u.name, email: u.email, role: u.role, status: u.status })));
    }

    console.log("\n--- 2. Checking 'profiles' table (if exists) ---");
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*');

    if (pError) {
        console.log("Profiles check:", pError.message || pError.code); // Likely 404 or relation not found
    } else {
        console.log(`Found ${profiles.length} profiles:`);
        console.table(profiles);
    }
}

deepAudit();
