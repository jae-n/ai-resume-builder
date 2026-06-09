/*  AI Resume Builder — app.js*/

const API = window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api/v1'
  : 'https://ai-resume-builder-backend-xi6s.onrender.com/api/v1';

//  App state
let currentTab    = 'vault';
let currentResume = null;   // { id, resume: {...} }
let currentUser   = null;
let savedJDs      = [];

// vault dynamic rows
let vaultJobs     = [];
let vaultProjects = [];
let vaultSkills   = [];
let vaultEdu      = [];

/*  BOOTSTRAP — run on page load*/
(async function init() {
  await checkAuth();
})();

async function checkAuth() {
  try {
    const d = await apiFetch('/auth/me');
    if (d.user) {
      currentUser = d.user;
      showApp();
    } else {
      showAuthScreen();
    }
  } catch {
    showAuthScreen();
  }
}

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('action-bar').classList.add('hidden');
}

async function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('action-bar').classList.remove('hidden');
  document.getElementById('header-user').textContent = currentUser.email;
  checkHealth();
  await loadVault();
  await loadJDList();
  await loadHistory();
  updateActionBar();
  await loadSavedPrompts();
}

/*  AUTH*/
function showAuthTab(tab, el) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('auth-login').classList.toggle('hidden',    tab !== 'login');
  document.getElementById('auth-register').classList.toggle('hidden', tab !== 'register');
}

async function doLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.classList.add('hidden');

  const d = await apiFetch('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password })
  });
  if (d.error) { errEl.textContent = d.error; errEl.classList.remove('hidden'); return; }
  currentUser = d.user;
  showApp();
}

async function doRegister() {
  const full_name = document.getElementById('reg-name').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const password  = document.getElementById('reg-password').value;
  const errEl     = document.getElementById('reg-error');
  errEl.classList.add('hidden');

  const d = await apiFetch('/auth/register', {
    method: 'POST', body: JSON.stringify({ full_name, email, password })
  });
  if (d.error) { errEl.textContent = d.error; errEl.classList.remove('hidden'); return; }
  currentUser = d.user;
  showApp();
}

async function doLogout() {
  await apiFetch('/auth/logout', { method: 'POST' });
  currentUser   = null;
  currentResume = null;
  showAuthScreen();
}

/* NAVIGATION */
function switchTab(name, el) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
  currentTab = name;
  updateActionBar();
}

function updateActionBar() {
  const bar   = document.getElementById('action-bar');
  const label = document.getElementById('action-label');
  const map   = { vault:'💾 Save vault', jd:'💾 Save job description',
                  generate:'✨ Generate resume', edit:'💾 Save edits', preview:'⬇️ Export PDF' };
  if (map[currentTab]) {
    bar.classList.remove('hidden');
    label.textContent = map[currentTab];
  } else {
    bar.classList.add('hidden');
  }
}

function handleAction() {
  const map = { vault: saveVault, jd: saveJD, generate: generateResume,
                edit: saveEdits, preview: exportPDF };
  if (map[currentTab]) map[currentTab]();
}

/* TOAST & HEALTH*/
function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

async function checkHealth() {
  try {
    const d = await apiFetch('/health');
    const el = document.getElementById('api-status');
    el.textContent = d.db === 'connected' ? '🟢' : '🔴 db error';
  } catch { 
    document.getElementById('api-status').textContent = '🔴'; 
  }
}

/* API FETCH HELPER*/
async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (path.endsWith('/pdf') && res.ok) return res.blob();
  return res.json();
}

/*VAULT — load & save*/
async function loadVault() {
  try {
    const d = await apiFetch('/vault');
    const v = d.vault || {};
    const p = v.personal || {};
    ['name','email','phone','location','linkedin','github','website','citizenship']
      .forEach(k => { const el = document.getElementById('v-'+k); if (el) el.value = p[k]||''; });
    document.getElementById('v-summary').value = p.summary || '';

    vaultJobs     = (v.jobs     || []).map(j => ({ ...j, _id: Date.now() + Math.random() }));
    vaultProjects = (v.projects || []).map(p => ({ ...p, _id: Date.now() + Math.random() }));
    vaultSkills   = (v.skills   || []).map(s => ({ ...s, _id: Date.now() + Math.random() }));
    vaultEdu      = (v.education|| []).map(e => ({ ...e, _id: Date.now() + Math.random() }));

    renderJobs(); renderProjects(); renderSkills(); renderEdu();
  } catch(e) { console.warn('Vault load:', e); }
}

function collectVault() {
  return {
    personal: {
      name:        val('v-name'),        email:       val('v-email'),
      phone:       val('v-phone'),       location:    val('v-location'),
      linkedin:    val('v-linkedin'),    github:      val('v-github'),
      website:     val('v-website'),     citizenship: val('v-citizenship'),
      summary:     val('v-summary'),
    },
    jobs:      vaultJobs.map(collectJob),
    projects:  vaultProjects.map(collectProject),
    skills:    vaultSkills.map(collectSkill),
    education: vaultEdu.map(collectEdu),
  };
}

