export function log(event: Record<string, unknown>) {
  const base = { ts: new Date().toISOString(), app: "xbot" };
  const scrubbed = JSON.parse(JSON.stringify(event, (k, v) => {
    if (typeof v === "string" && /key|token|secret/i.test(k)) return "[redacted]";
    return v;
  }));
  console.log(JSON.stringify({ ...base, ...scrubbed }));
}

