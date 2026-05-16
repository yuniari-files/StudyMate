// ══════════════════════════════════════
// STATE & STORAGE
// ══════════════════════════════════════
const STORAGE_KEY = 'studymate_data';
let state = {
  courses: [],
  currentCourseId: null,
  currentPage: 'dashboard',
  currentFilter: 'all',
  currentSort: 'newest',
  studyProgress: {},
  darkMode: false
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) state = { ...state, ...JSON.parse(saved) };
  applyDarkMode();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ══════════════════════════════════════
// EMOJIS & COLORS
// ══════════════════════════════════════
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
let selectedColor = COLORS[0];
let selectedFile = null;
let selectedTags = [];
let deleteCourseId = null;

// ══════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════
function navigate(page, courseId = null) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  document.getElementById('page-' + page).classList.add('active');
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  state.currentPage = page;

  const titles = {
    dashboard: 'Selamat <span>Datang</span> 👋',
    detail: 'Detail <span>Materi</span>',
    study: 'Mode <span>Belajar</span> 📖',
    timeline: 'Timeline <span>Belajar</span> 📅'
  };
  document.getElementById('topbar-title').innerHTML = titles[page] || page;

  if (page === 'dashboard') {
    renderDashboard();
    document.getElementById('fab').classList.remove('hidden');
    document.getElementById('fab').onclick = () => navigate('dashboard');
    document.getElementById('fab').innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    document.getElementById('fab').onclick = openAddCourseModal;
  }

  if (page === 'detail' && courseId) {
    state.currentCourseId = courseId;
    renderDetail(courseId);
    document.getElementById('fab').classList.remove('hidden');
    document.getElementById('fab').innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    document.getElementById('fab').onclick = () => openAddMaterialModal(courseId);
  }

  if (page === 'study') {
    renderStudyPage();
    document.getElementById('fab').classList.add('hidden');
  }

  if (page === 'timeline') {
    renderTimeline();
    document.getElementById('fab').classList.add('hidden');
  }

  closeSidebar();
}

