const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const outputDir = 'C:\\Users\\Bhavishy\\.gemini\\antigravity\\brain\\d621c619-16cd-4322-b68c-f9ffebf49c49';

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const indexPath = path.join(__dirname, '..', 'src', 'renderer', 'index.html');
  await win.loadFile(indexPath);

  // Wait 1 second for fonts and DOM rendering
  await new Promise(r => setTimeout(r, 1200));

  // 1. Capture Main Studio View
  const imgStudio = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outputDir, 'studylock_ui_studio.png'), imgStudio.toPNG());
  console.log('Saved studylock_ui_studio.png');

  // 2. Open Parent Proof Screen and capture
  await win.webContents.executeJavaScript(`
    const modal = document.getElementById('parentProofModal');
    if (modal) modal.classList.remove('hidden');
    const sub = document.getElementById('parentProofSubject');
    if (sub) sub.textContent = 'MATHS';
    const top = document.getElementById('parentProofTopic');
    if (top) top.textContent = 'Permutations & Combinations (Lecture 01)';
    const elap = document.getElementById('parentProofElapsed');
    if (elap) elap.textContent = '24 Minute (18s)';
    const rem = document.getElementById('parentProofRemaining');
    if (rem) rem.textContent = '21 Minute';
    const prog = document.getElementById('parentProofProgressBar');
    if (prog) prog.style.width = '53%';
  `);
  await new Promise(r => setTimeout(r, 600));

  const imgProof = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outputDir, 'studylock_ui_padhai_proof.png'), imgProof.toPNG());
  console.log('Saved studylock_ui_padhai_proof.png');

  // 3. Switch to Focus Clock Tab
  await win.webContents.executeJavaScript(`
    const modal = document.getElementById('parentProofModal');
    if (modal) modal.classList.add('hidden');
    document.querySelectorAll('.nav-segment-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const clockBtn = document.querySelector('[data-tab="tabClock"]');
    if (clockBtn) clockBtn.classList.add('active');
    const clockPane = document.getElementById('tabClock');
    if (clockPane) clockPane.classList.add('active');
  `);
  await new Promise(r => setTimeout(r, 600));

  const imgClock = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outputDir, 'studylock_ui_focus_clock.png'), imgClock.toPNG());
  console.log('Saved studylock_ui_focus_clock.png');

  app.quit();
});
