// Các hàm định dạng hiển thị dùng chung giữa các trang

// SQLite lưu giờ UTC dạng "2026-10-08 03:00:00" → Date theo giờ máy
export function parseSqlite(sqliteUtc: string): Date {
  return new Date(sqliteUtc.replace(' ', 'T') + 'Z')
}

const pad = (n: number): string => String(n).padStart(2, '0')

// "Hôm nay 20:14" · "Hôm qua 21:02" · "06/10 19:40" · "06/10/2025 19:40" (khác năm)
export function formatRelative(sqliteUtc: string): string {
  const d = parseSqlite(sqliteUtc)
  const now = new Date()
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const startOfDay = (x: Date): number => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (diffDays === 0) return `Hôm nay ${time}`
  if (diffDays === 1) return `Hôm qua ${time}`
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
  return d.getFullYear() === now.getFullYear() ? `${date} ${time}` : `${date}/${d.getFullYear()} ${time}`
}

// "Thứ Năm, 8 tháng 10"
export function formatToday(): string {
  const s = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Thời lượng nghe: < 1 phút hiện giây ("19 giây")
export function formatMinutes(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} giây`
  const m = Math.round(sec / 60)
  return m < 60 ? `${m} phút` : `${Math.floor(m / 60)} giờ ${m % 60 ? `${m % 60} phút` : ''}`.trim()
}

export function formatHours(sec: number): string {
  const h = sec / 3600
  return h < 1 ? formatMinutes(sec) : `${h.toFixed(1).replace('.', ',').replace(',0', '')} giờ`
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1).replace('.0', '')} MB`
}

// Số lớn dạng gọn: 412000 → "412k"
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

// Nhãn tần suất (tính ở main) → số vạch sáng trên FreqMeter (1–4)
export function freqLevel(label: string): number {
  if (label.startsWith('Rất phổ biến')) return 4
  if (label.startsWith('Phổ biến')) return 3
  if (label.startsWith('Ít gặp')) return 2
  return 1
}

// Ngày "2026-10-08" → nhãn thứ ngắn: T2…T7, CN
export function weekdayShort(day: string): string {
  const d = new Date(day + 'T00:00:00')
  const w = d.getDay()
  return w === 0 ? 'CN' : `T${w + 1}`
}