async function saveVault() {
  const vault = collectVault();
  const d = await apiFetch('/vault', { method:'PUT', body: JSON.stringify({ vault }) });
  d.message ? toast('✓ Vault saved') : toast(d.error||'Save failed', true);
}

/*  Job cards  */
function addJobCard(data = {}) {
  // save current values before re-rendering
  vaultJobs = vaultJobs.map(collectJob);
  vaultJobs.push({ _id: uid(), title:'', company:'', location:'', start:'', end:'', bullets:'', ...data });
  renderJobs();
}
function removeJob(id) {
  vaultJobs = vaultJobs.map(collectJob).filter(j => j._id !== id);
  renderJobs();
}
function collectJob(j) {
  return { title: val(`j-title-${j._id}`)||j.title, company: val(`j-company-${j._id}`)||j.company,
           location: val(`j-loc-${j._id}`)||j.location, start: val(`j-start-${j._id}`)||j.start,
           end: val(`j-end-${j._id}`)||j.end, bullets: val(`j-bullets-${j._id}`)||j.bullets };
}
function renderJobs() {
  document.getElementById('jobs-container').innerHTML = vaultJobs.map(j => `
    <div class="list-card">
      <div class="list-card-header">
        <span>${esc(j.company||j.title||'New job')}</span>
        <button class="btn btn-sm btn-danger" onclick="removeJob(${j._id})">✕</button>
      </div>
      <div class="list-card-body">
        <div class="row2">
          <div class="field"><label>Job title</label><input id="j-title-${j._id}" type="text" value="${esc(j.title)}" placeholder="Software Engineer" /></div>
          <div class="field"><label>Company</label><input id="j-company-${j._id}" type="text" value="${esc(j.company)}" placeholder="Acme Corp" /></div>
        </div>
        <div class="row2">
          <div class="field"><label>Start</label><input id="j-start-${j._id}" type="text" value="${esc(j.start)}" placeholder="Jan 2021" /></div>
          <div class="field"><label>End</label><input id="j-end-${j._id}" type="text" value="${esc(j.end)}" placeholder="Present" /></div>
        </div>
        <div class="field"><label>Location</label><input id="j-loc-${j._id}" type="text" value="${esc(j.location)}" placeholder="Dallas, TX" /></div>
        <div class="field"><label>Responsibilities &amp; achievements (one per line)</label>
          <textarea id="j-bullets-${j._id}" rows="4" placeholder="Led team of 5 engineers&#10;Reduced API latency by 40%">${esc(j.bullets)}</textarea>
        </div>
      </div>
    </div>`).join('');
}

/* Project cards*/
function addProjectCard(data = {}) {
  vaultProjects = vaultProjects.map(collectProject);
  vaultProjects.push({ _id: uid(), name:'', stack:'', description:'', ...data });
  renderProjects();
}
function removeProject(id) {
  console.log('removing id:', id, typeof id);
  console.log('current ids:', vaultProjects.map(p => ({_id: p._id, type: typeof p._id})));
  vaultProjects = vaultProjects.map(collectProject).filter(p => String(p._id) !== String(id));
  renderProjects();
}
function collectProject(p) {
  return { 
    _id: p._id,  // ← THIS IS MISSING
    name:        val(`p-name-${p._id}`)  ?? p.name        ?? '',
    stack:       val(`p-stack-${p._id}`) ?? p.stack       ?? '',
    description: val(`p-desc-${p._id}`)  ?? p.description ?? ''
  };
}
function renderProjects() {
  document.getElementById('projects-container').innerHTML = vaultProjects.map(p => `
    <div class="list-card">
      <div class="list-card-header">
        <span>${esc(p.name||'New project')}</span>
        <button class="btn btn-sm btn-danger" onclick="removeProject('${p._id}')">✕</button>
      </div>
      <div class="list-card-body">
        <div class="field"><label>Project name</label><input id="p-name-${p._id}" type="text" value="${esc(p.name)}" placeholder="My App" /></div>
        <div class="field"><label>Tech stack</label><input id="p-stack-${p._id}" type="text" value="${esc(p.stack)}" placeholder="Python, React, Docker" /></div>
        <div class="field"><label>Description &amp; impact (one bullet per line)</label>
          <textarea id="p-desc-${p._id}" rows="3" placeholder="Built real-time tracking pipeline&#10;Achieved sub-30ms latency">${esc(p.description)}</textarea>
        </div>
      </div>
    </div>`).join('');
}

/*  Skill cards  */
function addSkillCard(data = {}) {
  vaultSkills = vaultSkills.map(collectSkill);  // ← must be here
  vaultSkills.push({ _id: uid(), category:'', skills:'', ...data });
  renderSkills();
}
function removeSkill(id) {
  vaultSkills = vaultSkills.map(collectSkill).filter(s => s._id !== id);
  renderSkills();
}

