import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { LedgerEntry } from "./schema";

const LEDGER_PATH = join(process.cwd(), "db", "ledger.jsonl");

export async function appendLedgerEntry(entry: LedgerEntry): Promise<void> {
  await mkdir(dirname(LEDGER_PATH), { recursive: true });
  await appendFile(LEDGER_PATH, `${JSON.stringify(entry)}\n`, "utf8");
}
