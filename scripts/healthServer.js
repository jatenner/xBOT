"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = require("dotenv");
// Load environment variables
(0, dotenv_1.config)();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const redisUrl = process.env.REDIS_URL;
if (!supabaseUrl || !supabaseKey) {
    console.log("Supabase: ERR (missing config)");
    console.log("Redis:", redisUrl ? "checking..." : "ERR (missing config)");
    process.exit(0);
}
const s = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
const r = redisUrl ? new ioredis_1.default(redisUrl) : null;
(async () => {
    try {
        const { data, error } = await s.from("posts").select("id").limit(1);
        console.log("Supabase:", error ? "ERR" : "OK");
    }
    catch (err) {
        console.log("Supabase: ERR");
    }
    if (r) {
        try {
            await r.ping();
            console.log("Redis: OK");
        }
        catch (err) {
            console.log("Redis: ERR");
        }
    }
    else {
        console.log("Redis: ERR (missing config)");
    }
    process.exit(0);
})();
//# sourceMappingURL=healthServer.js.map