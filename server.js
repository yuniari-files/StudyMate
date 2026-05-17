/**
 * StudyMate — Backend Server
 * Node.js + Express
 * Setiap mata kuliah punya file JSON sendiri di /data/
 */

const express    = require('express');
const fs         = require('fs');
const path       = require('path');
const multer     = require('multer');
const cors       = require('cors');

const app  = express();
const PORT = 6767;

const DATA_DIR    = path.join(__dirname, 'data');
const UPLOAD_DIR  = path.join(__dirname, 'uploads');
const INDEX_FILE  = path.join(DATA_DIR, '_index.json'); // daftar semua matkul

// ── Pastikan folder ada ──
[DATA_DIR, UPLOAD_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
if (!fs.existsSync(INDEX_FILE)) fs.writeFileSync(INDEX_FILE, JSON.stringify([], null, 2));

// ── Middleware ──
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname)));      // serve HTML/CSS/JS
app.use('/uploads', express.static(UPLOAD_DIR));    // serve gambar

// ── Multer untuk upload gambar ──
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename:    (_, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════
/** Slug aman untuk nama file JSON */
function toSlug(name) {
  return name.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .slice(0, 40) || 'matkul';
}

/** Baca _index.json */
function readIndex() {
  return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
}

/** Tulis _index.json */
function writeIndex(data) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2));
}

/** Path file JSON matkul berdasarkan slug */
function courseFile(slug) {
  return path.join(DATA_DIR, `${slug}.json`);
}

