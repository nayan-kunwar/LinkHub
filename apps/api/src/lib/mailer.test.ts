import { describe, expect, it, vi } from "vitest";

const { envMock } = vi.hoisted(() => ({
  envMock: {
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    EMAIL_PROVIDER: "brevo",
    EMAIL_FROM: "Link Hub <no-reply@test.local>",
    EMAIL_BREVO_API_KEY: "test-brevo-key",
    EMAIL_RESEND_API_KEY: "",
    isTest: true,
  },
}));

vi.mock("../config/env", () => ({ env: envMock }));

import { buildBrevoPayload, parseSenderAddress, sendMail } from "./mailer";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("parseSenderAddress", () => {
  it("splits a display name and address", () => {
    expect(parseSenderAddress("Link Hub <no-reply@nayankunwar.com>")).toEqual({
      name: "Link Hub",
      email: "no-reply@nayankunwar.com",
    });
  });

  it("strips quotes from a display name", () => {
    expect(parseSenderAddress('"Link Hub" <no-reply@nayankunwar.com>')).toEqual({
      name: "Link Hub",
      email: "no-reply@nayankunwar.com",
    });
  });

  it("accepts a bare address", () => {
    expect(parseSenderAddress("no-reply@nayankunwar.com")).toEqual({
      email: "no-reply@nayankunwar.com",
    });
  });
});

describe("buildBrevoPayload", () => {
  it("maps a message to Brevo's transactional payload", () => {
    expect(
      buildBrevoPayload({
        to: "user@example.com",
        subject: "Verify your email",
        text: "Click the link.",
      }),
    ).toEqual({
      sender: { name: "Link Hub", email: "no-reply@test.local" },
      to: [{ email: "user@example.com" }],
      subject: "Verify your email",
      textContent: "Click the link.",
    });
  });

  it("includes HTML only when supplied", () => {
    const payload = buildBrevoPayload({
      to: "user@example.com",
      subject: "Verify your email",
      text: "Click the link.",
      html: "<p>Click the link.</p>",
    });
    expect(payload.htmlContent).toBe("<p>Click the link.</p>");
  });

  it("adds a reply-to address when supplied", () => {
    const payload = buildBrevoPayload({
      to: "owner@example.com",
      subject: "Abuse report",
      text: "Details.",
      replyTo: "reporter@example.com",
    });
    expect(payload.replyTo).toEqual({ email: "reporter@example.com" });
  });
});

describe("sendMail with Brevo", () => {
  it("posts to the Brevo API with the key and payload", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ messageId: "<test@brevo>" }, 201));

    await sendMail({
      to: "user@example.com",
      subject: "Verify your email",
      text: "Click the link.",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["api-key"]).toBe("test-brevo-key");
    expect(JSON.parse(String(init?.body))).toEqual({
      sender: { name: "Link Hub", email: "no-reply@test.local" },
      to: [{ email: "user@example.com" }],
      subject: "Verify your email",
      textContent: "Click the link.",
    });
  });

  it("retries once after a failed request", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ message: "temporary" }, 500))
      .mockResolvedValueOnce(jsonResponse({ messageId: "<test@brevo>" }, 201));

    await sendMail({ to: "user@example.com", subject: "Hi", text: "Body" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws after two failed requests", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => jsonResponse({ message: "rejected" }, 400));

    await expect(
      sendMail({ to: "user@example.com", subject: "Hi", text: "Body" }),
    ).rejects.toThrow(/Brevo responded 400: rejected/);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
