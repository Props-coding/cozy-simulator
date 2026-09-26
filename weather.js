// Live weather (Update 4): the real sky over one "hometown", shown outside
// the house (rain, snow, clouds, fog, storms and sunshine), through the
// windows, and with umbrellas on anyone in the yard when it rains.
//
// The weather comes from Open-Meteo (open-meteo.com), a free weather
// service that needs no account or key for non-commercial projects like
// this one (up to 10,000 calls a day; each browser asks once every
// CONFIG.weather.refreshMinutes). Its data is shared under CC BY 4.0, so
// the weather chip in the header credits it.
//
// Everyone in the house asks about the same place, so everyone sees the
// same sky. What it finds goes into OUTDOORS (world.js), where anything
// else can read it: OUTDOORS.sky ("clear", "partly", "cloudy", "fog",
// "drizzle", "rain", "snow" or "storm"), rain and snow (0 to 1, how
// heavy), clouds (0 to 1), temp (degrees C), night (true or false), and
// raining (true for drizzle, rain and storms). A "weather" event fires on
// window whenever it changes.

const API = "https://api.open-meteo.com/v1/forecast";

// What each weather code means (codes from the World Meteorological
// Organization, as Open-Meteo sends them): [sky, rain, snow, clouds, words].
const CODES = {
  0: ["clear", 0, 0, 0, "Clear"],
  1: ["clear", 0, 0, 0.2, "Mostly clear"],
  2: ["partly", 0, 0, 0.5, "Partly cloudy"],
  3: ["cloudy", 0, 0, 0.9, "Overcast"],
  45: ["fog", 0, 0, 0.8, "Foggy"],
  48: ["fog", 0, 0, 0.8, "Frosty fog"],
  51: ["drizzle", 0.25, 0, 0.85, "Light drizzle"],
  53: ["drizzle", 0.35, 0, 0.85, "Drizzle"],
  55: ["drizzle", 0.45, 0, 0.9, "Heavy drizzle"],
  56: ["drizzle", 0.3, 0, 0.9, "Freezing drizzle"],
  57: ["drizzle", 0.45, 0, 0.9, "Freezing drizzle"],
  61: ["rain", 0.5, 0, 0.9, "Light rain"],
  63: ["rain", 0.75, 0, 0.95, "Rain"],
  65: ["rain", 1, 0, 1, "Heavy rain"],
  66: ["rain", 0.6, 0, 0.95, "Freezing rain"],
  67: ["rain", 0.9, 0, 1, "Freezing rain"],
  71: ["snow", 0, 0.4, 0.9, "Light snow"],
  73: ["snow", 0, 0.7, 0.95, "Snow"],
  75: ["snow", 0, 1, 1, "Heavy snow"],
  77: ["snow", 0, 0.3, 0.9, "Snow grains"],
  80: ["rain", 0.5, 0, 0.8, "Rain showers"],
  81: ["rain", 0.75, 0, 0.85, "Rain showers"],
  82: ["rain", 1, 0, 0.95, "Heavy showers"],
  85: ["snow", 0, 0.5, 0.85, "Snow showers"],
  86: ["snow", 0, 0.9, 0.95, "Heavy snow showers"],
  95: ["storm", 0.9, 0, 1, "Thunderstorm"],
  96: ["storm", 1, 0, 1, "Thunderstorm with hail"],
  99: ["storm", 1, 0, 1, "Thunderstorm with hail"],
};

// Little pictures for the header chip.
const ICONS = { clear: "☀️", partly: "⛅", cloudy: "☁️", fog: "🌫️", drizzle: "🌦️", rain: "🌧️", snow: "🌨️", storm: "⛈️" };
const NIGHT_ICONS = { clear: "🌙", partly: "☁️" };

// Try-outs from the admin panel ("rain", "snow", "night" and so on). They
// only change this computer, until you pick "Real weather" or reload.
let preview = { sky: null, night: null };
let real = null; // the last real reading: { sky, rain, snow, clouds, temp, night, words }

const chip = document.getElementById("weather-chip");

function apply() {
  const base = real ?? { sky: "clear", rain: 0, snow: 0, clouds: 0, temp: null, night: null, words: "" };
  let now = { ...base };
  if (preview.sky) {
    const [sky, rain, snow, clouds, words] = Object.values(CODES).find((c) => c[0] === preview.sky) ?? CODES[0];
    now = { ...now, sky, rain, snow, clouds, words: words + " (preview)" };
  }
  if (preview.night !== null) now.night = preview.night;
  const before = JSON.stringify([OUTDOORS.sky, OUTDOORS.rain, OUTDOORS.snow, OUTDOORS.night]);
  Object.assign(OUTDOORS, now, { raining: now.rain > 0, updated: Date.now() });
  if (JSON.stringify([OUTDOORS.sky, OUTDOORS.rain, OUTDOORS.snow, OUTDOORS.night]) !== before) window.dispatchEvent(new CustomEvent("weather", { detail: { ...OUTDOORS } }));
  showChip();
}

// "12°C" or "54°F", as picked in config.js.
function temperature(celsius) {
  if (!Number.isFinite(celsius)) return "";
  return CONFIG.weather.units === "F" ? `${Math.round((celsius * 9) / 5 + 32)}°F` : `${Math.round(celsius)}°C`;
}

function showChip() {
  if (!chip) return;
  const icon = (OUTDOORS.night && NIGHT_ICONS[OUTDOORS.sky]) || ICONS[OUTDOORS.sky] || "☀️";
  const temp = temperature(OUTDOORS.temp);
  chip.hidden = !real && !preview.sky && preview.night === null;
  chip.querySelector(".weather-icon").textContent = icon;
  chip.querySelector(".weather-temp").textContent = temp;
  const place = CONFIG.weather.hometown.name;
  chip.title = `Weather in ${place}: ${OUTDOORS.words || "Clear"}${temp ? ", " + temp : ""}${OUTDOORS.night ? ", night" : ""}. It shows in the yard and through the windows. Weather data by Open-Meteo.com (CC BY 4.0).`;
}

async function fetchWeather() {
  const { latitude, longitude } = CONFIG.weather.hometown;
  const url = `${API}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,cloud_cover,is_day&timezone=auto&forecast_days=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const c = data.current;
    const [sky, rain, snow, clouds, words] = CODES[c.weather_code] ?? CODES[Number.isFinite(c.cloud_cover) && c.cloud_cover > 60 ? 3 : 0];
    real = { sky, rain, snow, clouds: Number.isFinite(c.cloud_cover) ? Math.max(clouds, c.cloud_cover / 100) : clouds, temp: c.temperature_2m, night: c.is_day === 0, words };
    apply();
  } catch (err) {
    // No weather (offline, or the service is down): keep whatever we had.
    // Night then falls back to your own clock (see isNightOutside).
    console.warn("Couldn't get the weather:", err.message);
  }
}

// Starts checking the weather (main.js calls this once you've joined).
export function startWeather() {
  fetchWeather();
  setInterval(fetchWeather, Math.max(5, CONFIG.weather.refreshMinutes) * 60_000);
}

// The admin panel's weather try-outs: a sky ("rain", "snow"...), "day" or
// "night", or null for the real weather again.
export function previewWeather(pick) {
  if (pick === null) preview = { sky: null, night: null };
  else if (pick === "day" || pick === "night") preview.night = pick === "night";
  else preview.sky = pick;
  apply();
}

// True if it's really raining in the hometown right now (not just an admin
// preview), for things like the garden, which the rain waters.
export function isReallyRaining() {
  return !!real && real.rain > 0;
}
