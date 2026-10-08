import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { getDb } from '../db'
import { audioRoot, userDataDir } from '../paths'
import type { StorageInfo, UsageSummary } from '@shared/types'

// Chi phí API của tháng hiện tại (theo giờ máy), tổng hợp từ bảng api_usage
export function getMonthUsage(): UsageSummary {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS calls, COALESCE(SUM(input_tokens),0) AS input, COALESCE(SUM(cached_tokens),0) AS cached,
              COALESCE(SUM(output_tokens),0) AS output, COALESCE(SUM(est_cost_usd),0) AS cost
       FROM api_usage WHERE strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')`
    )
    .get() as { calls: number; input: number; cached: number; output: number; cost: number }
  const now = new Date()
  return {
    month: `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
    calls: row.calls,
    inputTokens: row.input,
    cachedTokens: row.cached,
    outputTokens: row.output,
    costUsd: row.cost
  }
}

function dirSize(dir: string): number {
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    total += entry.isDirectory() ? dirSize(p) : statSync(p).size
  }
  return total
}

export function getStorageInfo(): StorageInfo {
  return { audioBytes: dirSize(audioRoot()), userDataPath: userDataDir() }
}
