const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://pppixokibnqfzhxyftmt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwcGl4b2tpYm5xZnpoeHlmdG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTk5NDIyODcsImV4cCI6MjAxNTUxODI4N30.d-eAm-1QhKK5AKv4nQ7k1c-z0H1Nt4_gFYd5-xR3lPY";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function queryOlga() {
  const { data, error } = await supabase
    .from("staff_panels")
    .select("id, email, password_hash, is_active, staff_id")
    .eq("email", "olga@handyy.com")
    .single();

  if (error) {
    console.log("Error:", error.message);
  } else {
    console.log("Olga staff_panels:");
    console.log(JSON.stringify(data, null, 2));
  }
}

queryOlga().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
