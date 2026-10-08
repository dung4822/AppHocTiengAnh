import type { AppApi } from '../shared/types'

// Khai báo cho TypeScript ở renderer biết window.api có kiểu AppApi
declare global {
  interface Window {
    api: AppApi
  }
}

export {}