/** Baca data matkul dari file JSON-nya */
function readCourse(slug) {
  const f = courseFile(slug);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

/** Tulis data matkul ke file JSON-nya */
function writeCourse(slug, data) {
  fs.writeFileSync(courseFile(slug), JSON.stringify(data, null, 2));
}

// ══════════════════════════════════════════════════════════
// ROUTES — INDEX
// ══════════════════════════════════════════════════════════

/** GET /api/courses — semua matkul (metadata saja) */
app.get('/api/courses', (_, res) => {
  const index = readIndex();
  // sertakan jumlah materi dari file masing-masing
  const courses = index.map(c => {
    const data = readCourse(c.slug);
    return { ...c, materialCount: data ? data.materials.length : 0 };
  });
  res.json(courses);
});

/** POST /api/courses — buat matkul baru → buat file {slug}.json */
app.post('/api/courses', (req, res) => {
  const { name, code, emoji, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama wajib diisi' });

  const index = readIndex();

  // buat slug unik
  let slug = toSlug(name);
  let counter = 1;
  while (index.find(c => c.slug === slug)) { slug = `${toSlug(name)}_${counter++}`; }

  const course = {
    id:        `c_${Date.now()}`,
    slug,
    name,
    code:      code || '',
    emoji:     emoji || '📚',
    color:     color || 'linear-gradient(135deg,#ff5c35,#ff8c6b)',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // tulis ke _index.json
  index.push({ id: course.id, slug, name, code: course.code, emoji: course.emoji, color: course.color, createdAt: course.createdAt, updatedAt: course.updatedAt });
  writeIndex(index);

  // buat file {slug}.json
  writeCourse(slug, { ...course, materials: [] });

  console.log(`[CREATE] ${slug}.json — ${name}`);
  res.status(201).json(course);
});

/** DELETE /api/courses/:id — hapus matkul + file JSON-nya */
app.delete('/api/courses/:id', (req, res) => {
  let index = readIndex();
  const entry = index.find(c => c.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Tidak ditemukan' });

  // hapus file JSON matkul
  const f = courseFile(entry.slug);
  if (fs.existsSync(f)) fs.unlinkSync(f);

  // hapus dari index
  index = index.filter(c => c.id !== req.params.id);
  writeIndex(index);

  console.log(`[DELETE] ${entry.slug}.json — ${entry.name}`);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════
// ROUTES — MATERI
// ══════════════════════════════════════════════════════════

/** GET /api/courses/:id/materials — semua materi matkul tertentu */
app.get('/api/courses/:id/materials', (req, res) => {
  const index = readIndex();
  const entry = index.find(c => c.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Matkul tidak ditemukan' });

  const data = readCourse(entry.slug);
  res.json(data ? data.materials : []);
});

/** POST /api/courses/:id/materials — tambah materi, upload gambar */
app.post('/api/courses/:id/materials', upload.single('image'), (req, res) => {
  const index = readIndex();
  const entry = index.find(c => c.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Matkul tidak ditemukan' });

  const { title, notes, tags } = req.body;
  if (!title) return res.status(400).json({ error: 'Judul wajib diisi' });

  const data = readCourse(entry.slug);
  if (!data) return res.status(500).json({ error: 'File matkul rusak' });

  const material = {
    id:       `m_${Date.now()}`,
    title,
    notes:    notes || '',
    tags:     tags ? JSON.parse(tags) : [],
    date:     new Date().toISOString(),
    filename: req.file ? req.file.filename : null,
    imgUrl:   req.file ? `/uploads/${req.file.filename}` : null,
  };

  data.materials.push(material);
  data.updatedAt = new Date().toISOString();
  writeCourse(entry.slug, data);

  // update updatedAt di index
  const idx = index.findIndex(c => c.id === req.params.id);
  index[idx].updatedAt = data.updatedAt;
  writeIndex(index);

  console.log(`[MATERIAL] ${entry.slug}.json ← "${title}"`);
  res.status(201).json(material);
});

/** PUT /api/courses/:id/materials — Update materi yang sudah ada */
// ENDPOINT BARU: Untuk menyimpan perubahan materi (EDIT)
app.put('/api/courses/:id/materials', (req, res) => {
  const { id: courseId } = req.params;
  const { id: materiId, title, notes } = req.body;

  const index = readIndex();
  const entry = index.find(c => c.id === courseId);
  if (!entry) return res.status(404).json({ error: 'Mata kuliah tidak ditemukan' });

  const data = readCourse(entry.slug);
  if (!data) return res.status(500).json({ error: 'File data rusak' });

  // Cari materi berdasarkan ID
  const mIdx = data.materials.findIndex(m => m.id === materiId);
  if (mIdx === -1) return res.status(404).json({ error: 'Materi tidak ditemukan' });

  // Update datanya
  data.materials[mIdx].title = title;
  data.materials[mIdx].notes = notes;
  data.updatedAt = new Date().toISOString();

  writeCourse(entry.slug, data);
  console.log(`[EDIT SAVED] ${entry.slug}.json updated`);
res.json({ success: true, message: 'Updated' });
});

/** DELETE /api/courses/:id/materials/:mid — hapus materi */
app.delete('/api/courses/:id/materials/:mid', (req, res) => {
  const index = readIndex();
  const entry = index.find(c => c.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Matkul tidak ditemukan' });

  const data = readCourse(entry.slug);
  if (!data) return res.status(500).json({ error: 'File matkul rusak' });

  const mat = data.materials.find(m => m.id === req.params.mid);
  if (!mat) return res.status(404).json({ error: 'Materi tidak ditemukan' });

  // hapus file gambar jika ada
  if (mat.filename) {
    const imgPath = path.join(UPLOAD_DIR, mat.filename);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  data.materials = data.materials.filter(m => m.id !== req.params.mid);
  data.updatedAt = new Date().toISOString();
  writeCourse(entry.slug, data);

  console.log(`[DEL-MAT] ${entry.slug}.json ← "${mat.title}"`);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════
// KODE BARU:
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 StudyMate berjalan di http://localhost:${PORT}`);
  console.log(`📁 Data JSON tersimpan di: ${DATA_DIR}`);
  console.log(`🖼️  Gambar tersimpan di:   ${UPLOAD_DIR}\n`);
});
