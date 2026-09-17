import type { Instrumentation } from "next";

/**
 * Server-side render and action failures: the browser only gets a digest in production, so the real message is
 * captured here and stored in the error log with the path, next to the client's report (same digest).
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { logError } = await import("@/lib/ops/log");
    const e = err as Error & { digest?: string };
    await logError(`server.${context.routeType}`, e, { meta: { path: request.path, method: request.method, digest: e.digest ?? null, route: context.routePath, kind: context.renderSource ?? context.routerKind } });
  } catch {
    /* logging must never throw */
  }
};
