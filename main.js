const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');

let mainWindow;

function createWindow() {
  const smokeTest = process.argv.includes('--smoke-test');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#f3f4f6',
    title: 'Canvas Board',
    autoHideMenuBar: true,
    show: !smokeTest,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  if (smokeTest) {
    mainWindow.webContents.once('did-finish-load', async () => {
      try {
        const result = await mainWindow.webContents.executeJavaScript(`(() => {
          const initialCounter = document.querySelector('#pageCounter').textContent;
          document.querySelector('#addPageBtn').click();
          const addedCounter = document.querySelector('#pageCounter').textContent;
          document.querySelector('#previousPageBtn').click();
          return {
            hasCanvas: Boolean(document.querySelector('#board')),
            toolCount: document.querySelectorAll('[data-tool]').length,
            hasExport: Boolean(window.whiteboardAPI?.savePNG && window.whiteboardAPI?.savePDF),
            canvasSize: [document.querySelector('#board').width, document.querySelector('#board').height],
            initialCounter, addedCounter,
            returnedCounter: document.querySelector('#pageCounter').textContent
          };
        })()`);
        const passed = result.hasCanvas && result.toolCount === 9 && result.hasExport && result.canvasSize.every(Boolean)
          && result.initialCounter === '1 / 1' && result.addedCounter === '2 / 2' && result.returnedCounter === '1 / 2';
        console.log(`SMOKE_TEST_${passed ? 'PASS' : 'FAIL'} ${JSON.stringify(result)}`);
        app.exit(passed ? 0 : 1);
      } catch (error) {
        console.error('SMOKE_TEST_FAIL', error);
        app.exit(1);
      }
    });
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('save-png', async (_event, dataUrl) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export whiteboard as image',
    defaultPath: `whiteboard-${new Date().toISOString().slice(0, 10)}.png`,
    filters: [{ name: 'PNG image', extensions: ['png'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  await fs.writeFile(result.filePath, Buffer.from(base64, 'base64'));
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('save-pdf', async (_event, payload) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export whiteboard as PDF',
    defaultPath: `whiteboard-${new Date().toISOString().slice(0, 10)}.pdf`,
    filters: [{ name: 'PDF document', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };

  const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  const dataUrls = payload.dataUrls || [payload.dataUrl];
  const pageImages = dataUrls.map((dataUrl) => {
    const safeImage = dataUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return `<section class="page"><img src="${safeImage}"></section>`;
  }).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${payload.width}px ${payload.height}px; margin: 0; }
    * { box-sizing: border-box; } html, body { margin: 0; width: 100%; }
    .page { width: ${payload.width}px; height: ${payload.height}px; overflow: hidden; break-after: page; page-break-after: always; }
    .page:last-child { break-after: auto; page-break-after: auto; }
    img { display: block; width: 100%; height: 100%; object-fit: contain; }
  </style></head><body>${pageImages}</body></html>`;

  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await printWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { marginType: 'none' }
    });
    await fs.writeFile(result.filePath, pdf);
    return { canceled: false, filePath: result.filePath };
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy();
  }
});