// ══════════════════════════════════════
// RENDER DASHBOARD
// ══════════════════════════════════════
function renderDashboard() {
  const grid = document.getElementById('courses-grid');
  const today = new Date().toDateString();

  let totalMaterials = 0, todayCount = 0, importantCount = 0;
  state.courses.forEach(c => {
    totalMaterials += c.materials.length;
    c.materials.forEach(m => {
      if (new Date(m.date).toDateString() === today) todayCount++;
      if (m.tags && m.tags.includes('penting')) importantCount++;
    });
  });

  document.getElementById('stat-courses').textContent = state.courses.length;
  document.getElementById('stat-materials').textContent = totalMaterials;
  document.getElementById('stat-today').textContent = todayCount;
  document.getElementById('stat-penting').textContent = importantCount;
  document.getElementById('badge-courses').textContent = state.courses.length;

  // Sidebar courses
  const sidebarList = document.getElementById('sidebar-courses-list');
  sidebarList.innerHTML = state.courses.map(c => `
    <button class="nav-item ${state.currentPage === 'detail' && state.currentCourseId === c.id ? 'active' : ''}" 
            onclick="navigate('detail','${c.id}')">
      <span>${c.emoji}</span> ${truncate(c.name, 18)}
      <span class="badge">${c.materials.length}</span>
    </button>
  `).join('');

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
          <div class="empty-desc">Tambahkan mata kuliah pertamamu dan mulai simpan semua materi kuliah di satu tempat.</div>
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = state.courses.map(c => {
    const lastUpdate = c.materials.length > 0
      ? formatDate(Math.max(...c.materials.map(m => new Date(m.date))))
      : 'Belum ada materi';
    const progress = Math.round((c.materials.filter(m => state.studyProgress[m.id]).length / Math.max(c.materials.length, 1)) * 100);
    return `
      <div class="course-card" onclick="navigate('detail','${c.id}')">
        <div class="course-card-header" style="background:${c.color}">
          <span class="course-emoji">${c.emoji}</span>
          <div class="course-name">${esc(c.name)}</div>
          <div class="course-code">${esc(c.code || '')}</div>
        </div>
        <div class="course-card-body">
          <div class="course-meta">
            <div class="course-meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
              ${c.materials.length} materi
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
            ${getCourseTags(c).map(t => `<span class="tag ${t}">${t.toUpperCase()}</span>`).join('')}
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

function getCourseTags(course) {
  const tags = new Set();
  course.materials.forEach(m => (m.tags || []).forEach(t => tags.add(t)));
  return [...tags].slice(0, 2);
}

// ══════════════════════════════════════
// RENDER DETAIL
// ══════════════════════════════════════
function renderDetail(courseId) {
  const course = state.courses.find(c => c.id === courseId);
  if (!course) return navigate('dashboard');

  document.getElementById('detail-hero').style.background = course.color;
  document.getElementById('detail-emoji').textContent = course.emoji;
  document.getElementById('detail-name').textContent = course.name;
  document.getElementById('detail-count').textContent = `${course.materials.length} materi`;
  document.getElementById('detail-updated').textContent = course.materials.length > 0
    ? 'Update: ' + formatDate(Math.max(...course.materials.map(m => new Date(m.date))))
    : 'Belum ada materi';
  document.getElementById('modal-material-subtitle').textContent = `Tambah materi ke ${course.name}`;

  renderMaterialGrid(course);
}

function renderMaterialGrid(course) {
  const grid = document.getElementById('material-grid');
  const search = document.getElementById('detail-search').value.toLowerCase();

  let materials = [...course.materials];

  if (state.currentFilter !== 'all') {
    materials = materials.filter(m => m.tags && m.tags.includes(state.currentFilter));
  }

  if (search) {
    materials = materials.filter(m =>
      m.title.toLowerCase().includes(search) ||
      (m.notes || '').toLowerCase().includes(search)
    );
  }

  if (state.currentSort === 'newest') {
    materials.sort((a, b) => new Date(b.date) - new Date(a.date));
  } else {
    materials.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  if (materials.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1">
        <div class="empty-state">
          <div class="empty-illustration">${search || state.currentFilter !== 'all' ? '🔍' : '📂'}</div>
          <div class="empty-title">${search || state.currentFilter !== 'all' ? 'Tidak Ada Hasil' : 'Belum Ada Materi'}</div>
          <div class="empty-desc">${search || state.currentFilter !== 'all' ? 'Coba kata kunci atau filter lain.' : 'Upload foto catatan atau materi kuliah untuk mulai belajar.'}</div>
          ${!search && state.currentFilter === 'all' ? `<button class="btn btn-primary" onclick="openAddMaterialModal('${course.id}')">Upload Materi Pertama</button>` : ''}
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = materials.map(m => `
    <div class="material-card">
      <div class="material-img" onclick="openImgViewer('${m.img || ''}')">
        ${m.img
          ? `<img src="${m.img}" alt="${esc(m.title)}" loading="lazy">`
          : `<div style="font-size:48px;display:flex;align-items:center;justify-content:center;height:100%;background:var(--bg2)">${course.emoji}</div>`
        }
      </div>
      <div class="material-body">
        <div class="material-tags">${(m.tags||[]).map(t=>`<span class="tag ${t}">${t.toUpperCase()}</span>`).join('')}</div>
        <div class="material-title">${esc(m.title)}</div>
        ${m.notes ? `<div class="material-notes">${esc(m.notes)}</div>` : ''}
        <div class="material-footer">
          <div class="material-date">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${formatDate(new Date(m.date))}
          </div>
          <div class="material-actions">
            <button class="material-action-btn" onclick="deleteMaterial('${course.id}','${m.id}')" title="Hapus">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// ══════════════════════════════════════
// STUDY MODE
// ══════════════════════════════════════
function renderStudyPage() {
  const select = document.getElementById('study-course-select');
  select.innerHTML = '<option value="all">Semua Mata Kuliah</option>' +
    state.courses.map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('');
  loadStudyMode('all');
}

function loadStudyMode(courseId) {
  let allMaterials = [];
  state.courses.forEach(c => {
    if (courseId === 'all' || c.id === courseId) {
      c.materials.forEach(m => allMaterials.push({ ...m, courseName: c.name, courseEmoji: c.emoji, courseColor: c.color }));
    }
  });
  allMaterials.sort((a, b) => new Date(a.date) - new Date(b.date));

  const total = allMaterials.length;
  const studied = allMaterials.filter(m => state.studyProgress[m.id]).length;
  const pct = total === 0 ? 0 : Math.round((studied / total) * 100);

  document.getElementById('study-progress-num').textContent = `${studied}/${total}`;
  document.getElementById('study-progress-pct').textContent = pct + '%';
  setTimeout(() => document.getElementById('study-progress-fill').style.width = pct + '%', 50);

  const content = document.getElementById('study-content');
  if (allMaterials.length === 0) {
    content.innerHTML = `<div class="empty-state"><div class="empty-illustration">📭</div><div class="empty-title">Belum Ada Materi</div><div class="empty-desc">Tambahkan materi ke mata kuliah terlebih dahulu.</div></div>`;
    return;
  }

  content.innerHTML = allMaterials.map((m, i) => {
    const done = state.studyProgress[m.id];
    return `
      <div class="study-card" id="study-${m.id}" style="${done ? 'opacity:0.65' : ''}">
        <div class="study-card-header">
          <div class="study-num" style="background:${done ? '#22c55e' : 'var(--accent)'}">
            ${done ? '✓' : i + 1}
          </div>
          <div>
            <div class="study-title">${esc(m.title)}</div>
            <div class="study-meta">${m.courseEmoji} ${esc(m.courseName)} · ${formatDate(new Date(m.date))}</div>
          </div>
          <div style="margin-left:auto;display:flex;gap:8px;align-items:center">
            ${(m.tags||[]).map(t=>`<span class="tag ${t}">${t.toUpperCase()}</span>`).join('')}
            <button class="btn ${done ? 'btn-ghost' : 'btn-primary'}" style="font-size:12px;padding:7px 14px" onclick="toggleStudied('${m.id}','${courseId}')">
              ${done ? '↩ Belum' : '✓ Dipelajari'}
            </button>
          </div>
        </div>
        ${m.img ? `<img class="study-img" src="${m.img}" alt="${esc(m.title)}" onclick="openImgViewer('${m.img}')" style="cursor:zoom-in">` : ''}
        ${m.notes ? `<div class="study-notes">${esc(m.notes).replace(/\n/g,'<br>')}</div>` : ''}
      </div>
    `;
  }).join('');
}

function toggleStudied(materialId, courseId) {
  state.studyProgress[materialId] = !state.studyProgress[materialId];
  saveState();
  loadStudyMode(courseId || document.getElementById('study-course-select').value);
}

function resetProgress() {
  state.studyProgress = {};
  saveState();
  loadStudyMode(document.getElementById('study-course-select').value);
  toast('Progress direset!', 'Semua materi ditandai belum dipelajari', 'info');
}

function openStudyMode() {
  navigate('study');
  // pre-select current course
  setTimeout(() => {
    const sel = document.getElementById('study-course-select');
    if (sel && state.currentCourseId) {
      sel.value = state.currentCourseId;
      loadStudyMode(state.currentCourseId);
    }
  }, 100);
}

// ══════════════════════════════════════
// TIMELINE
// ══════════════════════════════════════
function renderTimeline() {
  let allMaterials = [];
  state.courses.forEach(c => {
    c.materials.forEach(m => allMaterials.push({ ...m, courseName: c.name, courseEmoji: c.emoji, courseColor: c.color }));
  });
  allMaterials.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (allMaterials.length === 0) {
    document.getElementById('timeline-content').innerHTML = `<div class="empty-state"><div class="empty-illustration">🗓️</div><div class="empty-title">Timeline Kosong</div><div class="empty-desc">Belum ada materi yang diupload. Mulai tambahkan materi!</div></div>`;
    return;
  }

  const grouped = {};
  allMaterials.forEach(m => {
    const dk = new Date(m.date).toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    if (!grouped[dk]) grouped[dk] = [];
    grouped[dk].push(m);
  });

  document.getElementById('timeline-content').innerHTML = `<div class="timeline">` +
    Object.entries(grouped).map(([date, materials]) => `
      <div class="timeline-group">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div class="timeline-date"></div>
          <div class="timeline-date-label">${date}</div>
        </div>
        <div class="material-grid" style="padding-left:4px">
          ${materials.map(m => `
            <div class="material-card">
              <div class="material-img">
                ${m.img
                  ? `<img src="${m.img}" alt="${esc(m.title)}" loading="lazy" onclick="openImgViewer('${m.img}')" style="cursor:zoom-in">`
                  : `<div style="font-size:40px;display:flex;align-items:center;justify-content:center;height:100%;background:var(--bg2)">${m.courseEmoji}</div>`
                }
              </div>
              <div class="material-body">
                <div class="material-tags">
                  <span style="font-size:11px;color:var(--text3);font-weight:600">${m.courseEmoji} ${esc(m.courseName)}</span>
                  ${(m.tags||[]).map(t=>`<span class="tag ${t}">${t.toUpperCase()}</span>`).join('')}
                </div>
                <div class="material-title">${esc(m.title)}</div>
                ${m.notes ? `<div class="material-notes">${esc(m.notes)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('') + `</div>`;
}

// ══════════════════════════════════════
// ADD COURSE
// ══════════════════════════════════════
function openAddCourseModal() {
  selectedEmoji = EMOJIS[0];
  selectedColor = COLORS[0];
  document.getElementById('course-name-input').value = '';
  document.getElementById('course-code-input').value = '';

  const ep = document.getElementById('emoji-picker');
  ep.innerHTML = EMOJIS.map(e => `
    <button class="emoji-option ${e === selectedEmoji ? 'selected' : ''}" onclick="selectEmoji('${e}', this)">${e}</button>
  `).join('');

  const cp = document.getElementById('color-picker');
  cp.innerHTML = COLORS.map((c, i) => `
    <div class="color-option ${i === 0 ? 'selected' : ''}" 
         style="background:${c.split(',')[1] || c};" 
         onclick="selectColor('${c.replace(/'/g,'"')}', this)"></div>
  `).join('');

  openModal('modal-add-course');
}

function selectEmoji(emoji, el) {
  selectedEmoji = emoji;
  document.querySelectorAll('.emoji-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

function selectColor(color, el) {
  selectedColor = color;
  document.querySelectorAll('.color-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

function addCourse() {
  const name = document.getElementById('course-name-input').value.trim();
  if (!name) { toast('Nama diperlukan', 'Masukkan nama mata kuliah', 'error'); return; }

  const course = {
    id: 'c_' + Date.now(),
    name,
    code: document.getElementById('course-code-input').value.trim(),
    emoji: selectedEmoji,
    color: selectedColor,
    materials: [],
    createdAt: new Date().toISOString()
  };

  state.courses.push(course);
  saveState();
  closeModal('modal-add-course');
  renderDashboard();
  toast('Mata kuliah ditambahkan!', `${selectedEmoji} ${name} siap diisi materi`, 'success');
}

// ══════════════════════════════════════
// ADD MATERIAL
// ══════════════════════════════════════
function openAddMaterialModal(courseId) {
  state.currentCourseId = courseId;
  selectedFile = null;
  selectedTags = [];
  document.getElementById('material-title-input').value = '';
  document.getElementById('material-notes-input').value = '';
  document.getElementById('preview-img').src = '';
  document.getElementById('upload-preview').classList.remove('show');
  document.querySelectorAll('.tag-toggle').forEach(t => {
    t.className = 'tag-toggle';
  });
  const course = state.courses.find(c => c.id === courseId);
  if (course) document.getElementById('modal-material-subtitle').textContent = `Upload materi ke ${course.name}`;
  openModal('modal-add-material');
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { toast('File terlalu besar', 'Maksimal 10MB', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    selectedFile = e.target.result;
    document.getElementById('preview-img').src = selectedFile;
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

function addMaterial() {
  const title = document.getElementById('material-title-input').value.trim();
  if (!title) { toast('Judul diperlukan', 'Masukkan judul materi', 'error'); return; }

  const course = state.courses.find(c => c.id === state.currentCourseId);
  if (!course) return;

  const material = {
    id: 'm_' + Date.now(),
    title,
    notes: document.getElementById('material-notes-input').value.trim(),
    date: new Date().toISOString(),
    tags: [...selectedTags],
    img: selectedFile || null
  };

  course.materials.push(material);
  saveState();
  closeModal('modal-add-material');
  renderDetail(state.currentCourseId);
  toast('Materi berhasil diupload!', `"${title}" tersimpan`, 'success');
}

// ══════════════════════════════════════
// DELETE
// ══════════════════════════════════════
function openDeleteModal(courseId) {
  deleteCourseId = courseId;
  const course = state.courses.find(c => c.id === courseId);
  document.getElementById('delete-course-name').textContent = course ? course.name : '';
  openModal('modal-delete');
}

function confirmDeleteCourse() {
  state.courses = state.courses.filter(c => c.id !== deleteCourseId);
  saveState();
  closeModal('modal-delete');
  if (state.currentPage === 'detail') navigate('dashboard');
  else renderDashboard();
  toast('Mata kuliah dihapus', '', 'info');
}

function deleteMaterial(courseId, materialId) {
  const course = state.courses.find(c => c.id === courseId);
  if (!course) return;
  course.materials = course.materials.filter(m => m.id !== materialId);
  saveState();
  renderDetail(courseId);
  toast('Materi dihapus', '', 'info');
}

// ══════════════════════════════════════
// FILTER / SEARCH / SORT
// ══════════════════════════════════════
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

// ══════════════════════════════════════
// UTILS
// ══════════════════════════════════════
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function truncate(str, n) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}
function formatDate(d) {
  const date = new Date(d);
  if (isNaN(date)) return '-';
  return date.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
}

function sortMaterials(val) {
  state.currentSort = val;
  const course = state.courses.find(c => c.id === state.currentCourseId);
  if (course) renderMaterialGrid(course);
}

function fabAction() { openAddCourseModal(); }

// ══════════════════════════════════════
// MODAL HELPERS
// ══════════════════════════════════════
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

// ══════════════════════════════════════
// TOAST
// ══════════════════════════════════════
function toast(msg, sub, type = 'success') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const tc = document.getElementById('toast-container');
  const t = document.createElement('div');
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
  }, 3000);
}

// ══════════════════════════════════════
// IMAGE VIEWER
// ══════════════════════════════════════
function openImgViewer(src) {
  if (!src) return;
  document.getElementById('img-viewer-src').src = src;
  document.getElementById('img-viewer').classList.add('open');
}
function closeImgViewer() {
  document.getElementById('img-viewer').classList.remove('open');
}

// ══════════════════════════════════════
// DARK MODE
// ══════════════════════════════════════
function toggleDarkMode() {
  state.darkMode = !state.darkMode;
  saveState();
  applyDarkMode();
}
function applyDarkMode() {
  document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light');
  const icon = document.getElementById('dark-icon');
  const label = document.getElementById('dark-label');
  if (state.darkMode) {
    icon.innerHTML = `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;
    label.textContent = 'Light Mode';
  } else {
    icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
    label.textContent = 'Dark Mode';
  }
}

// ══════════════════════════════════════
// SIDEBAR MOBILE
// ══════════════════════════════════════
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ══════════════════════════════════════
// DRAG & DROP
// ══════════════════════════════════════
const dz = document.getElementById('upload-zone');
if (dz) {
  ['dragover','dragenter'].forEach(ev => {
    dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('dragover'); });
  });
  ['dragleave','drop'].forEach(ev => {
    dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('dragover'); });
  });
  dz.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) { toast('Hanya gambar', 'Gunakan file PNG/JPG/WEBP', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      selectedFile = ev.target.result;
      document.getElementById('preview-img').src = selectedFile;
      document.getElementById('upload-preview').classList.add('show');
      toast('Gambar siap', file.name, 'success');
    };
    reader.readAsDataURL(file);
  });
}

