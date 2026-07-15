"use strict";
const electron = require("electron");
const api = {
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
};
electron.contextBridge.exposeInMainWorld("desktop", api);
