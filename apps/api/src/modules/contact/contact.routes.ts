import { Router } from "express";
import { contactSchema, type ContactValues } from "@linkhub/shared";
import { prisma } from "../../lib/db";
import { fail } from "../../lib/errors";
import { noStore, sendData } from "../../lib/http";
import { sendContactEmail } from "../../lib/mailer";
import { contactLimiter } from "../../middleware/rateLimit";
import { validateBody } from "../../middleware/validate";

export const contactRouter = Router();

/**
 * Public contact/report endpoint. Messages are forwarded to the owner inbox
 * through the configured mail transport; nothing is stored and no IP address
 * is included in the message or logs.
 */
contactRouter.post(
  "/",
  contactLimiter,
  validateBody(contactSchema),
  async (req, res) => {
    noStore(res);

    const { topic, username, email, message, website } = req.body as ContactValues;

    // Honeypot: acknowledge without sending so automated submissions get no signal.
    if (website) {
      sendData(res, { message: "Thanks. Your message has been received." });
      return;
    }

    const owners = await prisma.user.findMany({
      where: { role: "owner", deletedAt: null },
      select: { email: true },
    });
    if (owners.length === 0) {
      throw fail.internal("Contact is temporarily unavailable.");
    }

    await Promise.all(
      owners.map((owner) =>
        sendContactEmail({
          to: owner.email,
          topic,
          username: username || undefined,
          reporterEmail: email || undefined,
          message,
        }),
      ),
    );

    sendData(res, { message: "Thanks. Your message has been received." });
  },
);
