import app from '../server/vercel.js'
export const config = { runtime: 'nodejs' }
export default async function handler(req: Request): Promise<Response> {
  return app.fetch(req)
}
