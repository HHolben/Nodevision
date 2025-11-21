// Nodevision/routes/api/edges.js
import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../../public/data/edges"); // where buckets live
const router = express.Router();

// ensure directory exists (attempt)
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error("[edges] ensureDataDir error:", err);
  }
}

// unicode-safe first char getter
function firstCharOfLocalName(id) {
  const local = id.split("/").pop() || id;
  return [...local][0] || "_";
}

function bucketFilenameFromSymbol(sym) {
  // Map to safe filename
  const safe = sym === undefined ? "_" : sym;
  return `${safe}.json`;
}

async function readBucketFile(filename) {
  await ensureDataDir();
  const full = path.join(DATA_DIR, filename);
  try {
    const txt = await fs.readFile(full, "utf8");
    return JSON.parse(txt);
  } catch (err) {
    if (err.code === "ENOENT") {
      return {};
    }
    throw err;
  }
}

async function writeBucketFile(filename, obj) {
  await ensureDataDir();
  const full = path.join(DATA_DIR, filename);
  const txt = JSON.stringify(obj, null, 2);
  await fs.writeFile(full, txt, "utf8");
}

router.get("/readEdgeBucket", async (req, res) => {
  // expects ?file=F.json (already encoded)
  try {
    const file = req.query.file;
    if (!file) return res.status(400).json({ error: "Missing file param" });
    const fname = decodeURIComponent(file);
    console.log("[edges] readEdgeBucket", fname);
    const data = await readBucketFile(fname);
    res.json(data);
  } catch (err) {
    console.error("[edges] readEdgeBucket error", err);
    res.status(500).json({ error: err.message });
  }
});

// get edges for a single node id (convenience)
router.get("/edges", async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "Missing id param" });
    const sym = firstCharOfLocalName(id);
    const fname = bucketFilenameFromSymbol(sym);
    const bucket = await readBucketFile(fname);
    const rec = bucket[id] || { edgesFrom: [], edgesTo: [] };
    res.json({ id, edgesFrom: rec.edgesFrom || [], edgesTo: rec.edgesTo || [] });
  } catch (err) {
    console.error("[edges] edges error", err);
    res.status(500).json({ error: err.message });
  }
});

// write/update bucket entry for a single node
router.post("/edges", express.json(), async (req, res) => {
  try {
    const { id, edgesFrom = [], edgesTo = [] } = req.body;
    if (!id) return res.status(400).json({ error: "Missing id in body" });
    const sym = firstCharOfLocalName(id);
    const fname = bucketFilenameFromSymbol(sym);
    const bucket = await readBucketFile(fname);
    bucket[id] = { edgesFrom: Array.from(new Set(edgesFrom)), edgesTo: Array.from(new Set(edgesTo)) };
    await writeBucketFile(fname, bucket);
    res.json({ ok: true, file: fname });
  } catch (err) {
    console.error("[edges] write error", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