// ══════════════════════════════════════
// INIT WITH SAMPLE DATA
// ══════════════════════════════════════
function initSampleData() {
  if (state.courses.length > 0) return;
  state.courses = [
    {
      id: 'c_sample1',
      name: 'Basis Data',
      code: 'CS301',
      emoji: '🗄️',
      color: 'linear-gradient(135deg,#3b82f6,#60a5fa)',
      createdAt: new Date(Date.now() - 7*86400000).toISOString(),
      materials: [
        {
          id: 'm_s1',
          title: 'Normalisasi Database 1NF, 2NF, 3NF',
          notes: 'Normalisasi adalah proses mendesain tabel database agar bebas dari anomali. 1NF: setiap kolom bersifat atomik. 2NF: tidak ada partial dependency. 3NF: tidak ada transitive dependency.',
          date: new Date(Date.now() - 5*86400000).toISOString(),
          tags: ['uts','penting'],
          img: null
        },
        {
          id: 'm_s2',
          title: 'Entity Relationship Diagram (ERD)',
          notes: 'ERD adalah representasi visual dari entitas dan hubungannya. Komponen: Entitas, Atribut, Relasi, Kardinalitas (1:1, 1:N, M:N).',
          date: new Date(Date.now() - 3*86400000).toISOString(),
          tags: ['uts'],
          img: null
        }
      ]
    },
    {
      id: 'c_sample2',
      name: 'Pemrograman Web',
      code: 'CS402',
      emoji: '🌐',
      color: 'linear-gradient(135deg,#a855f7,#c084fc)',
      createdAt: new Date(Date.now() - 14*86400000).toISOString(),
      materials: [
        {
          id: 'm_s3',
          title: 'Dasar HTML & CSS',
          notes: 'HTML (HyperText Markup Language) adalah tulang punggung web. Struktur dasar: DOCTYPE, html, head, body. CSS untuk styling: selector, property, value.',
          date: new Date(Date.now() - 10*86400000).toISOString(),
          tags: ['tugas'],
          img: null
        }
      ]
    }
  ];
  saveState();
}

// ══════════════════════════════════════
// BOOT
// ══════════════════════════════════════
loadState();
initSampleData();
renderDashboard();
