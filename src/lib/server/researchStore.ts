import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Saved web research, shared by everyone who opens the lot. One record per (APN, law).
 *
 * Two backends behind one interface:
 * - Upstash Redis over its REST API, when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are
 *   set. Use this when deployed: serverless filesystems don't keep writes.
 * - JSON files in data/research/ otherwise (local dev, self-hosting). Committed files also ship
 *   with the app as read-only research.
 */

export interface SavedFinding {
  id: string;
  answer: "yes" | "no" | "unclear";
  summary: string;
  sources: { title: string; url: string }[];
  confidence: "low" | "medium" | "high";
}

export interface SavedResearch {
  apn: string;
  law: string;
  at: string; // ISO time the research finished
  questions: { id: string; label: string }[];
  findings: SavedFinding[];
}

/** law → record */
export type LotResearch = Record<string, SavedResearch>;

interface Store {
  get(apn: string): Promise<LotResearch>;
  put(rec: SavedResearch): Promise<void>;
  kind: "upstash" | "file";
}

const key = (apn: string) => `groundwork:research:${apn}`;

function upstash(url: string, token: string): Store {
  const call = async (cmd: unknown[]) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(cmd),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    return ((await res.json()) as { result: unknown }).result;
  };
  return {
    kind: "upstash",
    async get(apn) {
      const raw = (await call(["GET", key(apn)])) as string | null;
      return raw ? (JSON.parse(raw) as LotResearch) : {};
    },
    async put(rec) {
      const cur = await this.get(rec.apn);
      await call(["SET", key(rec.apn), JSON.stringify({ ...cur, [rec.law]: rec })]);
    },
  };
}

const DIR = path.join(process.cwd(), "data", "research");
const file = (apn: string) => path.join(DIR, `${apn.replace(/[^A-Za-z0-9.-]/g, "_")}.json`);

function files(): Store {
  return {
    kind: "file",
    async get(apn) {
      try {
        return JSON.parse(await fs.readFile(file(apn), "utf8")) as LotResearch;
      } catch {
        return {};
      }
    },
    async put(rec) {
      const cur = await this.get(rec.apn);
      await fs.mkdir(DIR, { recursive: true });
      // Write-then-rename so a crash never leaves half a file.
      const tmp = `${file(rec.apn)}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify({ ...cur, [rec.law]: rec }, null, 2));
      await fs.rename(tmp, file(rec.apn));
    },
  };
}

let store: Store | null = null;
export function researchStore(): Store {
  if (!store) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    store = url && token ? upstash(url, token) : files();
  }
  return store;
}

/** APNs as the app normalizes them: real APNs or the "noapn:" stand-in. Reject anything else. */
export const validApn = (apn: unknown): apn is string => typeof apn === "string" && apn.length <= 64 && /^(noapn:-?[\d.]+,-?[\d.]+|[\d-]{5,20})$/.test(apn);
