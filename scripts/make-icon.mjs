// Tạo logo app: sóng âm chạy vào rồi cuộn thành ốc tai (cochlea), chấm tím ở tâm.
// Chạy: node scripts/make-icon.mjs  → build/icon.svg, build/icon.png, build/icon.ico,
// src/renderer/src/assets/logo-mark.svg (bản không nền dùng trong giao diện)
import { mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const STROKE = 30
const r = (n) => Math.round(n * 10) / 10

// Hình vẽ trong hệ toạ độ 512x512, rồi căn giữa theo khung bao
function markPoints() {
  const cx = 300, cy = 236, R0 = 112, R1 = 58, TURNS = 1.05
  const pts = []
  // Sóng: từ trái sang, biên độ phồng ở giữa và về 0 ở hai đầu để nối mượt vào xoắn ốc
  const x0 = 70, x1 = cx, yBase = cy + R0
  for (let i = 0; i <= 160; i++) {
    const t = i / 160
    const amp = 30 * Math.sin(Math.PI * t) ** 1.6
    pts.push([x0 + (x1 - x0) * t, yBase - amp * Math.sin(2 * Math.PI * 1.5 * t)])
  }
  // Xoắn ốc: bắt đầu ở đáy vòng tròn, đi ngược chiều kim đồng hồ, bán kính nhỏ dần
  const N = 400
  for (let i = 1; i <= N; i++) {
    const t = i / N
    const th = Math.PI / 2 - t * TURNS * 2 * Math.PI
    const rad = R0 + (R1 - R0) * (1 - (1 - t) ** 1.25)
    pts.push([cx + rad * Math.cos(th), cy + rad * Math.sin(th)])
  }
  return { pts, dot: [cx, cy] }
}

function buildSvg({ background }) {
  const { pts, dot } = markPoints()
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  const pad = STROKE / 2
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad
  const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad
  const size = 512, inner = background ? 330 : 500
  const s = inner / Math.max(maxX - minX, maxY - minY)
  const ox = (size - (maxX - minX) * s) / 2 - minX * s
  const oy = (size - (maxY - minY) * s) / 2 - minY * s
  const T = ([x, y]) => `${r(x * s + ox)} ${r(y * s + oy)}`
  const d = 'M' + pts.map(T).join('L')
  const [dx, dy] = T(dot).split(' ')
  const fg = background ? '#ffffff' : 'currentColor'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
${background ? '<rect width="512" height="512" rx="116" fill="#1b1c21"/>\n' : ''}<path d="${d}" fill="none" stroke="${fg}" stroke-width="${r(STROKE * s)}" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="${dx}" cy="${dy}" r="${r(15 * s)}" fill="#8f7cff"/>
</svg>
`
}

// ICO chứa nhiều PNG (Windows Vista+ đọc được PNG trong ICO)
function toIco(pngs) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4)
  const dir = Buffer.alloc(16 * pngs.length)
  let offset = 6 + dir.length
  pngs.forEach(({ size, buf }, i) => {
    const o = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, o); dir.writeUInt8(size >= 256 ? 0 : size, o + 1)
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(buf.length, o + 8); dir.writeUInt32LE(offset, o + 12)
    offset += buf.length
  })
  return Buffer.concat([header, dir, ...pngs.map((p) => p.buf)])
}

mkdirSync('build', { recursive: true })
mkdirSync('src/renderer/src/assets', { recursive: true })
const svg = buildSvg({ background: true })
writeFileSync('build/icon.svg', svg)
writeFileSync('src/renderer/src/assets/logo-mark.svg', buildSvg({ background: false }))
await sharp(Buffer.from(svg)).resize(1024, 1024).png().toFile('build/icon.png')
const pngs = []
for (const size of [16, 24, 32, 48, 64, 128, 256]) {
  pngs.push({ size, buf: await sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png().toBuffer() })
}
writeFileSync('build/icon.ico', toIco(pngs))
console.log('Đã tạo build/icon.{svg,png,ico} và logo-mark.svg')
