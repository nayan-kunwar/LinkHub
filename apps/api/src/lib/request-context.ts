import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  requestId: string;
}

/**
 * Request-scoped context for structured logs that are emitted below the HTTP
 * layer (services and the nightly job). This keeps audit entries correlated
 * with the HTTP request without threading a request ID through every service.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function currentRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
