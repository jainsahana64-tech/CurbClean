import express from "express";
import cors from "cors";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- Secret key for login tokens (created once, kept on this computer only) ----------
const SECRET_FILE = path.join(DATA_DIR, "jwt-secret.txt");
if (!fs.existsSync(SECRET_FILE)) {
  fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString("hex"));
}
const JWT_SECRET = fs.readFileSync(SECRET_FILE, "utf8").trim();

// ---------- Database ----------
const db = new DatabaseSync(path.join(DATA_DIR, "curbclear.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'citizen',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_id TEXT NOT NULL UNIQUE,
    user_id INTEGER,
    image_path TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    address TEXT,
    plate TEXT,
    vehicle_type TEXT NOT NULL,
    conditions TEXT NOT NULL,
    duration TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// ---------- App setup ----------
const app = express();
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/] }));
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));

const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/heic": ".heic" };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + (EXT[file.mimetype] || ".jpg")),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in EXT),
});

const VEHICLE_TYPES = ["Car", "Bike / Scooter", "Auto", "Truck / Bus", "Other"];

// ---------- Helpers ----------
const makeToken = (u) => jwt.sign({ id: u.id, role: u.role }, JWT_SECRET, { expiresIn: "7d" });
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

function readToken(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(h.slice(7), JWT_SECRET);
  } catch {
    return null;
  }
}
const optionalAuth = (req, _res, next) => {
  req.auth = readToken(req);
  next();
};
const requireAuth = (req, res, next) => {
  req.auth = readToken(req);
  if (!req.auth) return res.status(401).json({ error: "Please log in first." });
  next();
};

const formatReport = (r) => ({
  id: r.id,
  refId: r.ref_id,
  imageUrl: "/uploads/" + path.basename(r.image_path),
  latitude: r.latitude,
  longitude: r.longitude,
  address: r.address,
  plate: r.plate,
  vehicleType: r.vehicle_type,
  conditions: JSON.parse(r.conditions),
  duration: r.duration,
  notes: r.notes,
  status: r.status,
  createdAt: r.created_at,
});

// ---------- Routes ----------
app.get("/api/health", (_req, res) => res.json({ ok: true, app: "CurbClear" }));

app.post("/api/auth/register", (req, res) => {
  const { name = "", email = "", password = "" } = req.body || {};
  if (!name.trim()) return res.status(400).json({ error: "Please enter your name." });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

  const cleanEmail = email.trim().toLowerCase();
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(cleanEmail)) {
    return res.status(409).json({ error: "An account with this email already exists. Try logging in." });
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
    .run(name.trim(), cleanEmail, hash);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ token: makeToken(user), user: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const { email = "", password = "" } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Wrong email or password." });
  }
  res.json({ token: makeToken(user), user: publicUser(user) });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.auth.id);
  if (!user) return res.status(401).json({ error: "Account not found." });
  res.json({ user: publicUser(user) });
});

// Citizens and guests can both file a report. If a valid login token is sent, the report is linked to that user.
app.post("/api/reports", optionalAuth, upload.single("image"), (req, res) => {
  const b = req.body || {};
  const fail = (msg) => {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: msg });
  };

  if (!req.file) return fail("Please add a photo (JPG, PNG or WebP, up to 8 MB).");

  const lat = b.latitude ? Number(b.latitude) : null;
  const lng = b.longitude ? Number(b.longitude) : null;
  const address = (b.address || "").trim();
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  if (!hasCoords && address.length < 5) return fail("Please share your location or type the address.");

  const noPlate = b.noPlate === "true";
  const plate = (b.plate || "").trim().toUpperCase();
  if (!noPlate && plate.length < 4) return fail("Please type the number plate, or mark it as not visible.");

  if (!VEHICLE_TYPES.includes(b.vehicleType)) return fail("Please choose a valid vehicle type.");

  let conditions;
  try {
    conditions = JSON.parse(b.conditions || "[]");
  } catch {
    conditions = [];
  }
  if (!Array.isArray(conditions) || conditions.length === 0) return fail("Select at least one condition.");

  let refId;
  do {
    refId = "CC-" + crypto.randomInt(100000, 1000000);
  } while (db.prepare("SELECT id FROM reports WHERE ref_id = ?").get(refId));

  db.prepare(
    `INSERT INTO reports
      (ref_id, user_id, image_path, latitude, longitude, address, plate, vehicle_type, conditions, duration, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    refId,
    req.auth ? req.auth.id : null,
    req.file.path,
    hasCoords ? lat : null,
    hasCoords ? lng : null,
    address || null,
    noPlate ? null : plate,
    b.vehicleType,
    JSON.stringify(conditions.map(String)),
    (b.duration || "").slice(0, 60) || null,
    (b.notes || "").trim().slice(0, 500) || null
  );

  res.status(201).json({ refId });
});

app.get("/api/reports/mine", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM reports WHERE user_id = ? ORDER BY id DESC").all(req.auth.id);
  res.json({ reports: rows.map(formatReport) });
});

// ---------- Errors ----------
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: "That photo is too large (maximum 8 MB)." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, () => console.log(`CurbClear server running at http://localhost:${PORT}`));