function collectSkill(s) {
  return { 
    _id: s._id,  // ← keep the _id
    category: val(`s-cat-${s._id}`) || s.category, 
    skills: val(`s-skills-${s._id}`) || s.skills 
  };
}
function renderSkills() {
  document.getElementById('skills-container').innerHTML = vaultSkills.map(s => `
    <div class="list-card">
      <div class="list-card-header">
        <span>${esc(s.category||'New category')}</span>
        <button class="btn btn-sm btn-danger" onclick="removeSkill(${s._id})">✕</button>
      </div>
      <div class="list-card-body">
        <div class="field"><label>Category</label><input id="s-cat-${s._id}" type="text" value="${esc(s.category)}" placeholder="Languages &amp; Scripting" /></div>
        <div class="field"><label>Skills (comma-separated)</label>
          <textarea id="s-skills-${s._id}" rows="2" placeholder="Python, C++, JavaScript, SQL">${esc(s.skills)}</textarea>
        </div>
      </div>
    </div>`).join('');
}

/*  Education cards */
function addEduCard(data = {}) {
  console.log('before collect:', JSON.stringify(vaultEdu));
  vaultEdu = vaultEdu.map(collectEdu);
  console.log('after collect:', JSON.stringify(vaultEdu));
  vaultEdu.push({ _id: uid(), institution:'', location:'', degree:'', field:'', start:'', end:'', coursework:'', ...data });
  renderEdu();
}
function removeEdu(id) {
  vaultEdu = vaultEdu.map(collectEdu).filter(e => e._id !== id);
  renderEdu();
}
function collectEdu(e) {
  return { 
    _id: e._id,  // ← keep the _id
    institution: val(`e-inst-${e._id}`) || e.institution, 
    location:    val(`e-loc-${e._id}`)  || e.location,
    degree:      val(`e-deg-${e._id}`)  || e.degree, 
    field:       val(`e-field-${e._id}`)|| e.field,
    start:       val(`e-start-${e._id}`)|| e.start, 
    end:         val(`e-end-${e._id}`)  || e.end,
    coursework:  val(`e-course-${e._id}`)|| e.coursework 
  };
}
function renderEdu() {
  document.getElementById('education-container').innerHTML = vaultEdu.map(e => `
    <div class="list-card">
      <div class="list-card-header">
        <span>${esc(e.institution||'New education')}</span>
        <button class="btn btn-sm btn-danger" onclick="removeEdu(${e._id})">✕</button>
      </div>
      <div class="list-card-body">
        <div class="row2">
          <div class="field"><label>Institution</label><input id="e-inst-${e._id}" type="text" value="${esc(e.institution)}" placeholder="UT Dallas" /></div>
          <div class="field"><label>Location</label><input id="e-loc-${e._id}" type="text" value="${esc(e.location)}" placeholder="Richardson, TX" /></div>
        </div>
        <div class="row2">
          <div class="field"><label>Degree</label><input id="e-deg-${e._id}" type="text" value="${esc(e.degree)}" placeholder="Bachelor of Science" /></div>
          <div class="field"><label>Field</label><input id="e-field-${e._id}" type="text" value="${esc(e.field)}" placeholder="Computer Science" /></div>
        </div>
        <div class="row2">
          <div class="field"><label>Start</label><input id="e-start-${e._id}" type="text" value="${esc(e.start)}" placeholder="Aug 2021" /></div>
          <div class="field"><label>End</label><input id="e-end-${e._id}" type="text" value="${esc(e.end)}" placeholder="May 2026" /></div>
        </div>
        <div class="field"><label>Relevant coursework</label>
          <input id="e-course-${e._id}" type="text" value="${esc(e.coursework)}" placeholder="Algorithms, Operating Systems, AI" />
        </div>
      </div>
    </div>`).join('');
}

/* JOB DESCRIPTIONS*/
async function loadJDList() {
  const d = await apiFetch('/jd');
  savedJDs = d.job_descriptions || [];
  renderJDList();
  populateJDSelect();
}

function renderJDList() {
  const container = document.getElementById('jd-list');
  if (!savedJDs.length) {
    container.innerHTML = '<p style="font-size:13px;color:var(--muted);margin-bottom:12px">No saved job descriptions yet.</p>';
    return;
  }
  container.innerHTML = savedJDs.map(jd => `
    <div class="jd-item" onclick="selectJD(${jd.id})">
      <div class="jd-item-info">
        <div class="jd-item-title">${esc(jd.title||'Untitled')} ${jd.company ? '— '+esc(jd.company) : ''}</div>
        <div class="jd-item-meta">${new Date(jd.created_at).toLocaleDateString()} · ${jd.jd_text ? jd.jd_text.substring(0,60)+'...' : ''}</div>
      </div>
      <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteJD(${jd.id})">✕</button>
    </div>`).join('');
}

function populateJDSelect() {
  const sel = document.getElementById('gen-jd-select');
  sel.innerHTML = '<option value="">— select a saved JD —</option>' +
    savedJDs.map(jd => `<option value="${jd.id}">${esc(jd.title||'Untitled')}${jd.company?' — '+esc(jd.company):''}</option>`).join('');
}

