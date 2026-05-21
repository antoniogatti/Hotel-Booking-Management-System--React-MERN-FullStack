type ContactFormPayload = {
  name: string;
  email: string;
  phone?: string;
  message: string;
};

type BookingRequestPayload = {
  bookingId?: string;
  reservationNumber: string;
  hotelName: string;
  roomName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  nationality: string;
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

type BookingDecisionPayload = {
  bookingId?: string;
  reservationNumber: string;
  hotelName: string;
  roomName: string;
  firstName: string;
  lastName: string;
  email: string;
  checkIn: string;
  checkOut: string;
  decision: "confirmed" | "rejected";
  reason?: string;
};

type CheckInNotificationPayload = {
  bookingId?: string;
  reservationNumber: string;
  hotelName: string;
  roomName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  checkIn: string;
  checkOut: string;
  arrivalTime: string;
  nationality: string;
  bookingChannel: string;
  paymentDetails: string;
  cityTax: number;
  documentCount: number;
  specialNotes?: string;
  breakfast?: {
    time?: string;
    savouryCount?: number;
    sweetCount?: number;
  };
};

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const TECH_SUBJECT_PREFIX = "[B&B System]";
const BRAND_NAME = "Palazzo Pinto B&B";
const BRAND_WEBSITE_URL = "https://www.palazzopintobnb.com";
const BRAND_LOGO_URL = `${BRAND_WEBSITE_URL}/common/LOGOPAYOFF_PalazzoPinto.png`;
const BRAND_HERO_IMAGE_URL = `${BRAND_WEBSITE_URL}/home/sildeshow/Z62_1095-scaled.jpg`;
const BRAND_PRIMARY_COLOR = "#2b4463";
const BRAND_ACCENT_COLOR = "#ea836c";
const BRAND_SURFACE_COLOR = "#f7f3ed";
const PROPERTY_DISPLAY_NAME = "Palazzo Pinto B&B Brindisi - Italy";
const PROPERTY_GOOGLE_MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=Palazzo%20Pinto%20B%26B%2C%20Via%20Masaniello%2C%2030%2072100%20Brindisi";
const buildBookingDetailsUrl = (bookingId?: string) =>
  bookingId ? `${BRAND_WEBSITE_URL}/booking/${encodeURIComponent(bookingId)}` : "";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatFriendlyDate = (value: string | Date) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

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
  const submittedAt = formatFriendlyDate(new Date());
  const name = escapeHtml(payload.name);
  const email = escapeHtml(payload.email);
  const phone = payload.phone ? escapeHtml(payload.phone) : "Not provided";
  const message = escapeHtml(payload.message);

  return `
    <h2>New Website Contact Request</h2>
    <p><strong>Submitted On:</strong> ${submittedAt}</p>
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
  const submittedAt = formatFriendlyDate(new Date());
  const bookingDetailsUrl = buildBookingDetailsUrl(payload.bookingId);

  return `
    <h2>New Booking Request (Technical Copy)</h2>
    <p><strong>Submitted On:</strong> ${submittedAt}</p>
    <p><strong>Reservation Number:</strong> ${escapeHtml(payload.reservationNumber)}</p>
    <hr/>
    <p><strong>Property:</strong> ${escapeHtml(payload.hotelName)}</p>
    <p><strong>Room:</strong> ${escapeHtml(payload.roomName)}</p>
    <p><strong>Guest:</strong> ${escapeHtml(payload.firstName)} ${escapeHtml(payload.lastName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(payload.phone)}</p>
    <p><strong>Location:</strong> ${escapeHtml(payload.city)}, ${escapeHtml(payload.country)}</p>
    <p><strong>Nationality:</strong> ${escapeHtml(payload.nationality)}</p>
    <p><strong>Check-In:</strong> ${escapeHtml(formatFriendlyDate(payload.checkIn))}</p>
    <p><strong>Check-Out:</strong> ${escapeHtml(formatFriendlyDate(payload.checkOut))}</p>
    <p><strong>Nights:</strong> ${payload.nights}</p>
    <p><strong>Guests:</strong> ${payload.adultCount} adults, ${payload.childCount} children</p>
    <p><strong>Arrival Time:</strong> ${escapeHtml(payload.arrivalTime)}</p>
    <p><strong>Total Cost (quoted):</strong> EUR ${payload.totalCost}</p>
    <p><strong>Coupon:</strong> ${payload.coupon ? escapeHtml(payload.coupon) : "Not provided"}</p>
    ${
      bookingDetailsUrl
        ? `<p><strong>Booking Details:</strong> <a href="${bookingDetailsUrl}" target="_blank" rel="noopener noreferrer">Open in backoffice</a></p>`
        : ""
    }
    <p><strong>Special Requests:</strong></p>
    <p style="white-space: pre-wrap;">${payload.specialRequests ? escapeHtml(payload.specialRequests) : "None"}</p>
  `;
};

const toBookingUserHtml = (payload: BookingRequestPayload) => {
  return `
    <div style="margin:0;padding:24px;background:${BRAND_SURFACE_COLOR};font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.5;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        <div style="padding:16px 16px 0;">
          <div style="background:linear-gradient(135deg,#f8efe6 0%,#eef3f8 100%);border:2px solid #e6d8c9;border-radius:16px;padding:10px;">
            <img src="${BRAND_HERO_IMAGE_URL}" alt="Palazzo Pinto Brindisi" style="width:100%;height:auto;display:block;border:0;border-radius:10px;" />
          </div>
        </div>
        <div style="padding:22px 24px;">
          <div style="text-align:center;margin:0 0 10px;">
            <a href="${BRAND_WEBSITE_URL}" target="_blank" rel="noopener noreferrer">
              <img src="${BRAND_LOGO_URL}" alt="${BRAND_NAME}" style="max-width:220px;width:100%;height:auto;border:0;" />
            </a>
          </div>
          <h2 style="margin:0 0 10px;color:${BRAND_PRIMARY_COLOR};font-size:31px;line-height:1.15;font-family:Georgia,'Times New Roman',serif;">Thank You For Your Booking Request</h2>
          <p style="margin:0 0 10px;">Hello ${escapeHtml(payload.firstName)},</p>
          <p style="margin:0 0 12px;">We have received your booking request for <strong>${escapeHtml(payload.hotelName)}</strong> and our team will contact you shortly to confirm availability and final details.</p>
          <p style="margin:0 0 14px;"><strong>Booking Reference:</strong> ${escapeHtml(payload.reservationNumber)}</p>
          <div style="background:#fcfcfd;border:1px solid #e7ebf0;border-radius:10px;padding:14px 16px;">
            <p style="margin:0 0 7px;"><strong>Property:</strong> <a href="${PROPERTY_GOOGLE_MAPS_URL}" target="_blank" rel="noopener noreferrer" style="color:${BRAND_PRIMARY_COLOR};">${escapeHtml(PROPERTY_DISPLAY_NAME)}</a></p>
            <p style="margin:0 0 7px;"><strong>Room:</strong> ${escapeHtml(payload.roomName)}</p>
            <p style="margin:0 0 7px;"><strong>Check-In:</strong> ${escapeHtml(formatFriendlyDate(payload.checkIn))}</p>
            <p style="margin:0 0 7px;"><strong>Check-Out:</strong> ${escapeHtml(formatFriendlyDate(payload.checkOut))}</p>
            <p style="margin:0 0 7px;"><strong>Guests:</strong> ${payload.adultCount} adults, ${payload.childCount} children</p>
            <p style="margin:0 0 7px;"><strong>Nationality:</strong> ${escapeHtml(payload.nationality)}</p>
            <p style="margin:0 0 7px;"><strong>Arrival:</strong> ${escapeHtml(payload.arrivalTime)}</p>
            <p style="margin:0;"><strong>Estimated Total:</strong> EUR ${payload.totalCost}</p>
          </div>
          <div style="margin-top:18px;text-align:center;">
            <a href="${PROPERTY_GOOGLE_MAPS_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${BRAND_ACCENT_COLOR};color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:999px;font-weight:700;">View Property On Google Maps</a>
          </div>
          <p style="margin:20px 0 0;">Kind regards,<br/>${BRAND_NAME}<br/>Reservations Team</p>
        </div>
      </div>
    </div>
  `;
};

const toBookingDecisionAdminHtml = (payload: BookingDecisionPayload) => {
  const submittedAt = formatFriendlyDate(new Date());
  const decisionLabel = payload.decision === "confirmed" ? "CONFIRMED" : "REJECTED";
  const bookingDetailsUrl = buildBookingDetailsUrl(payload.bookingId);

  return `
    <h2>Booking Request ${decisionLabel}</h2>
    <p><strong>Decision On:</strong> ${submittedAt}</p>
    <p><strong>Reservation Number:</strong> ${escapeHtml(payload.reservationNumber)}</p>
    <hr/>
    <p><strong>Property:</strong> ${escapeHtml(payload.hotelName)}</p>
    <p><strong>Room:</strong> ${escapeHtml(payload.roomName)}</p>
    <p><strong>Guest:</strong> ${escapeHtml(payload.firstName)} ${escapeHtml(payload.lastName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
    <p><strong>Check-In:</strong> ${escapeHtml(formatFriendlyDate(payload.checkIn))}</p>
    <p><strong>Check-Out:</strong> ${escapeHtml(formatFriendlyDate(payload.checkOut))}</p>
    <p><strong>Decision:</strong> ${decisionLabel}</p>
    ${
      bookingDetailsUrl
        ? `<p><strong>Booking Details:</strong> <a href="${bookingDetailsUrl}" target="_blank" rel="noopener noreferrer">Open in backoffice</a></p>`
        : ""
    }
    <p><strong>Reason:</strong> ${payload.reason ? escapeHtml(payload.reason) : "Not provided"}</p>
  `;
};

const toBookingDecisionUserHtml = (payload: BookingDecisionPayload) => {
  const isConfirmed = payload.decision === "confirmed";
  const title = isConfirmed ? "Your Booking Request Is Confirmed" : "Update On Your Booking Request";
  const intro = isConfirmed
    ? "Great news. Your booking request has been confirmed by our team."
    : "Thank you for your request. At this time we are unable to confirm it.";

  return `
    <div style="margin:0;padding:24px;background:${BRAND_SURFACE_COLOR};font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.5;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        <div style="padding:16px 16px 0;">
          <div style="background:linear-gradient(135deg,#f8efe6 0%,#eef3f8 100%);border:2px solid #e6d8c9;border-radius:16px;padding:10px;">
            <img src="${BRAND_HERO_IMAGE_URL}" alt="Palazzo Pinto Brindisi" style="width:100%;height:auto;display:block;border:0;border-radius:10px;" />
          </div>
        </div>
        <div style="padding:22px 24px;">
          <div style="text-align:center;margin:0 0 10px;">
            <a href="${BRAND_WEBSITE_URL}" target="_blank" rel="noopener noreferrer">
              <img src="${BRAND_LOGO_URL}" alt="${BRAND_NAME}" style="max-width:220px;width:100%;height:auto;border:0;" />
            </a>
          </div>
          <h2 style="margin:0 0 10px;color:${BRAND_PRIMARY_COLOR};font-size:31px;line-height:1.15;font-family:Georgia,'Times New Roman',serif;">${title}</h2>
          <p style="margin:0 0 10px;">Hello ${escapeHtml(payload.firstName)},</p>
          <p style="margin:0 0 12px;">${intro}</p>
          <p style="margin:0 0 14px;"><strong>Booking Reference:</strong> ${escapeHtml(payload.reservationNumber)}</p>
          <div style="background:#fcfcfd;border:1px solid #e7ebf0;border-radius:10px;padding:14px 16px;">
            <p style="margin:0 0 7px;"><strong>Property:</strong> <a href="${PROPERTY_GOOGLE_MAPS_URL}" target="_blank" rel="noopener noreferrer" style="color:${BRAND_PRIMARY_COLOR};">${escapeHtml(PROPERTY_DISPLAY_NAME)}</a></p>
            <p style="margin:0 0 7px;"><strong>Room:</strong> ${escapeHtml(payload.roomName)}</p>
            <p style="margin:0 0 7px;"><strong>Check-In:</strong> ${escapeHtml(formatFriendlyDate(payload.checkIn))}</p>
            <p style="margin:0 0 7px;"><strong>Check-Out:</strong> ${escapeHtml(formatFriendlyDate(payload.checkOut))}</p>
            <p style="margin:0;"><strong>Status:</strong> ${isConfirmed ? "Booked" : "Rejected"}</p>
          </div>
          ${payload.reason ? `<p style="margin:14px 0 0;"><strong>Note:</strong> ${escapeHtml(payload.reason)}</p>` : ""}
          <div style="margin-top:18px;text-align:center;">
            <a href="${PROPERTY_GOOGLE_MAPS_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${BRAND_ACCENT_COLOR};color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:999px;font-weight:700;">Open Property Location</a>
          </div>
          <p style="margin:20px 0 0;">Kind regards,<br/>${BRAND_NAME}<br/>Reservations Team</p>
        </div>
      </div>
    </div>
  `;
};

const toCheckInAdminHtml = (payload: CheckInNotificationPayload) => {
  const submittedAt = formatFriendlyDate(new Date());
  const bookingDetailsUrl = buildBookingDetailsUrl(payload.bookingId);

  return `
    <h2>Guest Check-in Completed</h2>
    <p><strong>Saved On:</strong> ${submittedAt}</p>
    <p><strong>Reservation Number:</strong> ${escapeHtml(payload.reservationNumber)}</p>
    <hr/>
    <p><strong>Property:</strong> ${escapeHtml(payload.hotelName)}</p>
    <p><strong>Room:</strong> ${escapeHtml(payload.roomName)}</p>
    <p><strong>Guest:</strong> ${escapeHtml(payload.firstName)} ${escapeHtml(payload.lastName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
    <p><strong>Phone:</strong> ${payload.phone ? escapeHtml(payload.phone) : "Not provided"}</p>
    <p><strong>Check-In:</strong> ${escapeHtml(formatFriendlyDate(payload.checkIn))}</p>
    <p><strong>Check-Out:</strong> ${escapeHtml(formatFriendlyDate(payload.checkOut))}</p>
    <p><strong>Arrival Time:</strong> ${escapeHtml(payload.arrivalTime)}</p>
    <p><strong>Nationality:</strong> ${escapeHtml(payload.nationality)}</p>
    <p><strong>Booking Channel:</strong> ${escapeHtml(payload.bookingChannel)}</p>
    <p><strong>Payment Details:</strong> ${escapeHtml(payload.paymentDetails)}</p>
    <p><strong>City Tax:</strong> EUR ${payload.cityTax.toFixed(2)}</p>
    <p><strong>Uploaded Documents:</strong> ${payload.documentCount}</p>
    ${
      bookingDetailsUrl
        ? `<p><strong>Booking Details:</strong> <a href="${bookingDetailsUrl}" target="_blank" rel="noopener noreferrer">Open in backoffice</a></p>`
        : ""
    }
    <p><strong>Breakfast:</strong> ${payload.breakfast && ((payload.breakfast.savouryCount || 0) + (payload.breakfast.sweetCount || 0) > 0)
      ? `${escapeHtml(payload.breakfast.time || "Time not set")} | Savoury: ${payload.breakfast.savouryCount || 0}, Sweet: ${payload.breakfast.sweetCount || 0}`
      : "None"}</p>
    <p><strong>Special Notes:</strong></p>
    <p style="white-space: pre-wrap;">${payload.specialNotes ? escapeHtml(payload.specialNotes) : "None"}</p>
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
    subject: `${TECH_SUBJECT_PREFIX} Contact Request | ${payload.name} - ${payload.email}`,
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
    subject: `${TECH_SUBJECT_PREFIX} Requested | ${payload.roomName} - ${payload.reservationNumber}`,
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

export const sendBookingDecisionEmails = async (
  payload: BookingDecisionPayload
) => {
  const {
    tenantId,
    clientId,
    clientSecret,
    senderAddress,
    inboxAddress,
    subjectPrefix,
  } = resolveMailConfig();

  const token = await getGraphAccessToken(tenantId, clientId, clientSecret);
  const decisionLabel = payload.decision === "confirmed" ? "Confirmed" : "Rejected";

  await sendMail({
    token,
    senderAddress,
    to: inboxAddress,
    subject: `${TECH_SUBJECT_PREFIX} ${decisionLabel} | ${payload.roomName} - ${payload.reservationNumber}`,
    html: toBookingDecisionAdminHtml(payload),
    text: `Booking ${decisionLabel.toLowerCase()} for ${payload.reservationNumber}`,
    replyTo: payload.email,
  });

  await sendMail({
    token,
    senderAddress,
    to: payload.email,
    subject: `Booking ${decisionLabel} - ${BRAND_NAME} - ${payload.hotelName} (${payload.reservationNumber})`,
    html: toBookingDecisionUserHtml(payload),
    text: `Booking ${decisionLabel.toLowerCase()} for reservation ${payload.reservationNumber}`,
  });
};

export const sendCheckInNotificationEmail = async (
  payload: CheckInNotificationPayload
) => {
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
    subject: `${TECH_SUBJECT_PREFIX} Check-in Saved | ${payload.roomName} - ${payload.reservationNumber}`,
    html: toCheckInAdminHtml(payload),
    text: `Check-in saved for reservation ${payload.reservationNumber}`,
    replyTo: payload.email,
  });
};
