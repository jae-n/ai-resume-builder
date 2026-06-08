function moveItem(arr, i, direction) {
  if (direction === 'up' && i > 0)
    [arr[i], arr[i-1]] = [arr[i-1], arr[i]];
  else if (direction === 'down' && i < arr.length - 1)
    [arr[i], arr[i+1]] = [arr[i+1], arr[i]];
}
 
function editMoveEdu(i, direction) {
  const r = collectEdits(currentResume.resume);
  moveItem(r.education_entries, i, direction);
  currentResume.resume = r;
  renderEditPanel(r);
}
 
function editMoveExp(i, direction) {
  const r = collectEdits(currentResume.resume);
  moveItem(r.experience, i, direction);
  currentResume.resume = r;
  renderEditPanel(r);
}
 
function editMoveResearch(i, direction) {
  const r = collectEdits(currentResume.resume);
  moveItem(r.research, i, direction);
  currentResume.resume = r;
  renderEditPanel(r);
}
 
function editMoveProject(i, direction) {
  const r = collectEdits(currentResume.resume);
  moveItem(r.projects, i, direction);
  currentResume.resume = r;
  renderEditPanel(r);
}
 
function editMoveSkill(i, direction) {
  const r = collectEdits(currentResume.resume);
  moveItem(r.skills_sections, i, direction);
  currentResume.resume = r;
  renderEditPanel(r);
}