function selectJD(id) {
  const jd = savedJDs.find(j => j.id === id);
  if (!jd) return;
  document.getElementById('jd-title').value   = jd.title;
  document.getElementById('jd-company').value = jd.company;
  document.getElementById('jd-text').value    = jd.jd_text;
  document.querySelectorAll('.jd-item').forEach(el => el.classList.remove('jd-item-active'));
  event.currentTarget.classList.add('jd-item-active');
  toast('JD loaded into editor');
}

async function saveJD() {
  const jd_text = document.getElementById('jd-text').value.trim();
  if (!jd_text) { toast('Paste a job description first', true); return; }
  const d = await apiFetch('/jd', {
    method: 'POST',
    body: JSON.stringify({ jd: { title: val('jd-title'), company: val('jd-company'), jd_text } })
  });
  if (d.jd) {
    toast('✓ Job description saved');
    await loadJDList();
  } else { toast(d.error||'Save failed', true); }
}

async function deleteJD(id) {
  const d = await apiFetch(`/jd/${id}`, { method: 'DELETE' });
  if (d.message) { toast('Deleted'); await loadJDList(); }
  else toast(d.error||'Delete failed', true);
}

/*  GENERATE*/
async function generateResume() {
  const jd_id = document.getElementById('gen-jd-select').value;
  if (!jd_id) { toast('Select a job description first', true); return; }

  const btn   = document.getElementById('action-btn');
  const label = document.getElementById('action-label');
  btn.disabled = true;
  label.innerHTML = '<div class="spinner"></div> Generating…';

  const log     = document.getElementById('gen-log');
  const logText = document.getElementById('gen-log-text');
  log.classList.remove('hidden');
  logText.textContent = '→ Saving vault…\n';
  await saveVault();
  logText.textContent += '→ Calling Gemini AI…\n';

  try {
    const d = await apiFetch('/resume/generate', {
      method: 'POST',
      body: JSON.stringify({
        jd_id:        parseInt(jd_id),
        format:       val('gen-format'),
        tone:         val('gen-tone'),
        instructions: val('gen-extra'),
      })
    });
    if (d.error) {
      toast(d.error, true);
      logText.textContent += `✗ ${d.error}\n`;
    } else {
      currentResume = d.resume;
      logText.textContent += `✓ Resume saved: "${d.resume.label}"\n`;
      toast('✓ Resume ready — check Edit & Preview tabs');
      renderEditPanel(d.resume.resume);
      renderPreviewPanel(d.resume.resume);
      await loadHistory();
    }
  } catch(e) {
    toast('Network error', true);
    logText.textContent += `✗ ${e}\n`;
  }
  btn.disabled = false;
  label.textContent = '✨ Generate resume';
}

