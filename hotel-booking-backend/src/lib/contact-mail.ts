type ContactFormPayload = {
  name: string;
  email: string;
  phone?: string;
  message: string;
};

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const resolveMailConfig = () => {
  const tenantId = process.env.MS_ENTRA_TENANT_ID;
  const clientId = process.env.MS_ENTRA_CLIENT_ID;
  const clientSecret = process.env.MS_ENTRA_CLIENT_SECRET;

  const senderAddress =
    process.env.CONTACT_MAIL_SENDER || "info@palazzopintobnb.com";
  const inboxAddress =
    process.env.CONTACT_MAIL_INBOX || "info@palazzopintobnb.com";
  const subjectPrefix =
    process.env.CONTACT_MAIL_SUBJECT_PREFIX ||
    "[PalazzoPinto][ContactForm]";
  const confirmationSubject =
    process.env.CONTACT_MAIL_CONFIRMATION_SUBJECT ||
    "Message Sent - Confirmation";

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Microsoft Entra mail credentials are missing. Configure MS_ENTRA_TENANT_ID, MS_ENTRA_CLIENT_ID and MS_ENTRA_CLIENT_SECRET."
    );
  }

  return {
    tenantId,
    clientId,
    clientSecret,
    senderAddress,
    inboxAddress,
    subjectPrefix,
    confirmationSubject,
  };
};

const getGraphAccessToken = async (
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> => {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    const message = data?.error_description || data?.error || "Unknown token error";
    throw new Error(`Unable to acquire Graph token: ${message}`);
  }

  return data.access_token as string;
};

const sendMail = async (params: {
  token: string;
  senderAddress: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}) => {
  const { token, senderAddress, to, subject, html, text, replyTo } = params;

  const body = {
    message: {
      subject,
      body: {
        contentType: "HTML",
        content: html,
      },
      toRecipients: [
        {
          emailAddress: {
            address: to,
          },
        },
      ],
      replyTo: replyTo
        ? [
            {
              emailAddress: {
                address: replyTo,
              },
            },
          ]
        : undefined,
      internetMessageHeaders: [
        {
          name: "X-Palazzo-Contact-Source",
          value: "website-contact-form",
        },
      ],
    },
    saveToSentItems: true,
  };

  const response = await fetch(
    `${GRAPH_BASE_URL}/users/${encodeURIComponent(senderAddress)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Graph sendMail failed (${response.status}): ${errorBody}`);
  }

  // Keep plain text copy for easier troubleshooting if needed.
  return { text };
};

const toAdminHtml = (payload: ContactFormPayload) => {
  const submittedAt = new Date().toISOString();
  const name = escapeHtml(payload.name);
  const email = escapeHtml(payload.email);
  const phone = payload.phone ? escapeHtml(payload.phone) : "Not provided";
  const message = escapeHtml(payload.message);

  return `
    <h2>New Website Contact Request</h2>
    <p><strong>Submitted At (UTC):</strong> ${submittedAt}</p>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone}</p>
    <p><strong>Message:</strong></p>
    <p style="white-space: pre-wrap;">${message}</p>
  `;
};

const toUserHtml = (payload: ContactFormPayload) => {
  const name = escapeHtml(payload.name);
  const message = escapeHtml(payload.message);

  return `
    <h2>We received your message</h2>
    <p>Hello ${name},</p>
    <p>Thank you for contacting Palazzo Pinto B&B. This is a confirmation that we received your request and we will reply as soon as possible.</p>
    <p><strong>Your message:</strong></p>
    <p style="white-space: pre-wrap;">${message}</p>
    <p>Kind regards,<br/>Palazzo Pinto B&B</p>
  `;
};

export const sendContactEmails = async (payload: ContactFormPayload) => {
  const {
    tenantId,
    clientId,
    clientSecret,
    senderAddress,
    inboxAddress,
    subjectPrefix,
    confirmationSubject,
  } = resolveMailConfig();

  const token = await getGraphAccessToken(tenantId, clientId, clientSecret);

  const adminSubject = `${subjectPrefix} New Request`;
  const userSubject = confirmationSubject;

  await sendMail({
    token,
    senderAddress,
    to: inboxAddress,
    subject: adminSubject,
    html: toAdminHtml(payload),
    text: payload.message,
    replyTo: payload.email,
  });

  await sendMail({
    token,
    senderAddress,
    to: payload.email,
    subject: userSubject,
    html: toUserHtml(payload),
    text: payload.message,
  });
};
