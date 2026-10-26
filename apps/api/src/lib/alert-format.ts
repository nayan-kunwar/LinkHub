export interface ServerErrorAlert {
  requestId?: string;
  method: string;
  path: string;
  status: number;
  code: string;
  userId?: string;
  error: unknown;
}

export interface ServerErrorAlertMessage {
  subject: string;
  text: string;
}

/**
 * Build the owner alert without request bodies, IP addresses, stack traces,
 * tokens, email addresses, or the original error message. The request ID is
 * the correlation key for the redacted Render log entry.
 */
export function buildServerErrorAlert(
  input: ServerErrorAlert,
): ServerErrorAlertMessage {
  const errorName = input.error instanceof Error ? input.error.name : "UnknownError";
  return {
    subject: `[Link Hub] API ${input.status} on ${input.path}`,
    text: [
      `An API request failed at ${new Date().toISOString()}.`,
      "",
      `Request ID: ${input.requestId ?? "unknown"}`,
      `Method: ${input.method}`,
      `Path: ${input.path}`,
      `Status: ${input.status}`,
      `Code: ${input.code}`,
      `Error: ${errorName}`,
      ...(input.userId ? [`User ID: ${input.userId}`] : []),
      "",
      "Search the Render service logs for the request ID to see the stack trace.",
      "Alerts are throttled to one per 15 minutes per API instance.",
    ].join("\n"),
  };
}
