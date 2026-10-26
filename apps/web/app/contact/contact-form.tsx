"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  contactSchema,
  type ContactTopic,
  type ContactValues,
} from "@linkhub/shared";
import { Button } from "@/components/ui/button";
import {
  FieldError,
  FieldHint,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";

const TOPIC_OPTIONS: Array<{ value: ContactTopic; label: string }> = [
  { value: "abuse", label: "Report abuse" },
  { value: "privacy", label: "Privacy request" },
  { value: "support", label: "Account support" },
  { value: "other", label: "Something else" },
];

type FieldErrors = Partial<Record<keyof ContactValues, string>>;

export function ContactForm({
  defaultTopic,
  username,
}: {
  defaultTopic: ContactTopic;
  username: string;
}) {
  const [topic, setTopic] = useState<ContactTopic>(defaultTopic);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setErrors({});

    const parsed = contactSchema.safeParse({
      topic,
      username,
      email,
      message,
      website,
    });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof ContactValues | undefined;
        if (field && !nextErrors[field]) nextErrors[field] = issue.message;
      }
      setErrors(nextErrors);
      setFormError("Check the highlighted fields and try again.");
      return;
    }

    setLoading(true);
    try {
      await api.contact.send(parsed.data);
      setSent(true);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFormError(
          caught.status === 429
            ? "Too many messages. Wait a few minutes and try again."
            : caught.message,
        );
      } else {
        setFormError("Could not send your message. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="mt-8" role="status" aria-live="polite">
        <span className="flex size-12 items-center justify-center rounded-full bg-green-100 text-green-700">
          <CheckCircle2 aria-hidden="true" className="size-6" />
        </span>
        <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-zinc-950">
          Message sent
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Thanks for getting in touch. Your message is in the owner inbox.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-6"
          onClick={() => {
            setSent(false);
            setMessage("");
            setErrors({});
            setFormError("");
          }}
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
      {formError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
        >
          {formError}
        </div>
      ) : null}

      {username ? (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-violet-900">
          About{" "}
          <Link
            href={`/${username}`}
            className="font-semibold underline underline-offset-2"
          >
            @{username}
          </Link>
          .
        </p>
      ) : null}

      <div>
        <Label htmlFor="contact-topic">What is this about?</Label>
        <Select
          id="contact-topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value as ContactTopic)}
          aria-invalid={errors.topic ? true : undefined}
          aria-describedby={errors.topic ? "contact-topic-error" : undefined}
        >
          {TOPIC_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <FieldError id="contact-topic-error">{errors.topic}</FieldError>
      </div>

      <div>
        <Label htmlFor="contact-email">
          Your email <span className="font-normal text-zinc-500">(optional)</span>
        </Label>
        <Input
          id="contact-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "contact-email-error" : "contact-email-hint"}
        />
        <FieldHint id="contact-email-hint">
          Add an email if you would like a reply. It is only used for this message.
        </FieldHint>
        <FieldError id="contact-email-error">{errors.email}</FieldError>
      </div>

      <div>
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={2000}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={
            errors.message
              ? "contact-message-hint contact-message-error"
              : "contact-message-hint"
          }
          placeholder={
            topic === "abuse"
              ? "Describe the problem and include any links or screenshots that help."
              : "How can we help?"
          }
        />
        <FieldHint id="contact-message-hint">
          {message.length}/2000 characters. Do not include passwords or other secrets.
        </FieldHint>
        <FieldError id="contact-message-error">{errors.message}</FieldError>
      </div>

      {/* Honeypot: hidden from people and assistive technology. */}
      <div aria-hidden="true" className="hidden">
        <Label htmlFor="contact-website">Website</Label>
        <Input
          id="contact-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? "Sending…" : "Send message"}
      </Button>

      <p className="text-xs leading-relaxed text-zinc-500">
        We do not store your IP address. Messages are delivered by email to the owner inbox.
      </p>
    </form>
  );
}
