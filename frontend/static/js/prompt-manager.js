/* ═══════════════════════════════════════════════
   AI Resume Builder — prompt-manager.js
   Handles saving, loading, and clearing
   generate tab prompts in localStorage.
   ═══════════════════════════════════════════════ */

const PROMPTS_KEY = 'savedPrompts';

function savePrompt() {
  const extra  = val('gen-extra');
  const format = val('gen-format');
  const tone   = val('gen-tone');

  if (!extra.trim()) { toast('Type some instructions first', true); return; }

  const prompts = JSON.parse(localStorage.getItem(PROMPTS_KEY) || '[]');

  const name = prompt('Name this prompt:', `Prompt ${prompts.length + 1}`);
  if (!name) return;

  prompts.push({
    name,
    extra,
    format,
    tone,
    saved_at: new Date().toLocaleDateString()
  });

  localStorage.setItem(PROMPTS_KEY, JSON.stringify(prompts));
  toast(`✓ Prompt "${name}" saved`);
  updatePromptLabel();
}

function loadPrompt() {
  const prompts = JSON.parse(localStorage.getItem(PROMPTS_KEY) || '[]');
  if (!prompts.length) { toast('No saved prompts yet', true); return; }

  const names = prompts.map((p, i) => `${i + 1}. ${p.name} (${p.saved_at})`).join('\n');
  const input = prompt(`Select a prompt number:\n\n${names}`);
  if (!input) return;

  const index = parseInt(input) - 1;
  if (isNaN(index) || index < 0 || index >= prompts.length) {
    toast('Invalid selection', true);
    return;
  }

  const p = prompts[index];
  document.getElementById('gen-extra').value  = p.extra;
  document.getElementById('gen-format').value = p.format;
  document.getElementById('gen-tone').value   = p.tone;

  toast(`✓ Loaded "${p.name}"`);
  updatePromptLabel();
}

function deletePrompt() {
  const prompts = JSON.parse(localStorage.getItem(PROMPTS_KEY) || '[]');
  if (!prompts.length) { toast('No saved prompts yet', true); return; }

  const names = prompts.map((p, i) => `${i + 1}. ${p.name} (${p.saved_at})`).join('\n');
  const input = prompt(`Delete which prompt?\n\n${names}`);
  if (!input) return;

  const index = parseInt(input) - 1;
  if (isNaN(index) || index < 0 || index >= prompts.length) {
    toast('Invalid selection', true);
    return;
  }

  const name = prompts[index].name;
  prompts.splice(index, 1);
  localStorage.setItem(PROMPTS_KEY, JSON.stringify(prompts));
  toast(`Deleted "${name}"`);
  updatePromptLabel();
}

function clearPrompt() {
  document.getElementById('gen-extra').value  = '';
  document.getElementById('gen-format').value = 'chronological';
  document.getElementById('gen-tone').value   = 'professional';
  document.getElementById('saved-prompt-label').textContent = '';
  toast('Cleared');
}

function updatePromptLabel() {
  const prompts = JSON.parse(localStorage.getItem(PROMPTS_KEY) || '[]');
  const el = document.getElementById('saved-prompt-label');
  if (!el) return;
  el.textContent = prompts.length
    ? `${prompts.length} saved prompt${prompts.length > 1 ? 's' : ''}`
    : '';
}