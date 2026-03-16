type ContactFormPayload = {
  name: string;
  email: string;
  phone?: string;
  message: string;
};

type BookingRequestPayload = {
  reservationNumber: string;
  hotelName: string;
  roomName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  checkIn: string;
  checkOut: string;
  adultCount: number;
  childCount: number;
  nights: number;
  totalCost: number;
  arrivalTime: "Morning" | "Afternoon" | "Evening" | "Night";
  specialRequests?: string;
  coupon?: string;
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

const toBookingAdminHtml = (payload: BookingRequestPayload) => {
  const submittedAt = new Date().toISOString();

  return `
    <h2>New Booking Request (Technical Copy)</h2>
    <p><strong>Submitted At (UTC):</strong> ${submittedAt}</p>
    <p><strong>Reservation Number:</strong> ${escapeHtml(payload.reservationNumber)}</p>
    <hr/>
    <p><strong>Property:</strong> ${escapeHtml(payload.hotelName)}</p>
    <p><strong>Room:</strong> ${escapeHtml(payload.roomName)}</p>
    <p><strong>Guest:</strong> ${escapeHtml(payload.firstName)} ${escapeHtml(payload.lastName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(payload.phone)}</p>
    <p><strong>Location:</strong> ${escapeHtml(payload.city)}, ${escapeHtml(payload.country)}</p>
    <p><strong>Check-In:</strong> ${escapeHtml(payload.checkIn)}</p>
    <p><strong>Check-Out:</strong> ${escapeHtml(payload.checkOut)}</p>
    <p><strong>Nights:</strong> ${payload.nights}</p>
    <p><strong>Guests:</strong> ${payload.adultCount} adults, ${payload.childCount} children</p>
    <p><strong>Arrival Time:</strong> ${escapeHtml(payload.arrivalTime)}</p>
    <p><strong>Total Cost (quoted):</strong> EUR ${payload.totalCost}</p>
    <p><strong>Coupon:</strong> ${payload.coupon ? escapeHtml(payload.coupon) : "Not provided"}</p>
    <p><strong>Special Requests:</strong></p>
    <p style="white-space: pre-wrap;">${payload.specialRequests ? escapeHtml(payload.specialRequests) : "None"}</p>
  `;
};

const toBookingUserHtml = (payload: BookingRequestPayload) => {
  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2 style="margin-bottom: 8px;">Thank You For Your Booking Request</h2>
      <p>Hello ${escapeHtml(payload.firstName)},</p>
      <p>
        We have received your booking request for <strong>${escapeHtml(payload.hotelName)}</strong>
        and our team will contact you shortly to confirm availability and final details.
      </p>
      <p><strong>Booking Reference:</strong> ${escapeHtml(payload.reservationNumber)}</p>
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin: 16px 0;">
        <p><strong>Room:</strong> ${escapeHtml(payload.roomName)}</p>
        <p><strong>Check-In:</strong> ${escapeHtml(payload.checkIn)}</p>
        <p><strong>Check-Out:</strong> ${escapeHtml(payload.checkOut)}</p>
        <p><strong>Guests:</strong> ${payload.adultCount} adults, ${payload.childCount} children</p>
        <p><strong>Arrival:</strong> ${escapeHtml(payload.arrivalTime)}</p>
        <p><strong>Estimated Total:</strong> EUR ${payload.totalCost}</p>
      </div>
      <p>
        Kind regards,<br/>
        Palazzo Pinto B&B<br/>
        Reservations Team
      </p>
    </div>
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

export const sendBookingRequestEmails = async (payload: BookingRequestPayload) => {
  const {
    tenantId,
    clientId,
    clientSecret,
    senderAddress,
    inboxAddress,
    subjectPrefix,
  } = resolveMailConfig();

  const token = await getGraphAccessToken(tenantId, clientId, clientSecret);

  await sendMail({
    token,
    senderAddress,
    to: inboxAddress,
    subject: `${subjectPrefix} Booking Request - ${payload.hotelName} (${payload.reservationNumber})`,
    html: toBookingAdminHtml(payload),
    text: `Booking request from ${payload.firstName} ${payload.lastName} for ${payload.hotelName}`,
    replyTo: payload.email,
  });

  await sendMail({
    token,
    senderAddress,
    to: payload.email,
    subject: `Booking Request Received - ${payload.hotelName} (${payload.reservationNumber})`,
    html: toBookingUserHtml(payload),
    text: `Your booking request for ${payload.hotelName} has been received.`,
  });
};
