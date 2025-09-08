import { createClient } from "@supabase/supabase-js";
import Redis from "ioredis";
import { config } from "dotenv";

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;
const redisUrl = process.env.REDIS_URL;

if (!supabaseUrl || !supabaseKey) {
  console.log("Supabase: ERR (missing config)");
  console.log("Redis:", redisUrl ? "checking..." : "ERR (missing config)");
  process.exit(0);
}

const s = createClient(supabaseUrl, supabaseKey);
const r = redisUrl ? new Redis(redisUrl) : null;

(async () => {
  try {
    const { data, error } = await s.from("posts").select("id").limit(1);
    console.log("Supabase:", error ? "ERR" : "OK");
  } catch (err) {
    console.log("Supabase: ERR");
  }
  
  if (r) {
    try {
      await r.ping();
      console.log("Redis: OK");
    } catch (err) {
      console.log("Redis: ERR");
    }
  } else {
    console.log("Redis: ERR (missing config)");
  }
  
  process.exit(0);
})();
