# 📚 StudyMate — Teman Belajar Mahasiswa

Aplikasi web modern untuk menyimpan materi kuliah mahasiswa.
Setiap mata kuliah memiliki **file JSON sendiri** di folder `/data`.

---

## 📁 Struktur Folder

```
studymate/
├── index.html          ← Halaman utama
├── server.js           ← Backend Node.js (API)
├── package.json
│
├── assets/
│   ├── style.css       ← Semua styling
│   └── app.js          ← Semua logika frontend
│
├── data/               ← Otomatis dibuat
│   ├── _index.json     ← Daftar semua matkul
│   ├── basis_data.json ← JSON per matkul (otomatis)
│   ├── pemrograman_web.json
│   └── ...
│
└── uploads/            ← Gambar materi (otomatis dibuat)
    ├── 1700000001_foto.jpg
    └── ...
```

---

## 🚀 Cara Menjalankan

### 1. Install dependencies

```bash
npm install
```

### 2. Jalankan server

```bash
npm start
# atau mode development (auto-restart):
npm run dev
```

### 3. Buka browser

```
http://localhost:3000
```

---

## 📡 API Endpoints

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET    | `/api/courses` | Ambil semua mata kuliah |
| POST   | `/api/courses` | Buat mata kuliah baru (+ buat file JSON) |
| DELETE | `/api/courses/:id` | Hapus matkul + file JSON-nya |
| GET    | `/api/courses/:id/materials` | Ambil semua materi matkul |
| POST   | `/api/courses/:id/materials` | Upload materi baru (+ simpan gambar) |
| DELETE | `/api/courses/:id/materials/:mid` | Hapus materi |

---

## 📄 Contoh File JSON Mata Kuliah

`data/basis_data.json`:
```json
{
  "id": "c_1700000001234",
  "slug": "basis_data",
  "name": "Basis Data",
  "code": "CS301",
  "emoji": "🗄️",
  "color": "linear-gradient(135deg,#3b82f6,#60a5fa)",
  "createdAt": "2024-09-01T08:00:00.000Z",
  "updatedAt": "2024-11-15T14:23:00.000Z",
  "materials": [
    {
      "id": "m_1700000005678",
      "title": "Normalisasi Database 1NF-3NF",
      "notes": "1NF: atomik. 2NF: no partial dep. 3NF: no transitive dep.",
      "tags": ["uts", "penting"],
      "date": "2024-10-01T09:00:00.000Z",
      "filename": "1700000005678_catatan.jpg",
      "imgUrl": "/uploads/1700000005678_catatan.jpg"
    }
  ]
}
```

---

## ✨ Fitur

- **Dashboard** — kartu matkul dengan info file JSON
- **Upload Materi** — drag & drop gambar, tersimpan ke JSON
- **Mode Belajar** — review semua materi + progress tracking
- **Timeline** — perjalanan belajar per tanggal
- **Dark Mode** — toggle gelap/terang
- **Responsive** — mobile & desktop friendly
- **Toast Notification** — feedback tiap aksi

---

## 🛠️ Tech Stack

- **Frontend**: HTML, CSS, Vanilla JS (tanpa framework)
- **Backend**: Node.js + Express
- **Storage**: File JSON per matkul + folder uploads
- **Upload**: Multer (multipart/form-data)
