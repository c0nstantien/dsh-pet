import { createMockPetServer } from "./mock-pet-server.mjs"

const mock = createMockPetServer({
  log: (r) => console.log(`[mock-pet] ${r.method} ${r.path}${Object.keys(r.query).length ? "?" + new URLSearchParams(r.query).toString() : ""} body=${r.body}`),
})
const url = await mock.listen(3080)
console.log(`[mock-pet] listening ${url} (token = 43 x 'A')，Ctrl+C 退出`)
