import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { ledgerFields } from "./schema.js";

const ledgerDir = join(process.cwd(), ".context", "ledger");
const ledgerFile = join(ledgerDir, "requests.jsonl");

function ensureRecordShape(record) {
  for (const field of ledgerFields) {
    if (!(field in record)) {
      throw new Error(`Ledger record missing required field: ${field}`);
    }
  }
}

export async function appendLedgerRecord(record) {
  const fullRecord = {
    ...record,
    created_at: new Date().toISOString()
  };

  ensureRecordShape(fullRecord);

  await mkdir(ledgerDir, { recursive: true });
  await appendFile(ledgerFile, `${JSON.stringify(fullRecord)}\n`, "utf8");
}
