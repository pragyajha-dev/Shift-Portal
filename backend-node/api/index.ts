import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildApp } from '../src/app'

// Built once per cold start and reused across warm invocations of the same
// serverless instance — avoids re-running the (idempotent) admin-seed check
// and rebuilding the Express app on every request.
const appPromise = buildApp()

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await appPromise
  app(req, res)
}
