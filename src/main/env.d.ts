// Cho TypeScript biết: import file '*.sql?raw' sẽ nhận được một chuỗi
declare module '*.sql?raw' {
  const content: string
  export default content
}
