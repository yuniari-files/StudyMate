/**
 * StudyMate — app.js
 * Semua logika frontend: API calls, render, interaksi
 */

// ════════════════════════════════════════════════════════════
// KONFIGURASI & STATE
// ════════════════════════════════════════════════════════════
// KODE BARU:
const API = `http://${window.location.hostname}:6767/api`;

const state = {
  courses:        [],   // [{id, slug, name, code, emoji, color, materialCount, updatedAt}]
  materials:      [],   // materi matkul aktif (diambil saat buka detail)
  currentCourseId: null,
  currentPage:    'dashboard',
  currentFilter:  'all',
  currentSort:    'newest',
  studyProgress:  JSON.parse(localStorage.getItem('sm_progress') || '{}'),
  darkMode:       JSON.parse(localStorage.getItem('sm_dark')     || 'false'),
};

const EMOJIS = ['📚','📖','✏️','🔬','🧮','💻','📊','🎨','🌐','⚙️','🧠','📐','🔭','🏛️','🎓','🌿','⚡','🎵','🧪','📡','🗺️','📏','🔢','💡'];
const COLORS = [
  'linear-gradient(135deg,#ff5c35,#ff8c6b)',
  'linear-gradient(135deg,#3b82f6,#60a5fa)',
  'linear-gradient(135deg,#a855f7,#c084fc)',
  'linear-gradient(135deg,#22c55e,#4ade80)',
  'linear-gradient(135deg,#f59e0b,#fbbf24)',
  'linear-gradient(135deg,#ec4899,#f472b6)',
  'linear-gradient(135deg,#14b8a6,#2dd4bf)',
  'linear-gradient(135deg,#6366f1,#818cf8)',
  'linear-gradient(135deg,#ef4444,#f87171)',
  'linear-gradient(135deg,#0ea5e9,#38bdf8)',
];

let selectedEmoji = EMOJIS[0];
let selectedColor  = COLORS[0];
let selectedFile   = null;
let selectedTags   = [];
let deleteCourseId = null;

// ════════════════════════════════════════════════════════════
// API HELPERS
// ════════════════════════════════════════════════════════════
async function apiFetch(path, opts = {}) {
  try {
    const res = await fetch(API + path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Server error');
    }
    return res.status === 204 ? {} : res.json();
  } catch (e) {
    toast('Koneksi gagal', e.message, 'error');
    throw e;
  }
}

// ════════════════════════════════════════════════════════════
// NAVIGASI
// ════════════════════════════════════════════════════════════
async function navigate(page, courseId = null) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  state.currentPage = page;

  const titles = {
    dashboard: 'Selamat <span>Datang</span> 👋',
    detail:    'Detail <span>Materi</span>',
    study:     'Mode <span>Belajar</span> 📖',
    timeline:  'Timeline <span>Belajar</span> 📅',
  };
  document.getElementById('topbar-title').innerHTML = titles[page] || page;

  const fab = document.getElementById('fab');

  if (page === 'dashboard') {
    fab.classList.remove('hidden');
    fab.onclick = openAddCourseModal;
    await loadCourses();
  }

  if (page === 'detail' && courseId) {
    state.currentCourseId = courseId;
    fab.classList.remove('hidden');
    fab.onclick = () => openAddMaterialModal(courseId);
    await loadDetail(courseId);
  }

  if (page === 'study') {
    fab.classList.add('hidden');
    await renderStudyPage();
  }

  if (page === 'timeline') {
    fab.classList.add('hidden');
    await renderTimeline();
  }

  closeSidebar();
}

// ════════════════════════════════════════════════════════════
// LOAD & RENDER DASHBOARD
// ════════════════════════════════════════════════════════════
async function loadCourses() {
  setLoading('courses-grid', true);
  try {
    state.courses = await apiFetch('/courses');
  } catch { state.courses = []; }
  renderDashboard();
}

