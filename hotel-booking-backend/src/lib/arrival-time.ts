export const isArrivalTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export const normalizeArrivalTime = (value?: string) => {
  const match = value?.match(/(?:^|\D)([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/);
  if (!match) return "";
  const time = `${match[1].padStart(2, "0")}:${match[2]}`;
  return isArrivalTime(time) ? time : "";
};
