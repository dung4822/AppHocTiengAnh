import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi, ProgressEvent } from '@shared/types'

// Preload là "cầu nối" an toàn: renderer KHÔNG có quyền dùng Node/DB/file,
// chỉ được gọi đúng những hàm khai báo ở đây (contextIsolation bật, nodeIntegration tắt).
const api: AppApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),
  listVoices: () => ipcRenderer.invoke('voices:list'),
  previewVoice: (id) => ipcRenderer.invoke('voices:preview', id),
  getUsage: () => ipcRenderer.invoke('usage:month'),
  getStorageInfo: () => ipcRenderer.invoke('storage:info'),
  openUserData: () => ipcRenderer.invoke('storage:open'),
  moveUserData: () => ipcRenderer.invoke('storage:move'),

  getHomeStats: () => ipcRenderer.invoke('home:stats'),
  listTopics: () => ipcRenderer.invoke('topics:list'),
  listLessons: () => ipcRenderer.invoke('lessons:list'),
  createLesson: (topic) => ipcRenderer.invoke('lessons:create', topic),
  getLesson: (id) => ipcRenderer.invoke('lessons:get', id),
  resumeAudio: (id) => ipcRenderer.invoke('lessons:resumeAudio', id),
  gradeAnswers: (lessonId, answers) => ipcRenderer.invoke('lessons:grade', lessonId, answers),
  finishLesson: (id, markKnown) => ipcRenderer.invoke('lessons:finish', id, markKnown),
  setWordStatus: (term, status) => ipcRenderer.invoke('words:setStatus', term, status),
  saveFromContext: (input) => ipcRenderer.invoke('vocab:saveFromContext', input),
  enrichLesson: (id) => ipcRenderer.invoke('lessons:enrich', id),
  deleteLesson: (id, deleteVocab) => ipcRenderer.invoke('lessons:delete', id, deleteVocab),

  lookup: (term, ctx) => ipcRenderer.invoke('lookup', term, ctx),
  saveLookupAsCard: (term, ctx) => ipcRenderer.invoke('lookup:save', term, ctx),

  listVocab: (f) => ipcRenderer.invoke('vocab:list', f),
  setVocabSuspended: (id, s) => ipcRenderer.invoke('vocab:suspend', id, s),
  deleteVocab: (id) => ipcRenderer.invoke('vocab:delete', id),

  getReviewCounts: () => ipcRenderer.invoke('review:counts'),
  getNextReviewCard: (lastVocabId) => ipcRenderer.invoke('review:next', lastVocabId),
  answerReview: (cardId, rating) => ipcRenderer.invoke('review:answer', cardId, rating),
  undoReview: (logId) => ipcRenderer.invoke('review:undo', logId),

  addListeningTime: (seconds, source) => ipcRenderer.invoke('listening:add', seconds, source),

  onProgress: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, data: ProgressEvent): void => cb(data)
    ipcRenderer.on('progress', listener)
    return () => ipcRenderer.removeListener('progress', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