function renderDashboard() {
  const today = new Date().toDateString();
  let totalMaterials = 0, todayCount = 0, importantCount = 0;

  // Stats butuh data material — gunakan materialCount dari index
  state.courses.forEach(c => { totalMaterials += (c.materialCount || 0); });
  // todayCount & importantCount butuh detail → skip untuk performa, set 0

  document.getElementById('stat-courses').textContent  = state.courses.length;
  document.getElementById('stat-materials').textContent = totalMaterials;
  document.getElementById('stat-today').textContent    = '~';
  document.getElementById('stat-penting').textContent  = '~';
  document.getElementById('badge-courses').textContent = state.courses.length;

  // Sidebar courses list
  const sidebarList = document.getElementById('sidebar-courses-list');
  sidebarList.innerHTML = state.courses.map(c => `
    <button class="nav-item ${state.currentPage === 'detail' && state.currentCourseId === c.id ? 'active' : ''}"
            onclick="navigate('detail','${c.id}')">
      <span>${c.emoji}</span>${truncate(c.name, 18)}
      <span class="badge">${c.materialCount || 0}</span>
    </button>
  `).join('');

  const grid = document.getElementById('courses-grid');

  if (state.courses.length === 0) {
    grid.innerHTML = `
      <div class="add-course-card" onclick="openAddCourseModal()">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>Tambah Mata Kuliah Pertama</span>
      </div>
      <div style="grid-column:1/-1">
        <div class="empty-state">
          <div class="empty-illustration">🎒</div>
          <div class="empty-title">Mulai Perjalanan Belajarmu!</div>
          <div class="empty-desc">Tambahkan mata kuliah pertamamu. Setiap matkul akan punya file JSON sendiri di folder <code>/data</code>.</div>
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = state.courses.map(c => {
    const lastUpdate = c.updatedAt ? formatDate(new Date(c.updatedAt)) : '-';
    const progress   = 0; // bisa dihitung dari studyProgress jika ada materialId
    return `
      <div class="course-card" onclick="navigate('detail','${c.id}')">
        <div class="course-card-header" style="background:${esc(c.color)}">
          <span class="course-emoji">${c.emoji}</span>
          <div class="course-name">${esc(c.name)}</div>
          <div class="course-code">${esc(c.code || '')}</div>
        </div>
        <div class="course-card-body">
          <div class="json-badge">📄 data/${esc(c.slug)}.json</div>
          <div class="course-meta" style="margin-top:10px">
            <div class="course-meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
              ${c.materialCount || 0} materi
            </div>
            <div class="course-meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${lastUpdate}
            </div>
          </div>
          <div class="course-progress-bar">
            <div class="course-progress-fill" style="width:${progress}%"></div>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:5px">${progress}% dipelajari</div>
        </div>
        <div class="course-card-footer">
          <div class="course-tags">
            <span style="font-size:11px;color:var(--text3)">ID: ${c.id.slice(-6)}</span>
          </div>
          <button class="card-delete-btn" onclick="event.stopPropagation();openDeleteModal('${c.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('') + `
    <div class="add-course-card" onclick="openAddCourseModal()">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span>Tambah Mata Kuliah</span>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
// LOAD & RENDER DETAIL
// ════════════════════════════════════════════════════════════
async function loadDetail(courseId) {
  const course = state.courses.find(c => c.id === courseId);
  if (!course) { navigate('dashboard'); return; }

  // Update hero
  document.getElementById('detail-hero').style.background  = course.color;
  document.getElementById('detail-emoji').textContent       = course.emoji;
  document.getElementById('detail-name').textContent        = course.name;
  document.getElementById('modal-material-subtitle').textContent = `Upload materi ke ${course.name}`;

  // Ambil materi dari API → JSON file matkul
  setLoading('material-grid', false);
  document.getElementById('material-grid').innerHTML = '<div style="grid-column:1/-1;display:flex;justify-content:center;padding:40px"><div class="loading-spinner"></div></div>';

  try {
    state.materials = await apiFetch(`/courses/${courseId}/materials`);
  } catch { state.materials = []; }

  document.getElementById('detail-count').textContent   = `${state.materials.length} materi`;
  document.getElementById('detail-updated').textContent = state.materials.length > 0
    ? 'Update: ' + formatDate(Math.max(...state.materials.map(m => new Date(m.date))))
    : 'Belum ada materi';

  renderMaterialGrid(course);
}

function renderMaterialGrid(course) {
  const grid = document.getElementById('material-grid'); // Pastikan grid terdefinisi
  if (!grid) return;

  // Gunakan state.materials atau data materi yang masuk
  const materials = state.materials || []; 

  if (materials.length === 0) {
    grid.innerHTML = '<div class="empty-state">Belum ada materi.</div>';
    return;
  }

  grid.innerHTML = materials.map(m => `
    <div class="material-card" onclick="showDetail('${m.id}')" style="cursor: pointer;">
      <div class="material-img" onclick="event.stopPropagation(); ${m.imgUrl ? `openImgViewer('${m.imgUrl}')` : ''}">
        ${m.imgUrl 
          ? `<img src="${m.imgUrl}" alt="${esc(m.title)}" loading="lazy">` 
          : `<div style="font-size:48px">${course.emoji || '📚'}</div>`
        }
      </div>
      <div class="material-body">
        <div class="material-tags">${(m.tags||[]).map(t=>`<span class="tag ${t}">${t.toUpperCase()}</span>`).join('')}</div>
        <div class="material-title">${esc(m.title)}</div>
        
        ${m.notes ? `<div class="material-notes ql-editor" style="padding: 0; pointer-events: none;">${m.notes}</div>` : ''}
        
        <div class="material-footer">
          <div class="material-date">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${formatDate(new Date(m.date))}
          </div>
          <div class="material-actions">
            <button class="material-action-btn" onclick="event.stopPropagation(); deleteMaterial('${course.id}','${m.id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}


// ════════════════════════════════════════════════════════════
// STUDY MODE
// ════════════════════════════════════════════════════════════
async function renderStudyPage() {
  // Load semua matkul jika belum ada
  if (state.courses.length === 0) await loadCourses();

  const select = document.getElementById('study-course-select');
  select.innerHTML = '<option value="all">Semua Mata Kuliah</option>' +
    state.courses.map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('');

  await loadStudyMode('all');
}

async function loadStudyMode(courseId) {
  document.getElementById('study-content').innerHTML =
    '<div style="display:flex;justify-content:center;padding:40px"><div class="loading-spinner"></div></div>';

  let allMaterials = [];

  for (const c of state.courses) {
    if (courseId !== 'all' && c.id !== courseId) continue;
    try {
      const mats = await apiFetch(`/courses/${c.id}/materials`);
      mats.forEach(m => allMaterials.push({ ...m, courseName: c.name, courseEmoji: c.emoji, courseColor: c.color, courseId: c.id }));
    } catch { /* skip */ }
  }

  allMaterials.sort((a,b) => new Date(a.date) - new Date(b.date));

  const total   = allMaterials.length;
  const studied = allMaterials.filter(m => state.studyProgress[m.id]).length;
  const pct     = total === 0 ? 0 : Math.round((studied / total) * 100);

  document.getElementById('study-progress-num').textContent = `${studied}/${total}`;
  document.getElementById('study-progress-pct').textContent = pct + '%';
  setTimeout(() => { document.getElementById('study-progress-fill').style.width = pct + '%'; }, 50);

  const content = document.getElementById('study-content');
  if (allMaterials.length === 0) {
    content.innerHTML = `<div class="empty-state"><div class="empty-illustration">📭</div><div class="empty-title">Belum Ada Materi</div><div class="empty-desc">Tambahkan materi ke mata kuliah terlebih dahulu.</div></div>`;
    return;
  }

  content.innerHTML = allMaterials.map((m, i) => {
    const done = state.studyProgress[m.id];
    return `
      <div class="study-card" id="study-${m.id}" style="${done ? 'opacity:0.6' : ''}">
        <div class="study-card-header">
          <div class="study-num" style="background:${done ? '#22c55e' : 'var(--accent)'}">
            ${done ? '✓' : i+1}
          </div>
          <div style="flex:1;min-width:0">
            <div class="study-title">${esc(m.title)}</div>
            <div class="study-meta">${m.courseEmoji} ${esc(m.courseName)} · ${formatDate(new Date(m.date))}</div>
          </div>
          <div class="study-tags-row">
            ${(m.tags||[]).map(t=>`<span class="tag ${t}">${t.toUpperCase()}</span>`).join('')}
            <button class="btn ${done ? 'btn-ghost' : 'btn-primary'}"
                    style="font-size:12px;padding:7px 14px;white-space:nowrap"
                    onclick="toggleStudied('${m.id}','${courseId}')">
              ${done ? '↩ Belum' : '✓ Dipelajari'}
            </button>
          </div>
        </div>
        ${m.imgUrl ? `<img class="study-img" src="${m.imgUrl}" alt="${esc(m.title)}" onclick="openImgViewer('${m.imgUrl}')">` : ''}
        ${m.notes  ? `<div class="study-notes ql-editor" style="padding: 0;">${m.notes}</div>` : ''}
      </div>
    `;
  }).join('');
}

function toggleStudied(materialId, courseId) {
  state.studyProgress[materialId] = !state.studyProgress[materialId];
  if (!state.studyProgress[materialId]) delete state.studyProgress[materialId];
  localStorage.setItem('sm_progress', JSON.stringify(state.studyProgress));
  loadStudyMode(courseId || document.getElementById('study-course-select').value);
}

function resetProgress() {
  state.studyProgress = {};
  localStorage.setItem('sm_progress', JSON.stringify(state.studyProgress));
  loadStudyMode(document.getElementById('study-course-select').value);
  toast('Progress direset!', 'Semua materi ditandai belum dipelajari', 'info');
}

function openStudyMode() {
  navigate('study');
  setTimeout(async () => {
    const sel = document.getElementById('study-course-select');
    if (sel && state.currentCourseId) {
      sel.value = state.currentCourseId;
      await loadStudyMode(state.currentCourseId);
    }
  }, 200);
}

// ════════════════════════════════════════════════════════════
// TIMELINE
// ════════════════════════════════════════════════════════════
async function renderTimeline() {
  const container = document.getElementById('timeline-content');
  container.innerHTML = '<div style="display:flex;justify-content:center;padding:60px"><div class="loading-spinner"></div></div>';

  if (state.courses.length === 0) await loadCourses();

  let allMaterials = [];
  for (const c of state.courses) {
    try {
      const mats = await apiFetch(`/courses/${c.id}/materials`);
      mats.forEach(m => allMaterials.push({ ...m, courseName: c.name, courseEmoji: c.emoji, courseColor: c.color }));
    } catch { /* skip */ }
  }

  allMaterials.sort((a,b) => new Date(b.date) - new Date(a.date));

  if (allMaterials.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-illustration">🗓️</div><div class="empty-title">Timeline Kosong</div><div class="empty-desc">Belum ada materi yang diupload.</div></div>`;
    return;
  }

  const grouped = {};
  allMaterials.forEach(m => {
    const dk = new Date(m.date).toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    if (!grouped[dk]) grouped[dk] = [];
    grouped[dk].push(m);
  });

  container.innerHTML = `<div class="timeline">` +
    Object.entries(grouped).map(([date, materials]) => `
      <div class="timeline-group">
        <div class="timeline-row">
          <div class="timeline-dot"></div>
          <div class="timeline-date-label">${date}</div>
        </div>
        <div class="material-grid" style="padding-left:4px">
          ${materials.map(m => `
            <div class="material-card">
              <div class="material-img" onclick="${m.imgUrl ? `openImgViewer('${m.imgUrl}')` : ''}">
                ${m.imgUrl
                  ? `<img src="${m.imgUrl}" alt="${esc(m.title)}" loading="lazy">`
                  : `<div style="font-size:40px">${m.courseEmoji}</div>`
                }
              </div>
              <div class="material-body">
                <div class="material-tags">
                  <span style="font-size:11px;color:var(--text3);font-weight:600">${m.courseEmoji} ${esc(m.courseName)}</span>
                  ${(m.tags||[]).map(t=>`<span class="tag ${t}">${t.toUpperCase()}</span>`).join('')}
                </div>
                <div class="material-title">${esc(m.title)}</div>
                ${m.notes ? `<div class="material-notes ql-editor" style="padding: 0;">${m.notes}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('') + `</div>`;
}

// ════════════════════════════════════════════════════════════
// ADD COURSE → POST ke API → buat {slug}.json
// ════════════════════════════════════════════════════════════
function openAddCourseModal() {
  selectedEmoji = EMOJIS[0];
  selectedColor = COLORS[0];
  document.getElementById('course-name-input').value = '';
  document.getElementById('course-code-input').value = '';
  document.getElementById('json-preview-hint').textContent = '';

  // Build emoji picker
  document.getElementById('emoji-picker').innerHTML = EMOJIS.map(e => `
    <button class="emoji-option ${e === selectedEmoji ? 'selected' : ''}" onclick="selectEmoji('${e}',this)">${e}</button>
  `).join('');

  // Build color picker
  document.getElementById('color-picker').innerHTML = COLORS.map((c,i) => {
    // extract solid-ish color for display
    const match = c.match(/#[a-f0-9]{6}/i);
    const bg = match ? match[0] : '#ff5c35';
    return `<div class="color-option ${i===0?'selected':''}"
                 style="background:${c}"
                 data-color="${c.replace(/"/g,"'")}"
                 onclick="selectColor(this)"></div>`;
  }).join('');

  // Live preview hint
  document.getElementById('course-name-input').addEventListener('input', function() {
    const slug = toSlug(this.value);
    document.getElementById('json-preview-hint').textContent = slug
      ? `📄 File akan dibuat: data/${slug}.json`
      : '';
  });

  openModal('modal-add-course');
}

function selectEmoji(emoji, el) {
  selectedEmoji = emoji;
  document.querySelectorAll('.emoji-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

function selectColor(el) {
  selectedColor = el.dataset.color;
  document.querySelectorAll('.color-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

async function addCourse() {
  const name = document.getElementById('course-name-input').value.trim();
  if (!name) { toast('Nama wajib diisi', 'Masukkan nama mata kuliah', 'error'); return; }

  const btn = document.getElementById('btn-add-course');
  btn.disabled = true; btn.textContent = 'Menyimpan...';

  try {
    const course = await apiFetch('/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        code:  document.getElementById('course-code-input').value.trim(),
        emoji: selectedEmoji,
        color: selectedColor,
      })
    });

    state.courses.push({ ...course, materialCount: 0 });
    closeModal('modal-add-course');
    renderDashboard();
    toast('Mata kuliah ditambahkan!', `📄 data/${course.slug}.json berhasil dibuat`, 'success');
  } catch (e) {
    /* error sudah di-toast di apiFetch */
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Buat Mata Kuliah';
  }
}

// ════════════════════════════════════════════════════════════
// ADD MATERIAL → POST ke API → tersimpan ke {slug}.json
// ════════════════════════════════════════════════════════════
function openAddMaterialModal(courseId) {
  state.currentCourseId = courseId;
  selectedFile = null;
  selectedTags = [];
  document.getElementById('material-title-input').value = '';
  document.getElementById('material-notes-input').value = '';
  document.getElementById('preview-img').src = '';
  document.getElementById('upload-preview').classList.remove('show');
  document.querySelectorAll('.tag-toggle').forEach(t => { t.className = 'tag-toggle'; });
  
  const course = state.courses.find(c => c.id === courseId);
  if (course) document.getElementById('modal-material-subtitle').textContent = `Upload materi ke ${course.name}`;
  
  // KODE PERBAIKAN: Kembalikan fungsi tombol ke mode Tambah/Upload
  const btn = document.getElementById('btn-add-material');
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload Materi';
  btn.onclick = addMaterial; 

  openModal('modal-add-material');
}

function openEditMaterial(materiId) {
  const materi = state.materials.find(m => m.id === materiId);
  if (!materi) return;

  closeModal('modal-detail-materi'); 
  
  // Isi kembali form dengan data lama
  document.getElementById('material-title-input').value = materi.title;
  quill.root.innerHTML = materi.notes || ''; // Masukkan catatan ke Quill editor
  
  // Tampilkan gambar jika ada
  if (materi.imgUrl) {
    document.getElementById('preview-img').src = materi.imgUrl;
    document.getElementById('upload-preview').classList.add('show');
  }

  openModal('modal-add-material');
  
  // Ubah tombol "Upload" menjadi "Simpan Perubahan"
  const btn = document.getElementById('btn-add-material');
  btn.textContent = 'Simpan Perubahan';
  btn.onclick = () => updateMaterial(materiId); // Kamu butuh fungsi updateMaterial nanti
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { toast('File terlalu besar', 'Maksimal 10MB', 'error'); return; }
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('upload-preview').classList.add('show');
  };
  reader.readAsDataURL(file);
}

function removePreview() {
  selectedFile = null;
  document.getElementById('preview-img').src = '';
  document.getElementById('upload-preview').classList.remove('show');
  document.getElementById('file-input').value = '';
}

function toggleTag(el) {
  const tag = el.dataset.tag;
  if (selectedTags.includes(tag)) {
    selectedTags = selectedTags.filter(t => t !== tag);
    el.className = 'tag-toggle';
  } else {
    selectedTags.push(tag);
    el.className = `tag-toggle active-${tag}`;
  }
}

async function addMaterial() {
  const title = document.getElementById('material-title-input').value.trim();
  if (!title) { toast('Judul wajib diisi', 'Masukkan judul materi', 'error'); return; }

  const btn = document.getElementById('btn-add-material');
  btn.disabled = true; btn.textContent = 'Mengupload...';

  try {
    // KODE BARU: Mengambil teks beserta format HTML dari Quill Editor
    const notesHtml = quill.root.innerHTML; 

    const formData = new FormData();
    formData.append('title', title);
    // Ganti inputan lama dengan nilai HTML dari Quill
    formData.append('notes', notesHtml); 
    formData.append('tags',  JSON.stringify(selectedTags));
    if (selectedFile) formData.append('image', selectedFile);

    const material = await apiFetch(`/courses/${state.currentCourseId}/materials`, {
      method: 'POST',
      body:   formData,   // jangan set Content-Type, biarkan browser set boundary
    });

    state.materials.push(material);

    // Update materialCount di local state
    const idx = state.courses.findIndex(c => c.id === state.currentCourseId);
    if (idx !== -1) {
      state.courses[idx].materialCount = (state.courses[idx].materialCount || 0) + 1;
      state.courses[idx].updatedAt = new Date().toISOString();
    }

    closeModal('modal-add-material');
    renderMaterialGrid(state.courses.find(c => c.id === state.currentCourseId));
    document.getElementById('detail-count').textContent = `${state.materials.length} materi`;
    
    // KODE BARU: Reset isi Quill setelah data berhasil disimpan
    quill.setContents([]); 

    toast('Materi berhasil diupload!', `"${title}" tersimpan ke JSON`, 'success');
  } catch (e) {
    /* handled */
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload Materi';
  }
}

// ════════════════════════════════════════════════════════════
// DELETE COURSE → DELETE ke API → hapus {slug}.json
// ════════════════════════════════════════════════════════════
function openDeleteModal(courseId) {
  deleteCourseId = courseId;
  const course = state.courses.find(c => c.id === courseId);
  if (!course) return;
  document.getElementById('delete-course-emoji').textContent = course.emoji;
  document.getElementById('delete-course-name').textContent  = course.name;
  document.getElementById('delete-course-file').textContent  = `data/${course.slug}.json akan dihapus`;
  openModal('modal-delete');
}

async function confirmDeleteCourse() {
  if (!deleteCourseId) return;
  try {
    await apiFetch(`/courses/${deleteCourseId}`, { method: 'DELETE' });
    const course = state.courses.find(c => c.id === deleteCourseId);
    state.courses = state.courses.filter(c => c.id !== deleteCourseId);
    closeModal('modal-delete');
    if (state.currentPage === 'detail') navigate('dashboard');
    else renderDashboard();
    toast('Mata kuliah dihapus', `${course?.slug}.json dihapus`, 'info');
  } catch { /* handled */ }
}

// ════════════════════════════════════════════════════════════
// DELETE MATERIAL
// ════════════════════════════════════════════════════════════
async function deleteMaterial(courseId, materialId) {
  try {
    await apiFetch(`/courses/${courseId}/materials/${materialId}`, { method: 'DELETE' });
    state.materials = state.materials.filter(m => m.id !== materialId);
    const idx = state.courses.findIndex(c => c.id === courseId);
    if (idx !== -1 && state.courses[idx].materialCount > 0) state.courses[idx].materialCount--;
    renderMaterialGrid(state.courses.find(c => c.id === courseId));
    document.getElementById('detail-count').textContent = `${state.materials.length} materi`;
    toast('Materi dihapus', '', 'info');
  } catch { /* handled */ }
}

// ════════════════════════════════════════════════════════════
// FILTER / SEARCH / SORT
// ════════════════════════════════════════════════════════════
function setFilter(filter, el) {
  state.currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  const course = state.courses.find(c => c.id === state.currentCourseId);
  if (course) renderMaterialGrid(course);
}

function filterMaterials() {
  const course = state.courses.find(c => c.id === state.currentCourseId);
  if (course) renderMaterialGrid(course);
}

function sortMaterials(val) {
  state.currentSort = val;
  const course = state.courses.find(c => c.id === state.currentCourseId);
  if (course) renderMaterialGrid(course);
}

function showDetail(materiId) {
  const materi = state.materials.find(m => m.id === materiId);
  if (!materi) return;

  // Isi konten ke Modal Detail di index.html
  document.getElementById('detail-materi-title').textContent = materi.title;
  document.getElementById('detail-materi-date').textContent = `Diunggah pada: ${formatDate(new Date(materi.date))}`;
  
  // Masukkan isi catatan (format HTML dari Quill)
  document.getElementById('detail-materi-content').innerHTML = materi.notes || '<p style="color:var(--text3)">Tidak ada catatan.</p>';

  // Atur tombol edit agar tahu ID mana yang akan diubah
  document.getElementById('btn-edit-materi').onclick = () => openEditMaterial(materiId);

  openModal('modal-detail-materi');
}

// ════════════════════════════════════════════════════════════
// MODAL HELPERS
// ════════════════════════════════════════════════════════════
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
    closeImgViewer();
  }
});

// ════════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════════
function toast(msg, sub, type = 'success') {
  const icons = { success:'✅', error:'❌', info:'ℹ️' };
  const tc = document.getElementById('toast-container');
  const t  = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <div>
      <div class="toast-msg">${esc(msg)}</div>
      ${sub ? `<div class="toast-sub">${esc(sub)}</div>` : ''}
    </div>
  `;
  tc.appendChild(t);
  setTimeout(() => {
    t.classList.add('removing');
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ════════════════════════════════════════════════════════════
// IMAGE VIEWER
// ════════════════════════════════════════════════════════════
function openImgViewer(src) {
  if (!src) return;
  document.getElementById('img-viewer-src').src = src;
  document.getElementById('img-viewer').classList.add('open');
}
function closeImgViewer() {
  document.getElementById('img-viewer').classList.remove('open');
}

// ════════════════════════════════════════════════════════════
// DARK MODE
// ════════════════════════════════════════════════════════════
function toggleDarkMode() {
  state.darkMode = !state.darkMode;
  localStorage.setItem('sm_dark', JSON.stringify(state.darkMode));
  applyDarkMode();
}
function applyDarkMode() {
  document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light');
  const icon  = document.getElementById('dark-icon');
  const label = document.getElementById('dark-label');
  if (state.darkMode) {
    icon.innerHTML = `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;
    label.textContent = 'Light Mode';
  } else {
    icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
    label.textContent = 'Dark Mode';
  }
}

// ════════════════════════════════════════════════════════════
// SIDEBAR MOBILE
// ════════════════════════════════════════════════════════════
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// Tambahkan konfigurasi ukuran font di app.js
const quill = new Quill('#editor', {
  theme: 'snow',
  placeholder: 'Tulis ringkasan, poin penting, atau catatan belajarmu...',
  modules: {
    toolbar: [
      // Menambahkan dropdown ukuran font
      [{ 'size': ['small', false, 'large', 'huge'] }], 
      
      ['bold', 'italic', 'underline'], // Fitur tebal, miring, garis bawah
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean'] 
    ]
  }
});

// ════════════════════════════════════════════════════════════
// DRAG & DROP UPLOAD
// ════════════════════════════════════════════════════════════
const dz = document.getElementById('upload-zone');
['dragover','dragenter'].forEach(ev => {
  dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('dragover'); });
});
['dragleave','drop'].forEach(ev => {
  dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('dragover'); });
});
dz.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) {
    toast('Hanya gambar', 'Gunakan file PNG/JPG/WEBP', 'error'); return;
  }
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById('preview-img').src = ev.target.result;
    document.getElementById('upload-preview').classList.add('show');
    toast('Gambar siap diupload', file.name, 'success');
  };
  reader.readAsDataURL(file);
});

// ════════════════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════════════════
function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function truncate(str, n) {
  return str.length > n ? str.slice(0,n) + '…' : str;
}
function formatDate(d) {
  const date = new Date(d);
  if (isNaN(date)) return '-';
  return date.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
}
function toSlug(name) {
  return name.toLowerCase()
    .replace(/\s+/g,'_')
    .replace(/[^a-z0-9_]/g,'')
    .replace(/_+/g,'_')
    .slice(0,40) || '';
}
function setLoading(elId, show) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (show) el.innerHTML = '<div class="loading-box"><div class="loading-spinner"></div></div>';
}

// ════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  applyDarkMode();
  await navigate('dashboard');
});

function showDetail(materiId) {
  const materi = state.materials.find(m => m.id === materiId);
  if (!materi) return;

  // Isi konten ke Modal Detail yang ada di index.html
  document.getElementById('detail-materi-title').textContent = materi.title;
  document.getElementById('detail-materi-date').textContent = `Diunggah pada: ${formatDate(new Date(materi.date))}`;
  
  // Render catatan sebagai HTML agar format Bold/Italic dari Quill muncul
  document.getElementById('detail-materi-content').innerHTML = materi.notes || '<p style="color:var(--text3)">Tidak ada catatan.</p>';

  // Atur tombol edit agar tahu ID materi mana yang akan diubah
  document.getElementById('btn-edit-materi').onclick = () => openEditMaterial(materiId);

  openModal('modal-detail-materi');
}

function openEditMaterial(materiId) {
  const materi = state.materials.find(m => m.id === materiId);
  if (!materi) return;

  closeModal('modal-detail-materi'); 
  
  // Masukkan data lama ke dalam form input materi
  document.getElementById('material-title-input').value = materi.title;
  quill.root.innerHTML = materi.notes || ''; // Masukkan catatan ke Quill editor
  
  // Tampilkan preview gambar jika ada
  if (materi.imgUrl) {
    document.getElementById('preview-img').src = materi.imgUrl;
    document.getElementById('upload-preview').classList.add('show');
  }

  openModal('modal-add-material');
  
  // Ubah fungsi tombol "Upload" menjadi "Simpan Perubahan"
  const btn = document.getElementById('btn-add-material');
  btn.textContent = 'Simpan Perubahan';
  
  // Pastikan onclick diubah khusus untuk menjalankan fungsi update
  btn.onclick = () => updateMaterial(materiId); // Panggil fungsi update
}

async function updateMaterial(materiId) {
    const title = document.getElementById('material-title-input').value.trim();
    const notes = quill.root.innerHTML;

    if (!title) {
        toast('Judul wajib diisi', 'Masukkan judul materi', 'error');
        return;
    }

    if (!state.currentCourseId) {
        toast('Gagal: ID Mata Kuliah tidak ditemukan', '', 'error');
        return;
    }

    const btn = document.getElementById('btn-add-material');
    btn.disabled = true; btn.textContent = 'Menyimpan...';

    try {
        const result = await apiFetch(`/courses/${state.currentCourseId}/materials`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: materiId, title: title, notes: notes })
        });

        if (result.success) {
            toast('Perubahan disimpan!', '', 'success');
            closeModal('modal-add-material');
            
            // RESET & RE-RENDER: Ambil data terbaru dari server dan gambar ulang
            await loadCourses(); 
            await loadDetail(state.currentCourseId); 
            
            quill.setContents([]); // Bersihkan text editor
        }
    } catch (e) {
        console.error("Detail Error:", e);
    } finally {
        btn.disabled = false;
    }
}
