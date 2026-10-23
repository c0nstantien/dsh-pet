import { createServer } from "node:http"

/** 模拟 dsh-pet-standalone 的 P1 相关路由：token 校验 + 请求记录。默认 token 为 43 位（对齐真实格式）。 */
export function createMockPetServer({ token = "A".repeat(43), log } = {}) {
  const requests = []
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1")
    const record = {
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      token: req.headers["x-dsh-pet-token"] ?? null,
      body: "",
    }
    req.on("data", (chunk) => { record.body += chunk })
    req.on("end", () => {
      requests.push(record)
      if (log) log(record)
      const json = (status, payload) => {
        res.writeHead(status, { "content-type": "application/json" })
        res.end(JSON.stringify(payload))
      }
      if (url.pathname === "/health") return json(200, { name: "dsh-pet-standalone" })
      if (record.token !== token) return json(403, { error: "请从桌宠菜单重新打开设置" })
      if (url.pathname === "/dsh-pet-7340/work-status" && req.method === "POST") return json(200, { ok: true })
      if (url.pathname === "/dsh-pet-7340/work-status" && req.method === "DELETE") { res.writeHead(204); return res.end() }
      res.writeHead(404, { "content-type": "text/plain" })
      res.end("mock: no route " + url.pathname)
    })
  })
  return {
    server,
    requests,
    listen: (port = 0) => new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`))),
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}
