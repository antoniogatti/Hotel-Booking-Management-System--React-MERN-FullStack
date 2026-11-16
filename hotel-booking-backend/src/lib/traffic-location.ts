/// <reference lib="es2021.intl" />
import cities from "cities.json";

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

type Coordinates = { latitude: number; longitude: number };
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
const locations = new Map<string, Coordinates | null>();

// Keep ambiguous same-name cities unplotted: telemetry has no region to disambiguate them.
for (const city of cities) {
  const coordinates = { latitude: Number(city.lat), longitude: Number(city.lng) };
  for (const country of [city.country, countryNames.of(city.country)]) {
    const key = `${normalize(country)}|${normalize(city.name)}`;
    locations.set(key, locations.has(key) ? null : coordinates);
  }
}

export const resolveTrafficLocation = (country: string, city: string): Coordinates | null =>
  locations.get(`${normalize(country)}|${normalize(city)}`) ?? null;
