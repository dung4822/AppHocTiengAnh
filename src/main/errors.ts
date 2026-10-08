// Lỗi có thông báo tiếng Việt dễ hiểu để hiện thẳng cho người dùng.
// Các lỗi khác (lỗi lập trình) sẽ được ghi log và hiện thông báo chung.
export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserError'
  }
}

export function toUserMessage(err: unknown): string {
  if (err instanceof UserError) return err.message
  console.error(err)
  const msg = err instanceof Error ? err.message : String(err)
  return `Có lỗi không mong muốn: ${msg}`
}
