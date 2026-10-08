import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { closeDb } from '../db'
import { DATA_FOLDER_NAME, moveDataDir } from '../dataLocation'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { GradeInput, IpcResult, LookupContext, ProgressEvent, ReviewRating, VocabFilter } from '@shared/types'
import { toUserMessage, UserError } from '../errors'
import { previewAudioDir, userDataDir } from '../paths'
import { VOICES } from '../config'
import { getSettings, saveSettings } from '../services/settingsService'
import {
  createLesson,
  deleteLesson,
  finishLesson,
  generateMissingAudio,
  getHomeStats,
  getLesson,
  listLessons,
  listTopics
} from '../services/lessonService'
import { gradeAnswers } from '../services/gradingService'
import { enrichLesson } from '../services/enrichService'
import { lookup, saveFromContext, saveLookupAsCard } from '../services/lookupService'
import { setWordStatus } from '../services/wordService'
import { deleteVocab, listVocab, setVocabSuspended } from '../services/vocabService'
import { getMonthUsage, getStorageInfo } from '../services/usageService'
import { tts } from '../services/tts/kokoroProvider'
import { answerCard, getNextCard, getReviewCounts, undoReview } from '../services/reviewService'
import { addListeningTime, type ListenSource } from '../services/listeningService'
import { audioUrl, toRelativeAudioPath } from '../services/audioUrl'

// Bọc mỗi handler: mọi lỗi được bắt lại và trả về thông báo tiếng Việt, app không bao giờ crash vì lỗi API.
// (IPC giống như các endpoint của một Web API nội bộ; renderer gọi qua window.api.)
function handle<A extends unknown[], T>(channel: string, fn: (...args: A) => T | Promise<T>): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<IpcResult<T>> => {
    try {
      return { ok: true, data: await fn(...(args as A)) }
    } catch (err) {
      return { ok: false, error: toUserMessage(err) }
    }
  })
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  // Gửi tiến trình (tạo bài, tải model, tạo audio) sang renderer
  const progress = (e: ProgressEvent): void => {
    getWindow()?.webContents.send('progress', e)
  }

  // ----- Cài đặt -----
  handle('settings:get', () => getSettings())
  handle('settings:save', (s: Parameters<typeof saveSettings>[0]) => saveSettings(s))
  handle('voices:list', () => VOICES)
  handle('voices:preview', async (voiceId: string) => {
    if (!VOICES.some((v) => v.id === voiceId)) throw new UserError('Giọng không hợp lệ.')
    const out = join(previewAudioDir(), `${voiceId}.mp3`)
    if (!existsSync(out)) {
      await tts.ensureReady((p) => progress({ stage: 'model', message: p.message, current: p.percent, total: 100 }))
      await tts.synthesizeToFile("Hi there! This is how I sound. Let's practice listening together.", voiceId, out)
    }
    return audioUrl(toRelativeAudioPath(out))!
  })
  handle('usage:month', () => getMonthUsage())
  handle('storage:info', () => getStorageInfo())
  handle('storage:open', async () => {
    await shell.openPath(userDataDir())
  })
  // Chuyển toàn bộ dữ liệu (DB, audio, model) sang thư mục khác rồi khởi động lại app
  handle('storage:move', async () => {
    const win = getWindow()
    const opts = { title: 'Chọn nơi lưu dữ liệu', properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[] }
    const picked = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (picked.canceled || picked.filePaths.length === 0) return null
    const target = join(picked.filePaths[0], DATA_FOLDER_NAME)
    const confirm = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Chuyển', 'Hủy'],
      defaultId: 0,
      cancelId: 1,
      message: `Chuyển toàn bộ dữ liệu sang:\n${target}\n\nApp sẽ tự khởi động lại sau khi chuyển xong.`
    })
    if (confirm.response !== 0) return null
    const moved = moveDataDir(picked.filePaths[0], () => {
      tts.kill()
      closeDb()
    })
    app.relaunch()
    app.exit(0)
    return moved
  })

  // ----- Bài học -----
  handle('home:stats', () => getHomeStats())
  handle('topics:list', () => listTopics())
  handle('lessons:list', () => listLessons())
  handle('lessons:create', async (topic: string | null) => {
    try {
      return await createLesson(topic, progress)
    } catch (err) {
      progress({ stage: 'error', message: toUserMessage(err) })
      throw err
    }
  })
  handle('lessons:get', (id: number) => getLesson(id))
  handle('lessons:resumeAudio', async (id: number) => {
    try {
      await generateMissingAudio(id, progress)
      progress({ stage: 'done', message: 'Đã tạo xong audio.' })
    } catch (err) {
      progress({ stage: 'error', message: toUserMessage(err) })
      throw err
    }
  })
  handle('lessons:grade', async (lessonId: number, answers: GradeInput[]) => {
    await gradeAnswers(lessonId, answers)
    return getLesson(lessonId)
  })
  handle('lessons:finish', (id: number, markKnown: boolean) => finishLesson(id, markKnown))
  handle('words:setStatus', (term: string, status: 'new' | 'known' | 'ignored') => setWordStatus(term, status))
  handle('vocab:saveFromContext', (input: { term: string; meaningVi: string; sentenceId: number }) => saveFromContext(input))
  handle('lessons:enrich', async (id: number) => {
    const errors = await enrichLesson(id)
    if (errors.length) throw new UserError('Chưa tạo được phần giải thích/chú thích: ' + errors[0])
    return getLesson(id)
  })
  handle('lessons:delete', (id: number, deleteVocab: boolean) => deleteLesson(id, deleteVocab))

  // ----- Tra từ & thẻ từ vựng -----
  handle('lookup', (term: string, ctx?: LookupContext) => lookup(term, ctx))
  handle('lookup:save', (term: string, ctx?: LookupContext) => saveLookupAsCard(term, ctx))
  handle('vocab:list', (f: VocabFilter) => listVocab(f))
  handle('vocab:suspend', (id: number, s: boolean) => setVocabSuspended(id, s))
  handle('vocab:delete', (id: number) => deleteVocab(id))

  // ----- Ôn tập (Giai đoạn 2, chạy offline hoàn toàn, không gọi API) -----
  handle('review:counts', () => getReviewCounts())
  handle('listening:add', (seconds: number, source: ListenSource) => addListeningTime(seconds, source))
  handle('review:next', (lastVocabId: number | null) => getNextCard(lastVocabId))
  handle('review:answer', (cardId: number, rating: ReviewRating) => ({ logId: answerCard(cardId, rating) }))
  handle('review:undo', (logId: number) => undoReview(logId))
}
