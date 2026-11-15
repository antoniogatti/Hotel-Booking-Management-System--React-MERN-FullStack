export type OcrLine = { text: string; x0: number; x1: number; y0: number; y1: number };
export type ScreenshotRow = {
  reference: string;
  guestName: string;
  room: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  amount: string;
  sharedTotal: string;
};

const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const normalized = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function dateValue(month: string, day: string, year: string): string {
  const index = months.indexOf(month.slice(0, 3).toLowerCase());
  if (index < 0) return "";
  const value = `${year}-${String(index + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? "" : value;
}

function datesFromText(text: string): string[] {
  return Array.from(text.matchAll(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})\s*,?\s*(\d{4})\b/gi),
    (match) => dateValue(match[1], match[2], match[3])).filter(Boolean);
}

export function parseBookingScreenshot(lines: OcrLine[], roomNames: string[]): ScreenshotRow[] {
  const anchors = lines.flatMap((line) => {
    const reference = line.text.match(/\b\d{8,14}\b/)?.[0];
    return reference ? [{ ...line, reference, y: (line.y0 + line.y1) / 2 }] : [];
  }).sort((a, b) => a.y - b.y);
  return anchors.flatMap((anchor, index) => {
    const top = index ? (anchors[index - 1].y + anchor.y) / 2 : anchor.y - 200;
    const bottom = index + 1 < anchors.length ? (anchor.y + anchors[index + 1].y) / 2 : anchor.y + 300;
    const group = lines.filter((line) => (line.y0 + line.y1) / 2 >= top && (line.y0 + line.y1) / 2 < bottom)
      .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    const roomText = normalized(group.filter((line) => line.x0 < anchor.x0 + 300 && line.y0 > anchor.y0).map((line) => line.text).join(" "));
    const rooms = roomNames.filter((name) => {
      const key = normalized(name);
      return key.length >= 4 && roomText.includes(key);
    });
    const name = group.filter((line) => line.x0 < anchor.x0 + 80 && line.y1 <= anchor.y0 && !/\d/.test(line.text))
      .sort((a, b) => b.y1 - a.y1)[0]?.text.trim() || "";
    const dateText = group.filter((line) => line.x0 >= anchor.x0 + 200 && !/booked on/i.test(line.text))
      .sort((a, b) => a.x0 - b.x0).map((line) => line.text).join(" ");
    const dates = datesFromText(dateText);
    const guestText = group.map((line) => line.text).join(" ");
    const adults = guestText.match(/\b(\d+)\s+adults?\b/i);
    const children = guestText.match(/\b(\d+)\s+children?\b/i);
    const guests = guestText.match(/\b(\d+)\s+guests?\b/i);
    const guestCount = adults ? String(Number(adults[1]) + Number(children?.[1] || 0)) : guests?.[1] || "";
    const rawPrice = guestText.match(/(?:€|EUR)\s*([\d.,]+)/i)?.[1] ||
      guestText.match(/([\d.,]+)\s*(?:€|EUR)/i)?.[1] || "";
    const shared = rooms.length > 1;
    return (rooms.length ? rooms : [""]).map((room) => ({
      reference: anchor.reference, guestName: name, room,
      checkIn: dates[0] || "", checkOut: dates[1] || "",
      guests: shared ? "" : guestCount, amount: "",
      sharedTotal: rawPrice,
    }));
  });
}
