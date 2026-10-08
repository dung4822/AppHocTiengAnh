import { useEffect, useState } from 'react'
import { Check, CircleAlert, Info, KeyRound, Loader2, Volume2 } from 'lucide-react'
import type { AppSettings, Level, ProgressEvent, StorageInfo, UsageSummary, VoiceInfo } from '@shared/types'
import { api, call, errMsg } from '../api'
import { useApp } from '../appState'
import { formatBytes, formatCompact } from '../format'
import { ProgressBar } from '../components/ui'

const LEVELS: Level[] = ['A2', 'B1', 'B2', 'C1']

export default function SettingsPage() {
  const { nav, refresh } = useApp()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressEvent | null>(null)

  useEffect(() => {
    call(api.getSettings()).then(setSettings).catch((e) => setError(errMsg(e)))
    call(api.listVoices()).then(setVoices).catch(() => {})
    call(api.getUsage()).then(setUsage).catch(() => {})
    call(api.getStorageInfo()).then(setStorage).catch(() => {})
    return api.onProgress(setProgress)
  }, [])

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center">
        {error ? <p className="text-err">{error}</p> : <Loader2 className="animate-spin text-fg3" size={24} />}
      </div>
    )
  }

  const first = !settings.hasApiKey
  const update = (patch: Partial<AppSettings>): void => {
    setSettings({ ...settings, ...patch })
    setSaved(false)
  }

  const save = async (): Promise<void> => {
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      const s = await call(
        api.saveSettings({
          level: settings.level,
          model: settings.model,
          voiceA: settings.voiceA,
          voiceB: settings.voiceB,
          newPerDay: settings.newPerDay,
          reviewsPerDay: settings.reviewsPerDay,
          desiredRetention: settings.desiredRetention,
          apiKey: apiKey || undefined
        })
      )
      setSettings(s)
      setApiKey('')
      setSaved(true)
      refresh()
      if (first && s.hasApiKey) nav({ page: 'home' })
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  const preview = async (voiceId: string): Promise<void> => {
    setPreviewing(voiceId)
    setProgress(null)
    setError(null)
    try {
      const url = await call(api.previewVoice(voiceId))
      await new Audio(url).play()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setPreviewing(null)
    }
  }

  const voiceField = (label: React.ReactNode, value: string, onChange: (v: string) => void) => (
    <label className="flex flex-col gap-1.5">
      <span className="font-medium">{label}</span>
      <span className="flex gap-2">
        <select className="select flex-1" value={value} onChange={(e) => onChange(e.target.value)}>
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-secondary px-3 font-medium" onClick={() => preview(value)} disabled={previewing !== null}>
          {previewing === value ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
          {previewing === value ? 'Đang tạo…' : 'Nghe thử'}
        </button>
      </span>
    </label>
  )

  const cachedPct = usage && usage.inputTokens > 0 ? Math.round((usage.cachedTokens / usage.inputTokens) * 100) : 0
  const modelPct = previewing && progress?.stage === 'model' && progress.total ? ((progress.current ?? 0) / progress.total) * 100 : null

  return (
    <div className="h-full overflow-y-auto">
      <main className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-10 pb-14 pt-9">
        <h1 className="page-title">Cài đặt</h1>

        {first && (
          <section className="flex items-start gap-[18px] rounded-[18px] bg-accent-soft px-7 py-[26px]">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-accent text-white">
              <KeyRound size={20} />
            </span>
            <div className="flex flex-col gap-1.5">
              <h2 className="m-0 text-xl font-bold text-accent-text">Chào bạn! Bắt đầu chỉ cần một bước</h2>
              <span>Nhập API key DeepSeek bên dưới để AI viết bài nghe cho bạn. Key được mã hóa và chỉ lưu trên máy này.</span>
              <span className="text-[13px] text-fg2">Các mục khác đã có giá trị mặc định hợp lý — bạn có thể chỉnh sau.</span>
            </div>
          </section>
        )}

        {/* DeepSeek */}
        <section className={'flex flex-col gap-[18px] rounded-[14px] bg-surface p-6 ' + (first ? 'border-[1.5px] border-accent' : 'border border-line')}>
          <div className="flex flex-col gap-0.5">
            <h2 className="m-0 text-base font-bold">DeepSeek</h2>
            <span className="text-[13px] text-fg3">AI viết bài, chấm câu trả lời và giải thích từ.</span>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2 font-medium">
              API key
              {first ? (
                <span className="chip bg-err-soft px-2 py-px text-[11px] text-err">Bắt buộc</span>
              ) : (
                <span className="chip bg-known-soft px-2 py-px text-[11px] text-known">
                  <Check size={11} strokeWidth={3} />
                  Đã lưu
                </span>
              )}
            </span>
            <input
              type="password"
              className={'input font-mono text-[13px] placeholder:font-sans placeholder:text-sm ' + (first ? 'border-[1.5px] border-accent' : '')}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value)
                setSaved(false)
              }}
              placeholder={first ? 'sk-…' : 'Đã lưu, mã hóa trên máy — nhập key mới để thay'}
              autoComplete="off"
            />
            <span className="text-xs text-fg3">
              {first ? 'Lấy key ở platform.deepseek.com → API keys. Chỉ lưu trên máy này, đã mã hóa.' : 'Để trống nếu không muốn đổi key.'}
            </span>
          </label>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="font-medium">Model</span>
              <input className="input font-mono text-[13px]" value={settings.model} onChange={(e) => update({ model: e.target.value })} />
            </label>
            <div className="flex flex-col gap-1.5">
              <span id="lvl" className="font-medium">
                Trình độ của bạn
              </span>
              <div role="radiogroup" aria-labelledby="lvl" className="seg grid grid-cols-4">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={settings.level === l}
                    onClick={() => update({ level: l })}
                    className="seg-btn h-[38px] text-sm"
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Giọng đọc */}
        <section className="card flex flex-col gap-[18px] p-6">
          <div className="flex flex-col gap-0.5">
            <h2 className="m-0 text-base font-bold">Giọng đọc</h2>
            <span className="text-[13px] text-fg3">Kokoro, chạy offline trên máy. Giọng Mỹ / Anh.</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4">
            {voiceField(
              <>
                Giọng A <span className="font-normal text-fg3">(và người kể)</span>
              </>,
              settings.voiceA,
              (v) => update({ voiceA: v })
            )}
            {voiceField('Giọng B', settings.voiceB, (v) => update({ voiceB: v }))}
          </div>
          {modelPct !== null ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-fg3">
                <span>{progress?.message ?? 'Đang tải model giọng đọc'}</span>
                <span className="font-mono">{Math.round(modelPct)}%</span>
              </div>
              <ProgressBar value={modelPct} height={6} />
            </div>
          ) : (
            <span className="flex gap-2 rounded-[10px] bg-surface2 px-3 py-2.5 text-[13px] text-fg2">
              <Info size={16} className="mt-0.5 flex-none" />
              Lần đầu nghe thử hoặc tạo bài, app sẽ tải model giọng đọc (~90 MB) và lưu lại để dùng offline.
            </span>
          )}
        </section>

        {/* Ôn tập */}
        <section className="card flex flex-col gap-[18px] p-6">
          <div className="flex flex-col gap-0.5">
            <h2 className="m-0 text-base font-bold">Ôn tập</h2>
            <span className="text-[13px] text-fg3">Lịch ôn theo thuật toán FSRS, giống Anki.</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="font-medium">Thẻ mới mỗi ngày</span>
              <input type="number" min={0} className="input" value={settings.newPerDay} onChange={(e) => update({ newPerDay: Number(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-medium">Thẻ ôn tối đa mỗi ngày</span>
              <input
                type="number"
                min={0}
                className="input"
                value={settings.reviewsPerDay}
                onChange={(e) => update({ reviewsPerDay: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="flex flex-col gap-2">
            <span className="flex justify-between font-medium">
              Mức nhớ mong muốn <strong className="text-base text-accent-text">{Math.round(settings.desiredRetention * 100)}%</strong>
            </span>
            <input
              type="range"
              min={0.8}
              max={0.97}
              step={0.01}
              className="w-full"
              value={settings.desiredRetention}
              onChange={(e) => update({ desiredRetention: Number(e.target.value) })}
            />
            <span className="flex justify-between text-xs text-fg3">
              <span>80% · ôn ít, dễ quên hơn</span>
              <span>97% · nhớ chắc, ôn nhiều</span>
            </span>
            <span className="text-[13px] text-fg2">
              Xác suất bạn còn nhớ một thẻ khi tới hạn ôn. 90% là mức cân bằng cho hầu hết người học (Anki cũng khuyên 90%). Mỗi từ có 2 thẻ: thẻ nghe
              trước, thẻ nói mở từ hôm sau. Ngày mới tính từ 4 giờ sáng.
            </span>
          </label>
        </section>

        <div className="flex flex-wrap items-center gap-3.5">
          <button type="button" className="btn btn-primary h-[46px] px-[22px] text-[15px]" onClick={save} disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />}
            {first ? 'Lưu và bắt đầu' : 'Lưu cài đặt'}
          </button>
          {saved && (
            <span role="status" className="flex items-center gap-1.5 font-semibold text-known">
              <Check size={16} strokeWidth={2.6} />
              Đã lưu cài đặt
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="m-0 flex items-center gap-2 rounded-[10px] bg-err-soft px-4 py-3 text-err">
            <CircleAlert size={16} className="flex-none" />
            {error}
          </p>
        )}

        {/* Chi phí */}
        {usage && !first && (
          <section className="card mt-3 flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-base font-bold">Chi phí API tháng {usage.month}</h2>
              <span className="text-[30px] font-bold tracking-[-0.02em]">≈ ${usage.costUsd.toFixed(4)}</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-2.5">
              <div className="flex flex-col rounded-[10px] bg-surface2 px-3.5 py-3">
                <span className="text-xs text-fg3">Số lần gọi</span>
                <span className="text-lg font-bold">{usage.calls}</span>
              </div>
              <div className="flex flex-col rounded-[10px] bg-surface2 px-3.5 py-3">
                <span className="text-xs text-fg3">Token vào</span>
                <span className="text-lg font-bold">
                  {formatCompact(usage.inputTokens)} <span className="text-xs font-medium text-fg3">· {cachedPct}% cache</span>
                </span>
              </div>
              <div className="flex flex-col rounded-[10px] bg-surface2 px-3.5 py-3">
                <span className="text-xs text-fg3">Token ra</span>
                <span className="text-lg font-bold">{formatCompact(usage.outputTokens)}</span>
              </div>
            </div>
            <span className="text-xs text-fg3">Ước tính theo giá giờ cao điểm của DeepSeek, có thể lệch nhẹ so với hóa đơn thật.</span>
          </section>
        )}

        {/* Dữ liệu */}
        {storage && (
          <section className="card flex flex-col gap-3.5 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-base font-bold">Dữ liệu</h2>
              <span className="text-[13px] text-fg2">
                Audio: <strong className="text-fg">{formatBytes(storage.audioBytes)}</strong>
              </span>
            </div>
            <code className="block overflow-x-auto whitespace-nowrap rounded-[10px] bg-surface2 px-3 py-2.5 font-mono text-xs text-fg2">{storage.userDataPath}</code>
            <span className="text-[13px] text-fg2">Sao lưu: tắt app rồi copy cả thư mục này sang nơi khác.</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary h-10 px-3.5 font-medium" onClick={() => api.openUserData()}>
                Mở thư mục dữ liệu
              </button>
              <button
                type="button"
                className="btn btn-secondary h-10 px-3.5 font-medium"
                onClick={() => call(api.moveUserData()).catch((e) => setError(errMsg(e)))}
                title="Ví dụ chuyển sang ổ D cho đỡ đầy ổ C"
              >
                Chuyển dữ liệu sang ổ khác…
              </button>
            </div>
            <span className="text-xs text-fg3">Khi chuyển ổ, app sẽ hỏi xác nhận rồi tự khởi động lại.</span>
          </section>
        )}

        <span className="text-xs text-fg3">
          Nguồn dữ liệu: tần suất từ <b>wordfreq</b> (Robyn Speer, CC-BY-SA 4.0) · CEFR từ <b>CEFR-J Wordlist</b> (Tono Laboratory, TUFS) và{' '}
          <b>Octanove Vocabulary Profile</b> (CC-BY-SA 4.0) · giọng đọc <b>Kokoro-82M</b> (Apache 2.0).
        </span>
      </main>
    </div>
  )
}
