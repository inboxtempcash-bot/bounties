import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".autorouter");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

async function readConfigFile() {
  try {
    const raw = await readFile(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch (_error) {
    return {};
  }
}

async function writeConfigFile(config) {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function getConfig() {
  return readConfigFile();
}

export async function setConfig(updates) {
  const current = await readConfigFile();
  const next = {
    ...current,
    ...updates
  };
  await writeConfigFile(next);
  return next;
}

export { CONFIG_FILE };

