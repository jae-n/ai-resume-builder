let currentSavedPrompt = null;

async function loadSavedPrompts() {
  try {
    const d = await apiFetch('/prompts');
    const prompts = d.prompts || [];
    if (prompts.length) {
      currentSavedPrompt = prompts[0];
      updatePromptLabel();
    }
  } catch(e) {
    console.warn('Could not load prompts:', e);
  }
}

async function savePrompt() {
  const extra  = val('gen-extra');
  const format = val('gen-format');
  const tone   = val('gen-tone');

  if (!extra.trim()) { toast('Type some instructions first', true); return; }

  // delete old saved prompt if exists
  if (currentSavedPrompt) {
    await apiFetch(`/prompts/${currentSavedPrompt.id}`, { method: 'DELETE' });
  }

  const d = await apiFetch('/prompts', {
    method: 'POST',
    body: JSON.stringify({ name: 'My Prompt', extra, format, tone })
  });

  if (d.prompt) {
    currentSavedPrompt = d.prompt;
    toast('✓ Prompt saved');
    updatePromptLabel();
  } else {
    toast(d.error || 'Save failed', true);
  }
}

async function loadPrompt() {
  if (!currentSavedPrompt) { toast('No saved prompt yet', true); return; }
  document.getElementById('gen-extra').value  = currentSavedPrompt.extra;
  document.getElementById('gen-format').value = currentSavedPrompt.format;
  document.getElementById('gen-tone').value   = currentSavedPrompt.tone;
  toast('✓ Prompt loaded');
}

function clearPrompt() {
  document.getElementById('gen-extra').value  = '';
  document.getElementById('gen-format').value = 'chronological';
  document.getElementById('gen-tone').value   = 'professional';
  document.getElementById('gen-jd-select').value = '';
  toast('✓ Fields cleared');
}

function updatePromptLabel() {
  const el = document.getElementById('saved-prompt-label');
  if (!el) return;
  el.textContent = currentSavedPrompt
    ? `✓ Prompt saved · ${new Date(currentSavedPrompt.created_at).toLocaleDateString()}`
    : '';
}