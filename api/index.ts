import type { IncomingMessage, ServerResponse } from 'node:http'
import app from '../server/vercel.js'

/**
 * Vercel Node runtime handler.
 *
 * We can't use `(req: Request) => Promise<Response>` directly: Vercel's
 * nodejs runtime expects (req, res) IncomingMessage/ServerResponse and
 * waits for `res.end()`. So we manually convert the Node request to a
 * Web Standard Request, hand it to Hono's `app.fetch()`, then stream the
 * resulting Response back through `res`.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https'
    const host = req.headers.host ?? 'localhost'
    const url = `${proto}://${host}${req.url ?? '/'}`

    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
      if (v === undefined) continue
      if (Array.isArray(v)) v.forEach(x => headers.append(k, x))
      else headers.set(k, String(v))
    }

    const method = (req.method ?? 'GET').toUpperCase()
    const init: RequestInit = { method, headers }
    if (method !== 'GET' && method !== 'HEAD') {
      // Buffer the body fully — streaming via Readable.toWeb hangs in Vercel's
      // Node runtime because Vercel-parsed bodies behave differently than raw
      // Node streams. A Uint8Array body is universally consumable.
      const chunks: Buffer[] = []
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
      }
      if (chunks.length > 0) {
        init.body = new Uint8Array(Buffer.concat(chunks))
      }
    }

    const webRes = await app.fetch(new Request(url, init))

    res.statusCode = webRes.status
    webRes.headers.forEach((value, key) => {
      // Hono may emit multiple Set-Cookie headers; preserve them all.
      if (key.toLowerCase() === 'set-cookie') {
        const existing = res.getHeader('set-cookie')
        const arr = Array.isArray(existing) ? existing : existing ? [String(existing)] : []
        res.setHeader('set-cookie', [...arr, value])
      } else {
        res.setHeader(key, value)
      }
    })

    if (webRes.body) {
      const reader = webRes.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(value)
      }
    }
    res.end()
  } catch (err) {
    console.error('[api handler] error', err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('content-type', 'text/plain')
    }
    res.end('Internal error')
  }
}