/* EDIT PANEL */
function renderEditPanel(resume) {
  document.getElementById('edit-empty').style.display = 'none';
  const c = document.getElementById('edit-content');
  c.classList.remove('hidden');

  c.innerHTML = `
    <div style="margin-bottom:16px">
      <div class="section-label">Header</div>
      <div class="card"><div class="card-body">
        <div class="row2">
          <div class="field"><label>Name</label><input id="e-name" type="text" value="${esc(resume.name||'')}" /></div>
          <div class="field"><label>Email</label><input id="e-email" type="email" value="${esc(resume.email||'')}" /></div>
        </div>
        <div class="row2">
          <div class="field"><label>Phone</label><input id="e-phone" type="tel" value="${esc(resume.phone||'')}" /></div>
          <div class="field"><label>Location</label><input id="e-location" type="text" value="${esc(resume.location||'')}" /></div>
        </div>
        <div class="row2">
          <div class="field"><label>LinkedIn</label><input id="e-linkedin" type="text" value="${esc(resume.linkedin||'')}" /></div>
          <div class="field"><label>GitHub</label><input id="e-github" type="text" value="${esc(resume.github||'')}" /></div>
        </div>
        <div class="row2">
          <div class="field"><label>Website</label><input id="e-website" type="text" value="${esc(resume.website||'')}" /></div>
          <div class="field"><label>Citizenship</label><input id="e-citizenship" type="text" value="${esc(resume.citizenship||'')}" /></div>
        </div>
      </div></div>
    </div>

    <div style="margin-bottom:16px">
      <div class="section-label">Section Order</div>
      <div class="card"><div class="card-body">
        ${(resume.section_order || ['education','experience','research','projects','skills']).map((sec, i, arr) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
            <span style="text-transform:capitalize;font-size:13px">${sec}</span>
            <div style="display:flex;gap:4px">
              <button class="btn btn-sm" onclick="moveSectionOrder(${i},'up')" ${i===0?'disabled':''}>↑</button>
              <button class="btn btn-sm" onclick="moveSectionOrder(${i},'down')" ${i===arr.length-1?'disabled':''}>↓</button>
            </div>
          </div>`).join('')}
      </div></div>
    </div>

    <div style="margin-bottom:16px">
      <div class="section-label" style="display:flex;justify-content:space-between;align-items:center">Education <button class="btn btn-sm" onclick="editAddEdu()">+ Add</button></div>
      ${(resume.education_entries||[]).map((edu, i) => `
        <div class="list-card" style="margin-bottom:10px">
          <div class="list-card-header">
            <span>${esc(edu.institution||'Education')}</span>
            <div style="display:flex;gap:4px">
              <button class="btn btn-sm" onclick="event.stopPropagation();editMoveEdu(${i},'up')" ${i===0?'disabled':''}>↑</button>
              <button class="btn btn-sm" onclick="event.stopPropagation();editMoveEdu(${i},'down')" ${i===(resume.education_entries.length-1)?'disabled':''}>↓</button>
              <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();editDeleteEdu(${i})">✕</button>
            </div>
          </div>
          <div class="list-card-body">
            <div class="row2">
              <div class="field"><label>Institution</label><input id="e-edu-inst-${i}" type="text" value="${esc(edu.institution||'')}" /></div>
              <div class="field"><label>Location</label><input id="e-edu-loc-${i}" type="text" value="${esc(edu.location||'')}" /></div>
            </div>
            <div class="row2">
              <div class="field"><label>Degree</label><input id="e-edu-deg-${i}" type="text" value="${esc(edu.degree||'')}" /></div>
              <div class="field"><label>Date</label><input id="e-edu-date-${i}" type="text" value="${esc(edu.date||'')}" /></div>
            </div>
            <div class="field"><label>Relevant coursework</label>
              <input id="e-edu-course-${i}" type="text" value="${esc(edu.coursework||'')}" />
            </div>
          </div>
        </div>`).join('')}
    </div>

    <div style="margin-bottom:16px">
      <div class="section-label" style="display:flex;justify-content:space-between;align-items:center">Experience <button class="btn btn-sm" onclick="editAddExp()">+ Add</button></div>
      ${(resume.experience||[]).map((job, i) => `
        <div class="list-card" style="margin-bottom:10px">
          <div class="list-card-header">
            <span>${esc(job.title||'')} — ${esc(job.company||'')}</span>
            <div style="display:flex;gap:4px">
              <button class="btn btn-sm" onclick="event.stopPropagation();editMoveExp(${i},'up')" ${i===0?'disabled':''}>↑</button>
              <button class="btn btn-sm" onclick="event.stopPropagation();editMoveExp(${i},'down')" ${i===(resume.experience.length-1)?'disabled':''}>↓</button>
              <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();editDeleteExp(${i})">✕</button>
            </div>
          <div class="list-card-body">
            <div class="row2">
              <div class="field"><label>Title</label><input id="e-job-title-${i}" type="text" value="${esc(job.title||'')}" /></div>
              <div class="field"><label>Company</label><input id="e-job-company-${i}" type="text" value="${esc(job.company||'')}" /></div>
            </div>
            <div class="row2">
              <div class="field"><label>Start</label><input id="e-job-start-${i}" type="text" value="${esc(job.start||'')}" /></div>
              <div class="field"><label>End</label><input id="e-job-end-${i}" type="text" value="${esc(job.end||'')}" /></div>
            </div>
            <div class="field"><label>Location</label><input id="e-job-loc-${i}" type="text" value="${esc(job.location||'')}" /></div>
            <div class="field"><label>Bullets (one per line)</label>
              <textarea id="e-job-bullets-${i}" rows="5">${esc((job.bullets||[]).join('\n'))}</textarea>
            </div>
          </div>
        </div>`).join('')}
    </div>

    ${(resume.research||[]).length ? `
    <div style="margin-bottom:16px">
      <div class="section-label">Research Experience</div>
      ${(resume.research||[]).map((r, i) => `
        <div class="list-card" style="margin-bottom:10px">
          <div class="list-card-header">
            <span>${esc(r.title||'')} | ${esc(r.institution||'')}</span>
            <div style="display:flex;gap:4px">
              <button class="btn btn-sm" onclick="event.stopPropagation();editMoveResearch(${i},'up')" ${i===0?'disabled':''}>↑</button>
              <button class="btn btn-sm" onclick="event.stopPropagation();editMoveResearch(${i},'down')" ${i===(resume.research.length-1)?'disabled':''}>↓</button>
              <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();editDeleteResearch(${i})">✕</button>
            </div>
          </div>
          <div class="list-card-body">
            <div class="row2">
              <div class="field"><label>Title</label><input id="e-res-title-${i}" type="text" value="${esc(r.title||'')}" /></div>
              <div class="field"><label>Institution</label><input id="e-res-inst-${i}" type="text" value="${esc(r.institution||'')}" /></div>
            </div>
            <div class="row2">
              <div class="field"><label>Start</label><input id="e-res-start-${i}" type="text" value="${esc(r.start||'')}" /></div>
              <div class="field"><label>End</label><input id="e-res-end-${i}" type="text" value="${esc(r.end||'')}" /></div>
            </div>
            <div class="field"><label>Bullets (one per line)</label>
              <textarea id="e-res-bullets-${i}" rows="3">${esc((r.bullets||[]).join('\n'))}</textarea>
            </div>
          </div>
        </div>`).join('')}
    </div>` : ''}

    <div style="margin-bottom:16px">
      <div class="section-label" style="display:flex;justify-content:space-between;align-items:center">Projects <button class="btn btn-sm" onclick="editAddProject()">+ Add</button></div>
      ${(resume.projects||[]).map((p, i) => `
        <div class="list-card" style="margin-bottom:10px">
          <div class="list-card-header">
            <span>${esc(p.name||'Project')}</span>
            <div style="display:flex;gap:4px">
              <button class="btn btn-sm" onclick="event.stopPropagation();editMoveProject(${i},'up')" ${i===0?'disabled':''}>↑</button>
              <button class="btn btn-sm" onclick="event.stopPropagation();editMoveProject(${i},'down')" ${i===(resume.projects.length-1)?'disabled':''}>↓</button>
              <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();editDeleteProject(${i})">✕</button>
            </div>
          </div>
          <div class="list-card-body">
            <div class="field"><label>Project name</label><input id="e-proj-name-${i}" type="text" value="${esc(p.name||'')}" /></div>
            <div class="field"><label>Tech stack</label><input id="e-proj-stack-${i}" type="text" value="${esc(p.stack||'')}" /></div>
            <div class="field"><label>Bullets (one per line)</label>
              <textarea id="e-proj-desc-${i}" rows="4">${esc(Array.isArray(p.desc) ? p.desc.join('\n') : (p.desc||''))}</textarea>
            </div>
          </div>
        </div>`).join('')}
    </div>

    <div style="margin-bottom:16px">
      <div class="section-label" style="display:flex;justify-content:space-between;align-items:center">Skills <button class="btn btn-sm" onclick="editAddSkill()">+ Add</button></div>
      ${(resume.skills_sections||[]).map((sk, i) => `
        <div class="list-card" style="margin-bottom:10px">
          <div class="list-card-header">
            <span>${esc(sk.category||'Skills')}</span>
            <div style="display:flex;gap:4px">
              <button class="btn btn-sm" onclick="event.stopPropagation();editMoveSkill(${i},'up')" ${i===0?'disabled':''}>↑</button>
              <button class="btn btn-sm" onclick="event.stopPropagation();editMoveSkill(${i},'down')" ${i===(resume.skills_sections.length-1)?'disabled':''}>↓</button>
              <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();editDeleteSkill(${i})">✕</button>
            </div>
          </div>

          <div class="list-card-body">
            <div class="field"><label>Category</label><input id="e-sk-cat-${i}" type="text" value="${esc(sk.category||'')}" /></div>
            <div class="field"><label>Skills (comma-separated)</label>
              <textarea id="e-sk-vals-${i}" rows="2">${esc(sk.values||'')}</textarea>
            </div>
          </div>
        </div>`).join('')}
    </div>`;
}

// Edit panel delete functions
function editDeleteEdu(i) {
  const r = collectEdits(currentResume.resume);
  r.education_entries.splice(i, 1);
  currentResume.resume = r;
  renderEditPanel(r);
}

function editDeleteExp(i) {
  const r = collectEdits(currentResume.resume);
  r.experience.splice(i, 1);
  currentResume.resume = r;
  renderEditPanel(r);
}

function editDeleteResearch(i) {
  const r = collectEdits(currentResume.resume);
  r.research.splice(i, 1);
  currentResume.resume = r;
  renderEditPanel(r);
}

function editDeleteProject(i) {
  const r = collectEdits(currentResume.resume);
  r.projects.splice(i, 1);
  currentResume.resume = r;
  renderEditPanel(r);
}

function editDeleteSkill(i) {
  const r = collectEdits(currentResume.resume);
  r.skills_sections.splice(i, 1);
  currentResume.resume = r;
  renderEditPanel(r);
}

// Edit panel add functions
function editAddExp() {
  const r = collectEdits(currentResume.resume);
  r.experience.push({
    title: '', company: '', start: '', end: '', location: '', bullets: []
  });
  currentResume.resume = r;
  renderEditPanel(r);
}

function editAddEdu() {
  const r = collectEdits(currentResume.resume);
  if (!r.education_entries) r.education_entries = [];
  r.education_entries.push({
    institution: '', location: '', degree: '', date: '', coursework: ''
  });
  currentResume.resume = r;
  renderEditPanel(r);
}

function editAddProject() {
  const r = collectEdits(currentResume.resume);
  if (!r.projects) r.projects = [];
  r.projects.push({ name: '', stack: '', desc: [] });
  currentResume.resume = r;
  renderEditPanel(r);
}

function editAddSkill() {
  const r = collectEdits(currentResume.resume);
  if (!r.skills_sections) r.skills_sections = [];
  r.skills_sections.push({ category: '', values: '' });
  currentResume.resume = r;
  renderEditPanel(r);
}

function editAddResearch() {
  const r = collectEdits(currentResume.resume);
  if (!r.research) r.research = [];
  r.research.push({
    title: '', institution: '', start: '', end: '', bullets: []
  });
  currentResume.resume = r;
  renderEditPanel(r);
}

function collectEdits(resume) {
  const r = { ...resume };

  // Header
  ['name','email','phone','location','linkedin','github','website','citizenship']
    .forEach(k => { r[k] = val('e-'+k) ?? resume[k] ?? ''; });

  // Education
  r.education_entries = (resume.education_entries||[]).map((edu, i) => ({
    ...edu,
    institution: val(`e-edu-inst-${i}`)   ?? edu.institution ?? '',
    location:    val(`e-edu-loc-${i}`)    ?? edu.location    ?? '',
    degree:      val(`e-edu-deg-${i}`)    ?? edu.degree      ?? '',
    date:        val(`e-edu-date-${i}`)   ?? edu.date        ?? '',
    coursework:  val(`e-edu-course-${i}`) ?? edu.coursework  ?? '',
  }));

  // Experience
  r.experience = (resume.experience||[]).map((job, i) => ({
    ...job,
    title:    val(`e-job-title-${i}`)   ?? job.title    ?? '',
    company:  val(`e-job-company-${i}`) ?? job.company  ?? '',
    start:    val(`e-job-start-${i}`)   ?? job.start    ?? '',
    end:      val(`e-job-end-${i}`)     ?? job.end      ?? '',
    location: val(`e-job-loc-${i}`)     ?? job.location ?? '',
    bullets:  (val(`e-job-bullets-${i}`) ?? '').split('\n').filter(b => b.trim()),
  }));

  // Research
  r.research = (resume.research||[]).map((res, i) => ({
    ...res,
    title:       val(`e-res-title-${i}`)   ?? res.title       ?? '',
    institution: val(`e-res-inst-${i}`)    ?? res.institution ?? '',
    start:       val(`e-res-start-${i}`)   ?? res.start       ?? '',
    end:         val(`e-res-end-${i}`)     ?? res.end         ?? '',
    bullets:     (val(`e-res-bullets-${i}`) ?? '').split('\n').filter(b => b.trim()),
  }));

  // Projects
  r.projects = (resume.projects||[]).map((p, i) => ({
    ...p,
    name:  val(`e-proj-name-${i}`)  ?? p.name  ?? '',
    stack: val(`e-proj-stack-${i}`) ?? p.stack ?? '',
    desc:  (val(`e-proj-desc-${i}`) ?? '').split('\n').filter(b => b.trim()),
  }));

  // Skills
  r.skills_sections = (resume.skills_sections||[]).map((sk, i) => ({
    ...sk,
    category: val(`e-sk-cat-${i}`)  ?? sk.category ?? '',
    values:   val(`e-sk-vals-${i}`) ?? sk.values   ?? '',
  }));

  r.section_order = resume.section_order ||
    ['education', 'experience', 'research', 'projects', 'skills'];

  return r;
}

async function saveEdits() {
  if (!currentResume) { toast('Nothing to save yet', true); return; }
  const updated = collectEdits(currentResume.resume);
  const d = await apiFetch(`/resume/${currentResume.id}`, {
    method: 'PUT',
    body: JSON.stringify({ resume: updated })
  });
  if (d.message) {
    currentResume.resume = updated;
    toast('✓ Edits saved');
    renderPreviewPanel(updated);
  } else { toast(d.error||'Save failed', true); }
}

/*  PREVIEW PANEL */
function renderPreviewPanel(resume) {
  document.getElementById('preview-empty').style.display = 'none';
  document.getElementById('preview-content').classList.remove('hidden');
  const doc = document.getElementById('resume-doc');

  const contact = [resume.location, resume.phone, resume.email, resume.citizenship]
    .filter(Boolean).join(' | ');
  const links = [resume.linkedin, resume.github, resume.website]
    .filter(Boolean).join(' | ');

  const eduHtml = (resume.education_entries||[]).map(e => `
    <div style="display:flex;justify-content:space-between">
      <span class="job-title">${esc(e.institution)}</span>
      <span style="font-size:12px;font-style:italic">${esc(e.location||'')}</span>
    </div>
    <div class="job-company">${esc(e.degree)} &nbsp; ${esc(e.date||'')}</div>
    ${e.coursework?`<p style="font-size:12px">Relevant Coursework: ${esc(e.coursework)}</p>`:''}
  `).join('') || (resume.education?`<p>${esc(resume.education)}</p>`:'');

  const expHtml = (resume.experience||[]).map(job => `
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <span class="job-title">${esc(job.company)}</span>
      <span class="job-date">${esc(job.start||'')}${job.end?' – '+esc(job.end):''}</span>
    </div>
    <div class="job-company">${esc(job.title)}${job.location?' — '+esc(job.location):''}</div>
    <ul>${(job.bullets||[]).map(b=>`<li>${esc(b)}</li>`).join('')}</ul>
  `).join('');

  const researchHtml = (resume.research||[]).map(r => `
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <span class="job-title">${esc(r.title)} | ${esc(r.institution)}</span>
      <span class="job-date">${esc(r.start||'')}${r.end?' – '+esc(r.end):''}</span>
    </div>
    <ul>${(r.bullets||[]).map(b=>`<li>${esc(b)}</li>`).join('')}</ul>
  `).join('');

  const projHtml = (resume.projects||[]).map(p => {
    const header = p.stack ? `• ${esc(p.name)} | ${esc(p.stack)}` : `• ${esc(p.name)}`;
    const bullets = Array.isArray(p.desc)
      ? p.desc.map(b=>`<li>${esc(b)}</li>`).join('')
      : (p.desc||'').split('\n').filter(Boolean).map(b=>`<li>${esc(b)}</li>`).join('');
    return `<p class="proj-name">${header}</p><ul>${bullets}</ul>`;
  }).join('');

  const skillsHtml = (resume.skills_sections||[]).map(sk =>
    `<p><strong>${esc(sk.category)}:</strong> ${esc(sk.values)}</p>`
  ).join('') || (resume.skills?`<p>${esc(resume.skills)}</p>`:'');

  doc.innerHTML = `
    <h1>${esc(resume.name||'')}</h1>
    ${contact?`<div class="contact-line">${esc(contact)}</div>`:''}
    ${links?`<div class="contact-line" style="color:#1155CC">${esc(links)}</div>`:''}
    <hr/>
    ${eduHtml?`<h2>Education</h2>${eduHtml}`:''}
    ${expHtml?`<h2>Work Experience</h2>${expHtml}`:''}
    ${researchHtml?`<h2>Research Experience</h2>${researchHtml}`:''}
    ${projHtml?`<h2>Personal Projects</h2>${projHtml}`:''}
    ${skillsHtml?`<h2>Skills and Interests</h2>${skillsHtml}`:''}`;
}

/* HISTORY*/
async function loadHistory() {
  const d = await apiFetch('/resume');
  const resumes = d.resumes || [];
  const container = document.getElementById('history-list');
  if (!resumes.length) {
    container.innerHTML = '<div class="empty"><div class="big-icon">🕓</div><p>No resumes yet.</p></div>';
    return;
  }
  container.innerHTML = resumes.map(r => `
    <div class="history-item">
      <div class="history-item-header">
        <div class="history-item-label">${esc(r.label||'Untitled')}</div>
      </div>
      <div class="history-item-meta">${r.format} · ${r.tone} · ${new Date(r.created_at).toLocaleDateString()}</div>
      <div class="history-item-actions">
        <button class="btn btn-sm" onclick="loadHistoryResume(${r.id})">✏️ Load &amp; edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteResume(${r.id})">✕ Delete</button>
      </div>
    </div>`).join('');
}

async function loadHistoryResume(id) {
  const d = await apiFetch(`/resume/${id}`);
  if (d.resume) {
    currentResume = d.resume;
    renderEditPanel(d.resume.resume);
    renderPreviewPanel(d.resume.resume);
    toast('Resume loaded — check Edit & Preview tabs');
    switchTab('edit', document.querySelector('[data-tab=edit]'));
  }
}

async function deleteResume(id) {
  const d = await apiFetch(`/resume/${id}`, { method: 'DELETE' });
  if (d.message) { toast('Deleted'); loadHistory(); }
  else toast(d.error||'Delete failed', true);
}

/*PDF EXPORT */
async function exportPDF() {
  if (!currentResume) { toast('No resume to export', true); return; }
  const btn   = document.getElementById('action-btn');
  const label = document.getElementById('action-label');
  btn.disabled = true;
  label.innerHTML = '<div class="spinner"></div> Building PDF…';
  try {
    const blob = await apiFetch('/export/pdf', {
      method: 'POST',
      body: JSON.stringify({ resume_id: currentResume.id })
    });
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url;
    a.download = `${(currentResume.resume.name||'resume').replace(/\s+/g,'_')}_resume.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast('✓ PDF downloaded');
  } catch(e) { 
    toast('PDF export failed', true); 
  } finally {
    // always runs whether success or error
    btn.disabled = false;
    label.textContent = '⬇️ Export PDF';
  }
}

/* UTILITIES */
function val(id) { 
  const el = document.getElementById(id);
  return el ? el.value : null;
}
function uid()    { return Math.floor(Math.random() * 1e12); }
function esc(str) {
  return String(str||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// job description editor clear function
function clearJD() {
  document.getElementById('jd-title').value   = '';
  document.getElementById('jd-company').value = '';
  document.getElementById('jd-text').value    = '';
  toast('✓ Job description cleared');
}

function moveSectionOrder(i, direction) {
  const r = collectEdits(currentResume.resume);
  if (!r.section_order) {
    r.section_order = ['education', 'experience', 'research', 'projects', 'skills'];
  }
  moveItem(r.section_order, i, direction);
  currentResume.resume = r;
  renderEditPanel(r);
}