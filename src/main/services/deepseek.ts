import type { z } from 'zod'
import { getDb } from '../db'
import { UserError } from '../errors'
import { DEEPSEEK_BASE_URL, PRICE_PER_MILLION } from '../config'
import { getApiKey, getSettings } from './settingsService'

// Gọi DeepSeek theo định dạng OpenAI bằng fetch thuần.
// Đã kiểm tra docs (https://api-docs.deepseek.com, 10/2026):
//  - base URL: https://api.deepseek.com, endpoint /chat/completions
//  - JSON output: response_format = { type: 'json_object' } (prompt phải có chữ "json")
//  - Tắt thinking mode: thinking = { type: 'disabled' } (mặc định model bật thinking)
//  - usage có prompt_cache_hit_tokens / prompt_cache_miss_tokens để tính tiền cache

export type Purpose = 'lesson' | 'rewrite' | 'grading' | 'lookup' | 'grammar' | 'annotate' | 'rescue' | 'units'

export interface CallOptions {
  purpose: Purpose
  system: string
  user: string
  temperature: number
  maxTokens: number
  timeoutMs?: number // mặc định 3 phút; câu trả lời dài (ngữ pháp chi tiết) cần lâu hơn
}

interface DeepSeekResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    prompt_cache_hit_tokens?: number
    prompt_cache_miss_tokens?: number
  }
  error?: { message?: string }
}

// Gọi API rồi parse + validate JSON bằng zod. JSON lỗi thì thử lại đúng 1 lần.
// <T> ở đây giống generic method trong C#: callJson<LessonJson>(...)
export async function callJson<T>(opts: CallOptions, schema: z.ZodType<T>): Promise<T> {
  let lastError = ''
  for (let attempt = 1; attempt <= 2; attempt++) {
    const content = await callRaw(opts)
    try {
      const parsed = JSON.parse(content)
      const result = schema.safeParse(parsed)
      if (result.success) return result.data
      lastError = result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')
    } catch {
      lastError = 'không phải JSON hợp lệ'
    }
    console.warn(`[deepseek] ${opts.purpose}: JSON lỗi lần ${attempt} (${lastError})`)
  }
  throw new UserError(`AI trả về dữ liệu không đúng định dạng (đã thử lại 1 lần). Bạn bấm thử lại nhé. Chi tiết: ${lastError}`)
}

async function callRaw(opts: CallOptions): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) throw new UserError('Chưa có API key DeepSeek. Vào trang Cài đặt để nhập key.')
  const model = getSettings().model

  let res: Response
  try {
    res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        // System cố định đứng đầu, dữ liệu thay đổi ở cuối → tận dụng cache prefix của DeepSeek
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user }
        ],
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        stream: false
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 180_000)
    })
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new UserError('DeepSeek phản hồi quá lâu. Thử lại sau nhé.')
    }
    throw new UserError('Không kết nối được tới DeepSeek. Kiểm tra lại mạng Internet rồi thử lại.')
  }

  const body = (await res.json().catch(() => ({}))) as DeepSeekResponse
  if (!res.ok) throw new UserError(httpErrorMessage(res.status, body.error?.message))

  if (body.usage) recordUsage(opts.purpose, model, body.usage)

  const choice = body.choices?.[0]
  if (choice?.finish_reason === 'length') {
    console.warn(`[deepseek] ${opts.purpose}: bị cắt do max_tokens`)
  }
  const content = choice?.message?.content ?? ''
  // Docs có ghi: đôi khi API trả nội dung rỗng ở JSON mode → coi như JSON lỗi để thử lại
  return content.trim() === '' ? '{}' : content
}

function httpErrorMessage(status: number, detail?: string): string {
  switch (status) {
    case 401:
      return 'API key DeepSeek không đúng. Vào Cài đặt để nhập lại.'
    case 402:
      return 'Tài khoản DeepSeek đã hết tiền. Nạp thêm tại platform.deepseek.com rồi thử lại.'
    case 422:
    case 400:
      return `DeepSeek từ chối yêu cầu (${status}). Kiểm tra tên model trong Cài đặt. ${detail ?? ''}`.trim()
    case 429:
      return 'Đang gửi yêu cầu quá nhanh, DeepSeek tạm chặn. Đợi một chút rồi thử lại.'
    case 500:
    case 503:
      return 'Máy chủ DeepSeek đang bận hoặc lỗi. Thử lại sau ít phút.'
    default:
      return `DeepSeek báo lỗi ${status}. ${detail ?? ''}`.trim()
  }
}

function recordUsage(purpose: Purpose, model: string, u: NonNullable<DeepSeekResponse['usage']>): void {
  const cached = u.prompt_cache_hit_tokens ?? 0
  const miss = u.prompt_cache_miss_tokens ?? u.prompt_tokens - cached
  const cost =
    (cached * PRICE_PER_MILLION.inputCacheHit +
      miss * PRICE_PER_MILLION.inputCacheMiss +
      u.completion_tokens * PRICE_PER_MILLION.output) /
    1_000_000
  getDb()
    .prepare(
      `INSERT INTO api_usage (purpose, model, input_tokens, cached_tokens, output_tokens, est_cost_usd)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(purpose, model, u.prompt_tokens, cached, u.completion_tokens, cost)
  console.log(
    `[deepseek] ${purpose}: in=${u.prompt_tokens} (cache ${cached}) out=${u.completion_tokens} ≈ $${cost.toFixed(5)}`
  )
}
