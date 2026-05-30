const { app, BrowserWindow, shell, Menu, globalShortcut } = require('electron');
const path = require('path');
const { startAmellifyServer } = require('./server');

let mainWindow = null;
const PORT = Number(process.env.PORT || 3000);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Amellify',
    backgroundColor: '#f5f5f7',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      zoomFactor: 1.0,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: 'Amellify',
            submenu: [
              { role: 'about', label: 'Acerca de Amellify' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit', label: 'Salir' },
            ],
          },
        ]
      : []),
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Nueva Materia',
          accelerator: 'CmdOrCtrl+N',
          click: () =>
            mainWindow?.webContents.executeJavaScript(
              'app.openAddCourseModal()'
            ),
        },
        { type: 'separator' },
        process.platform === 'darwin'
          ? { role: 'close' }
          : { role: 'quit', label: 'Salir' },
      ],
    },
    {
      label: 'Vista',
      submenu: [
        {
          label: 'Vista Grid',
          accelerator: 'CmdOrCtrl+1',
          click: () =>
            mainWindow?.webContents.executeJavaScript("app.switchView('grid')"),
        },
        {
          label: 'Vista Semanal',
          accelerator: 'CmdOrCtrl+2',
          click: () =>
            mainWindow?.webContents.executeJavaScript("app.switchView('week')"),
        },
        {
          label: 'Lista',
          accelerator: 'CmdOrCtrl+3',
          click: () =>
            mainWindow?.webContents.executeJavaScript("app.switchView('list')"),
        },
        { type: 'separator' },
        {
          label: 'Alternar tema',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () =>
            mainWindow?.webContents.executeJavaScript('app.toggleTheme()'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  await startAmellifyServer({
    host: '127.0.0.1',
    port: PORT,
    displayHost: '127.0.0.1',
  });
  buildMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
