// Around the World in 60 Seconds - Orbital Explorer & AI Travel Assistant
const TOUR_LENGTH = 60;
const COUNTRY_SHAPES_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";
const OPENROUTER_API_KEY = window.OPENROUTER_API_KEY || "";

// Popular curated tour route from the global database
const tourCountryCodes = ["IN", "JP", "BR", "KE", "NO", "CA", "ZA", "AU", "MX", "GB", "US", "FR", "DE", "EG", "AR", "KR"];

// Currency symbol map fallback
const currencySymbols = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", INR: "₹", AUD: "$", CAD: "$", CHF: "CHF", CNY: "¥", BRL: "R$",
  ZAR: "R", MXN: "$", NOK: "kr", KES: "KSh", RUB: "₽", KRW: "₩", AED: "AED", SGD: "$", NZD: "$", HKD: "HK$",
  SEK: "kr", DKK: "kr", PLN: "zł", THB: "฿", IDR: "Rp", TRY: "₺", EGP: "E£", SAR: "SR", ILS: "₪", CLP: "$"
};

const weatherCodes = {
  0: ["Clear sky", "clear", "☀"], 1: ["Mostly clear", "clear", "◐"], 2: ["Partly cloudy", "clouds", "◒"], 3: ["Overcast", "clouds", "☁"],
  45: ["Fog settling", "clouds", "≋"], 48: ["Rime fog", "clouds", "≋"], 51: ["Light drizzle", "rain", "⌇"], 53: ["Drizzle", "rain", "⌇"],
  55: ["Dense drizzle", "rain", "⌇"], 61: ["Light rain", "rain", "☂"], 63: ["Rain", "rain", "☂"], 65: ["Heavy rain", "rain", "☂"],
  71: ["Light snow", "snow", "✦"], 73: ["Snowfall", "snow", "✦"], 75: ["Heavy snow", "snow", "✦"], 80: ["Rain showers", "rain", "☂"],
  81: ["Rain showers", "rain", "☂"], 82: ["Violent showers", "storm", "ϟ"], 95: ["Thunderstorm", "storm", "ϟ"], 96: ["Thunderstorm with hail", "storm", "ϟ"], 99: ["Thunderstorm with hail", "storm", "ϟ"],
};

const localModes = {
  "early-morning": { label: "Early morning", accent: "#f6bd79", atmosphere: "#f6bd79" },
  morning: { label: "Morning", accent: "#7ee6d2", atmosphere: "#7ee6d2" },
  noon: { label: "Noon", accent: "#ffc857", atmosphere: "#ffc857" },
  evening: { label: "Evening", accent: "#ff9c7c", atmosphere: "#ff9c7c" },
  night: { label: "Night", accent: "#70d6ff", atmosphere: "#70d6ff" },
  midnight: { label: "Midnight", accent: "#c9b9fa", atmosphere: "#c9b9fa" },
};

// Global App State
const state = {
  allCountries: [],
  tourCountries: [],
  activeCountry: null,
  index: 0,
  seconds: TOUR_LENGTH,
  playing: true,
  baseCurrency: "USD",
  targetCurrency: "INR",
  amount: 1000,
  tempUnit: "C",
  currentTempCelsius: null,
  selectedRegion: "ALL",
  requestId: 0,
  timer: null,
  clockTimer: null,
  timezone: null,
  mode: "morning",
  globe: null,
  countryPolygons: [],
  hoveredPolygon: null,
  latestRatesCache: {},
  searchHighlightedIndex: -1,
  uiFaded: false,
  chatOpen: false,
  chatHistory: [],
  chatBusy: false
};

// Clean country names to remove trailing ", The" or awkward suffixes
function cleanCountryName(n) {
  if (!n) return "";
  if (n.endsWith(", The")) return "The " + n.slice(0, -5);
  const map = {
    "Egypt, Arab Rep.": "Egypt",
    "Iran, Islamic Rep.": "Iran",
    "Venezuela, RB": "Venezuela",
    "Yemen, Rep.": "Yemen",
    "Korea, Rep.": "South Korea",
    "Korea, Dem. Peoples Rep.": "North Korea",
    "Congo, Dem. Rep.": "Democratic Republic of the Congo",
    "Congo, Rep.": "Republic of the Congo",
    "Micronesia, Fed. Sts.": "Micronesia",
    "Slovak Republic": "Slovakia",
    "Kyrgyz Republic": "Kyrgyzstan",
    "Lao PDR": "Laos",
    "Turkiye": "Turkey",
    "Viet Nam": "Vietnam",
    "Russian Federation": "Russia",
    "Syrian Arab Republic": "Syria"
  };
  return map[n] || n;
}

// UI Element Handles
const ui = {
  app: document.querySelector(".experience"),
  globe: document.querySelector("#globe-viz"),
  maskOverlay: document.querySelector("#svg-mask-overlay"),
  maskCircle: document.querySelector("#mask-circle"),
  hudTargetName: document.querySelector("#hud-target-name"),
  hudTargetCoords: document.querySelector("#hud-target-coords"),
  globalCountBadge: document.querySelector("#global-count-badge"),
  
  // Search
  searchInput: document.querySelector("#country-search-input"),
  searchClearBtn: document.querySelector("#search-clear-btn"),
  searchResults: document.querySelector("#search-results-dropdown"),
  regionChips: document.querySelector("#region-chips"),
  
  // Hero Card
  countryFlag: document.querySelector("#country-flag-icon"),
  countryIndex: document.querySelector("#country-index"),
  countryTotal: document.querySelector("#country-total"),
  countryIso: document.querySelector("#country-iso-tag"),
  countryName: document.querySelector("#country-name"),
  countryCapital: document.querySelector("#country-capital"),
  countryNote: document.querySelector("#country-note"),
  telemetryCoords: document.querySelector("#telemetry-coords"),
  localMode: document.querySelector("#local-mode"),
  countryStatusTag: document.querySelector("#country-status-tag"),
  modeLabel: document.querySelector("#mode-label"),
  timerDial: document.querySelector("#timer-dial"),
  timerValue: document.querySelector("#timer-value"),
  timerCaption: document.querySelector("#timer-caption"),
  revealStatsBtn: document.querySelector("#reveal-stats-btn"),
  randomCountryBtn: document.querySelector("#random-country-btn"),
  
  // Stats Matrix & World Bank API Fields
  income: document.querySelector("#income-level"),
  lendingType: document.querySelector("#lending-type"),
  region: document.querySelector("#region-name"),
  adminRegion: document.querySelector("#admin-region"),
  detailCapital: document.querySelector("#detail-capital"),
  detailIso3: document.querySelector("#detail-iso3"),
  detailCurrency: document.querySelector("#detail-currency"),
  detailCoords: document.querySelector("#detail-coords"),
  wbStatusBadge: document.querySelector("#wb-status-badge"),
  
  // Weather
  unitCBtn: document.querySelector("#unit-c-btn"),
  unitFBtn: document.querySelector("#unit-f-btn"),
  weatherWord: document.querySelector("#weather-word"),
  weatherGlyph: document.querySelector("#weather-glyph"),
  temperature: document.querySelector("#temperature"),
  tempUnitLabel: document.querySelector("#temperature-unit-label"),
  weatherDetail: document.querySelector("#weather-detail"),
  wind: document.querySelector("#wind-speed"),
  localTime: document.querySelector("#local-time"),
  weatherField: document.querySelector("#weather-field"),
  
  // Currency Converter
  baseSelect: document.querySelector("#base-currency-select"),
  targetSelect: document.querySelector("#target-currency-select"),
  baseFlag: document.querySelector("#base-flag-preview"),
  targetFlag: document.querySelector("#target-flag-preview"),
  baseSymbolPrefix: document.querySelector("#base-symbol-prefix"),
  baseCodeSuffix: document.querySelector("#base-code-suffix"),
  amountInput: document.querySelector("#base-amount"),
  swapBtn: document.querySelector("#swap-currency-btn"),
  presetChips: document.querySelectorAll(".preset-chip"),
  conversionResult: document.querySelector("#conversion-result"),
  rateDate: document.querySelector("#rate-date"),
  rateDetail: document.querySelector("#rate-detail"),
  quantumWavePath: document.querySelector("#quantum-wave-path"),
  crossRatesGrid: document.querySelector("#cross-rates-grid"),
  
  // Globe Viewport Arena
  toggleUiBtn: document.querySelector("#toggle-ui-panels-btn"),
  toggleUiIcon: document.querySelector("#toggle-ui-icon"),
  toggleUiLabel: document.querySelector("#toggle-ui-label"),

  // Controls
  pauseButton: document.querySelector("#pause-button"),
  nextButton: document.querySelector("#next-button"),
  routePoints: document.querySelector("#route-points"),
  routeNext: document.querySelector("#route-next"),
  countryPicker: document.querySelector("#country-picker"),
  announcement: document.querySelector("#announcement"),

  // AI Chatbot
  chatToggleBtn: document.querySelector("#chat-toggle-btn"),
  chatModal: document.querySelector("#chat-modal"),
  closeChatBtn: document.querySelector("#close-chat-btn"),
  clearChatBtn: document.querySelector("#clear-chat-btn"),
  chatMessages: document.querySelector("#chat-messages"),
  chatUserInput: document.querySelector("#chat-user-input"),
  chatSendBtn: document.querySelector("#chat-send-btn"),
  chatBotContext: document.querySelector("#chat-bot-context"),
  quickPromptsContainer: document.querySelector("#quick-prompts-container")
};

// Initialize World Countries Dataset
function initCountryDataset() {
  const data = typeof WORLD_COUNTRIES !== "undefined" ? WORLD_COUNTRIES : [];
  data.forEach((c) => { c.name = cleanCountryName(c.name); });

  state.allCountries = data;
  state.tourCountries = data.filter((c) => tourCountryCodes.includes(c.code));
  if (state.tourCountries.length === 0) state.tourCountries = data.slice(0, 10);
  
  state.activeCountry = state.tourCountries[0] || data[0];
  ui.globalCountBadge.textContent = String(data.length);
  ui.countryTotal.textContent = String(data.length);
}

// Kinetic Number Rolling Counter Helper
function animateValue(element, start, end, duration = 600, formatter = null) {
  if (!element) return;
  const startTime = performance.now();
  const range = end - start;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = 1 - (1 - progress) * (1 - progress);
    const currentValue = start + range * easedProgress;

    element.textContent = formatter ? formatter(currentValue) : Math.round(currentValue).toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

// SVG Logo Mask Reveal Transition
function triggerMaskReveal(targetCountry) {
  if (!ui.maskOverlay) return;
  
  ui.hudTargetName.textContent = targetCountry.name.toUpperCase();
  ui.hudTargetCoords.textContent = targetCountry.latitude && targetCountry.longitude
    ? `COORDS: ${targetCountry.latitude.toFixed(2)}°, ${targetCountry.longitude.toFixed(2)}°`
    : `ISO: ${targetCountry.iso3} // CAP: ${targetCountry.capital.toUpperCase()}`;

  ui.maskOverlay.classList.add("active");
  if (ui.maskCircle) ui.maskCircle.setAttribute("r", "0");

  setTimeout(() => {
    let r = 0;
    const expandInterval = setInterval(() => {
      r += 8;
      if (ui.maskCircle) ui.maskCircle.setAttribute("r", String(r));
      if (r >= 100) {
        clearInterval(expandInterval);
        setTimeout(() => {
          ui.maskOverlay.classList.remove("active");
        }, 150);
      }
    }, 16);
  }, 350);
}

// Populate Currency Dropdowns
function populateCurrencyDropdowns() {
  const currenciesMap = new Map();
  state.allCountries.forEach((c) => {
    if (c.currency && !currenciesMap.has(c.currency)) {
      currenciesMap.set(c.currency, {
        code: c.currency,
        name: c.currencyName || c.currency,
        symbol: c.symbol || currencySymbols[c.currency] || c.currency,
        flag: c.flag || "🌐",
      });
    }
  });

  const sortedCurrencies = Array.from(currenciesMap.values()).sort((a, b) => a.code.localeCompare(b.code));

  [ui.baseSelect, ui.targetSelect].forEach((selectEl) => {
    if (!selectEl) return;
    selectEl.replaceChildren();
    sortedCurrencies.forEach((curr) => {
      const option = document.createElement("option");
      option.value = curr.code;
      option.textContent = `${curr.code} - ${curr.name}`;
      selectEl.append(option);
    });
  });

  ui.baseSelect.value = state.baseCurrency;
  ui.targetSelect.value = state.targetCurrency;
  updateCurrencyHeaderPreviews();
}

function updateCurrencyHeaderPreviews() {
  const baseCountry = state.allCountries.find((c) => c.currency === state.baseCurrency);
  const targetCountry = state.allCountries.find((c) => c.currency === state.targetCurrency);

  ui.baseFlag.textContent = baseCountry?.flag || "🌐";
  ui.targetFlag.textContent = targetCountry?.flag || "🌐";
  
  const symbol = baseCountry?.symbol || currencySymbols[state.baseCurrency] || state.baseCurrency;
  ui.baseSymbolPrefix.textContent = symbol;
  ui.baseCodeSuffix.textContent = state.baseCurrency;
}

// Populate Country Selectors & Quick Route
function populateCountryPicker() {
  ui.countryPicker.replaceChildren();
  state.allCountries.forEach((c) => {
    const option = document.createElement("option");
    option.value = c.code;
    option.textContent = `${c.flag} ${c.name}`;
    ui.countryPicker.append(option);
  });
  if (state.activeCountry) ui.countryPicker.value = state.activeCountry.code;
}

function createRoute() {
  ui.routePoints.replaceChildren();
  state.tourCountries.forEach((country, index) => {
    const point = document.createElement("span");
    point.className = "route-point";
    point.setAttribute("aria-label", country.name);
    point.title = country.name;
    point.dataset.index = index;
    point.addEventListener("click", () => selectCountry(country));
    ui.routePoints.append(point);
  });
}

function updateRoute() {
  const tourIdx = state.tourCountries.findIndex((c) => c.code === state.activeCountry.code);
  [...ui.routePoints.children].forEach((point, index) => {
    point.classList.toggle("active", index === tourIdx);
  });

  const nextIdx = tourIdx >= 0 ? (tourIdx + 1) % state.tourCountries.length : 0;
  const next = state.tourCountries[nextIdx] || state.allCountries[0];
  ui.routeNext.textContent = `Next: ${next.flag} ${next.name}`;
  if (ui.countryPicker) ui.countryPicker.value = state.activeCountry.code;
}

// Global Search System
function filterSearchResults(query) {
  if (!query || query.trim() === "") {
    ui.searchResults.style.display = "none";
    return;
  }

  const cleanQuery = query.toLowerCase().trim();
  let matches = state.allCountries.filter((c) => {
    const regionMatch = state.selectedRegion === "ALL" || c.region.toLowerCase().includes(state.selectedRegion.toLowerCase());
    if (!regionMatch) return false;

    return (
      c.name.toLowerCase().includes(cleanQuery) ||
      c.capital.toLowerCase().includes(cleanQuery) ||
      c.code.toLowerCase().includes(cleanQuery) ||
      c.iso3.toLowerCase().includes(cleanQuery) ||
      c.currency.toLowerCase().includes(cleanQuery)
    );
  });

  matches = matches.slice(0, 10);
  renderSearchResults(matches, cleanQuery);
}

function renderSearchResults(results, query) {
  ui.searchResults.replaceChildren();
  state.searchHighlightedIndex = -1;

  if (results.length === 0) {
    const noRes = document.createElement("div");
    noRes.className = "no-results";
    noRes.textContent = `No countries match "${query}"`;
    ui.searchResults.append(noRes);
    ui.searchResults.style.display = "flex";
    return;
  }

  results.forEach((country) => {
    const item = document.createElement("div");
    item.className = "search-result-item";
    item.dataset.code = country.code;

    item.innerHTML = `
      <div class="result-main">
        <span class="result-flag">${country.flag}</span>
        <div class="result-title">
          <span class="result-name">${country.name}</span>
          <span class="result-capital">${country.capital}</span>
        </div>
      </div>
      <div class="result-badges">
        <span class="result-region-badge">${country.region.split("&")[0]}</span>
        <span class="result-iso">${country.iso3}</span>
      </div>
    `;

    item.addEventListener("click", () => {
      selectCountry(country);
      ui.searchInput.value = "";
      ui.searchClearBtn.style.display = "none";
      ui.searchResults.style.display = "none";
    });

    ui.searchResults.append(item);
  });

  ui.searchResults.style.display = "flex";
}

// 3D Globe Visualizer Logic
function currentMode() {
  return localModes[state.mode] || localModes["morning"];
}

function refreshGlobeStyle() {
  if (!state.globe) return;
  const mode = currentMode();
  const selected = state.activeCountry ? state.activeCountry.code : "IN";

  state.globe
    .polygonCapColor((feature) => {
      const code = featureCode(feature);
      if (feature === state.hoveredPolygon) return "rgba(255, 239, 190, 0.92)";
      if (code === selected) return mode.accent;
      return "rgba(49, 123, 144, 0.26)";
    })
    .polygonSideColor((feature) => {
      const code = featureCode(feature);
      return feature === state.hoveredPolygon ? "rgba(255, 197, 112, 0.72)" : code === selected ? mode.accent : "rgba(7, 37, 53, 0.34)";
    })
    .polygonStrokeColor((feature) => (feature === state.hoveredPolygon ? "rgba(255, 255, 255, 0.95)" : "rgba(131, 211, 223, 0.3)"))
    .polygonAltitude((feature) => (feature === state.hoveredPolygon ? 0.075 : featureCode(feature) === selected ? 0.052 : 0.012))
    .pointColor(() => mode.accent)
    .ringColor(() => mode.accent)
    .atmosphereColor(mode.atmosphere);
}

function featureCode(feature) {
  const code = feature?.properties?.WB_A2 || feature?.properties?.ISO_A2;
  return code && code !== "-99" ? code.toUpperCase() : null;
}

function featureName(feature) {
  const raw = feature?.properties?.NAME_EN || feature?.properties?.ADMIN || feature?.properties?.NAME || "Unknown country";
  return cleanCountryName(raw);
}

function focusGlobe(country) {
  if (!state.globe || !Number.isFinite(country.latitude) || !Number.isFinite(country.longitude)) return;
  state.globe
    .pointsData([{ lat: country.latitude, lng: country.longitude }])
    .ringsData([{ lat: country.latitude, lng: country.longitude }])
    .ringLat("lat")
    .ringLng("lng")
    .ringMaxRadius(3.5)
    .ringPropagationSpeed(2.4)
    .ringRepeatPeriod(950)
    .pointAltitude(0.05)
    .pointRadius(0.3)
    .pointResolution(8)
    .pointOfView({ lat: country.latitude, lng: country.longitude, altitude: 1.6 }, 1050);
}

// Weather & Time Logic
function buildWeatherParticles(type) {
  ui.weatherField.className = "weather-field";
  ui.weatherField.replaceChildren();
  if (!type || type === "clear" || type === "storm") return;

  ui.weatherField.classList.add(type);
  const particleCount = type === "clouds" ? 6 : 24;
  for (let index = 0; index < particleCount; index += 1) {
    const particle = document.createElement("span");
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${Math.random() * 90 - 10}%`;
    particle.style.animationDelay = `${Math.random() * -5}s`;
    particle.style.animationDuration = `${type === "clouds" ? 14 + Math.random() * 8 : 1.1 + Math.random() * 2}s`;
    ui.weatherField.append(particle);
  }
}

function clockParts(timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());

    return {
      hour: Number(parts.find((p) => p.type === "hour")?.value),
      minute: parts.find((p) => p.type === "minute")?.value || "00",
      second: parts.find((p) => p.type === "second")?.value || "00",
    };
  } catch {
    const now = new Date();
    return { hour: now.getHours(), minute: String(now.getMinutes()).padStart(2, "0"), second: String(now.getSeconds()).padStart(2, "0") };
  }
}

function modeForHour(hour) {
  if (hour < 4) return "midnight";
  if (hour < 7) return "early-morning";
  if (hour < 11) return "morning";
  if (hour < 16) return "noon";
  if (hour < 20) return "evening";
  return "night";
}

function applyLocalMode(timezone) {
  if (!timezone) return;
  const local = clockParts(timezone);
  state.timezone = timezone;
  state.mode = modeForHour(local.hour);
  const mode = currentMode();
  const localClock = `${String(local.hour).padStart(2, "0")}:${local.minute}:${local.second}`;

  ui.app.dataset.mode = state.mode;
  ui.localMode.textContent = `${mode.label} (${localClock})`;
  ui.modeLabel.innerHTML = `${mode.label} at capital <span class="live-dot"></span>`;
  ui.localTime.textContent = `Local time ${localClock}`;
  refreshGlobeStyle();
}

function startClockTimer() {
  clearInterval(state.clockTimer);
  state.clockTimer = setInterval(() => {
    if (state.timezone) {
      const local = clockParts(state.timezone);
      const localClock = `${String(local.hour).padStart(2, "0")}:${local.minute}:${local.second}`;
      ui.localTime.textContent = `Local time ${localClock}`;
      ui.localMode.textContent = `${currentMode().label} (${localClock})`;
    }
  }, 1000);
}

// Weather Display Updates & C/F Toggle
function renderWeather(current, timezone) {
  const [label, type, glyph] = weatherCodes[current.weather_code] || ["Conditions changing", "clear", "◌"];
  state.currentTempCelsius = current.temperature_2m;

  ui.app.dataset.weather = type;
  ui.weatherWord.textContent = label;
  ui.weatherGlyph.textContent = glyph;
  updateTemperatureDisplay();

  ui.weatherDetail.textContent = current.is_day ? "Daylight at the capital city" : "Night has fallen at the capital";
  animateValue(ui.wind, 0, Math.round(current.wind_speed_10m), 500, (v) => `Wind ${Math.round(v)} km/h`);

  buildWeatherParticles(type);
  applyLocalMode(timezone);
  startClockTimer();
}

function updateTemperatureDisplay() {
  if (state.currentTempCelsius === null) return;
  let tempVal = state.currentTempCelsius;
  if (state.tempUnit === "F") {
    tempVal = (tempVal * 9) / 5 + 32;
  }
  ui.tempUnitLabel.textContent = `°${state.tempUnit}`;
  animateValue(ui.temperature, 0, tempVal, 400, (v) => `${Math.round(v)}`);
}

// Quantum Currency Converter Matrix Logic
async function fetchConversionRates(fromCode) {
  if (state.latestRatesCache[fromCode]) return state.latestRatesCache[fromCode];
  try {
    const response = await fetch(`https://api.frankfurter.dev/v2/rates/${fromCode.toLowerCase()}`);
    if (!response.ok) throw new Error("Frankfurter rate error");
    const data = await response.json();
    state.latestRatesCache[fromCode] = data;
    return data;
  } catch {
    return { rates: { USD: 1, EUR: 0.92, GBP: 0.78, INR: 83.5, JPY: 155, AUD: 1.5, CAD: 1.36 } };
  }
}

function drawQuantumWave(rateRatio) {
  if (!ui.quantumWavePath) return;
  const amplitude = Math.min(Math.max(rateRatio * 4, 3), 16);
  const d = `M0,18 Q37.5,${18 - amplitude} 75,18 T150,18 T225,${18 + amplitude} T300,18`;
  ui.quantumWavePath.setAttribute("d", d);
}

async function updateCurrencyConversion() {
  const from = state.baseCurrency;
  const to = state.targetCurrency;
  const amount = state.amount;

  updateCurrencyHeaderPreviews();
  ui.conversionResult.textContent = "Calculating...";
  ui.rateDate.textContent = "SYNCING...";

  try {
    if (from === to) {
      renderRateResult(1, amount, to, "Same Currency");
      return;
    }

    const data = await fetchConversionRates(from);
    const rate = data.rates[to] || 1;
    const dateStr = data.date ? `Rate: ${data.date}` : "Live Rate";
    renderRateResult(rate, amount * rate, to, dateStr);
    renderCrossRatesGrid(data.rates);
  } catch {
    ui.conversionResult.textContent = "Unavailable";
    ui.rateDetail.textContent = `${to} exchange telemetry delayed.`;
  }
}

function renderRateResult(rate, convertedTotal, targetCurr, dateStr) {
  const targetCountry = state.allCountries.find((c) => c.currency === targetCurr);
  const symbol = targetCountry?.symbol || currencySymbols[targetCurr] || targetCurr;

  ui.rateDate.textContent = dateStr;
  ui.rateDetail.textContent = `1 ${state.baseCurrency} = ${rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${targetCurr}`;

  const formatter = (val) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: targetCurr,
      maximumFractionDigits: targetCurr === "JPY" ? 0 : 2,
    }).format(val);
  };

  animateValue(ui.conversionResult, 0, convertedTotal, 500, formatter);
  drawQuantumWave(rate);
}

function renderCrossRatesGrid(rates) {
  if (!ui.crossRatesGrid) return;
  const majorCodes = ["USD", "EUR", "GBP", "JPY", "INR", "CAD", "AUD"];
  ui.crossRatesGrid.replaceChildren();

  majorCodes.forEach((code) => {
    if (code === state.baseCurrency) return;
    const rate = rates[code] || 1;
    const converted = state.amount * rate;
    const countryMatch = state.allCountries.find((c) => c.currency === code);

    const card = document.createElement("div");
    card.className = "cross-rate-item";
    card.innerHTML = `
      <div class="cross-rate-head">
        <span class="cross-code">${code}</span>
        <span class="cross-flag">${countryMatch?.flag || "🌐"}</span>
      </div>
      <span class="cross-val">${converted.toLocaleString(undefined, { maximumFractionDigits: code === "JPY" ? 0 : 2 })}</span>
    `;

    card.addEventListener("click", () => {
      state.targetCurrency = code;
      ui.targetSelect.value = code;
      updateCurrencyConversion();
    });

    ui.crossRatesGrid.append(card);
  });
}

// WORLD BANK COUNTRY API QUERY (https://datahelpdesk.worldbank.org/knowledgebase/articles/898590-country-api-queries)
async function fetchWorldBankProfile(countryCode) {
  if (!countryCode) return null;
  try {
    const response = await fetch(`https://api.worldbank.org/v2/country/${countryCode.toLowerCase()}?format=json`);
    if (!response.ok) throw new Error("World Bank Country API error");
    const payload = await response.json();
    const record = payload?.[1]?.[0];
    if (!record) return null;

    const regionVal = record.region?.value || "Global";
    const regionId = record.region?.id ? ` (${record.region.id})` : "";
    
    const incomeVal = record.incomeLevel?.value ? record.incomeLevel.value.replace(/^\d\.\s*/, "") : "Unspecified";
    const incomeId = record.incomeLevel?.id ? ` (${record.incomeLevel.id})` : "";

    const lendingVal = record.lendingType?.value || "Not classified";
    const lendingId = record.lendingType?.id ? ` (${record.lendingType.id})` : "";

    const adminVal = record.adminregion?.value || regionVal;

    return {
      name: cleanCountryName(record.name),
      capital: record.capitalCity || "N/A",
      region: `${regionVal}${regionId}`,
      adminRegion: adminVal,
      income: `${incomeVal}${incomeId}`,
      lendingType: `${lendingVal}${lendingId}`,
      latitude: Number(record.latitude) || null,
      longitude: Number(record.longitude) || null,
    };
  } catch (err) {
    console.warn("World Bank API fetch error:", err);
    return null;
  }
}

// Country Rendering & Hydration
function renderCountry(country) {
  const allIdx = state.allCountries.findIndex((c) => c.code === country.code);
  const displayIdx = allIdx >= 0 ? String(allIdx + 1).padStart(2, "0") : "01";

  country.name = cleanCountryName(country.name);

  ui.countryFlag.textContent = country.flag || "🌐";
  ui.countryIndex.textContent = displayIdx;
  ui.countryIso.textContent = country.iso3 || country.code;
  ui.countryName.textContent = country.name;
  ui.countryCapital.innerHTML = `<i data-lucide="map-pin" class="inline-icon"></i> ${country.capital}, ${country.region}`;
  ui.countryNote.textContent = country.note || `A live 60-second telemetry signal from ${country.name}.`;

  const lat = country.latitude ? country.latitude.toFixed(2) : "--";
  const lng = country.longitude ? country.longitude.toFixed(2) : "--";
  ui.telemetryCoords.textContent = `${lat}° N, ${lng}° E`;

  // Profile details card
  ui.income.textContent = country.income || "Profile loading";
  ui.lendingType.textContent = country.lendingType || "Not classified";
  ui.region.textContent = country.region || "Global";
  if (ui.adminRegion) ui.adminRegion.textContent = country.region || "Global";
  ui.detailCapital.textContent = country.capital;
  ui.detailIso3.textContent = country.iso3 || country.code;
  ui.detailCurrency.textContent = `${country.currency} (${country.currencyName || country.currency})`;
  ui.detailCoords.textContent = `${lat}°, ${lng}°`;

  // Update Chatbot Context text
  if (ui.chatBotContext) {
    ui.chatBotContext.textContent = `Context: ${country.name} ${country.flag || ""}`;
  }

  // Automatically sync target currency to selected country's currency if available
  if (country.currency && state.targetSelect) {
    state.targetCurrency = country.currency;
    ui.targetSelect.value = country.currency;
  }

  ui.app.classList.remove("is-changing");
  void ui.app.offsetWidth;
  ui.app.classList.add("is-changing");

  updateRoute();
  window.lucide?.createIcons();
}

async function loadWeather(latitude, longitude) {
  if (!latitude || !longitude) throw new Error("Coordinates missing");
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,weather_code,wind_speed_10m,is_day",
    timezone: "auto",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error("Open-Meteo signal unavailable");
  return response.json();
}

async function hydrateCurrentCountry() {
  const requestId = ++state.requestId;
  const country = state.activeCountry;

  triggerMaskReveal(country);
  renderCountry(country);
  focusGlobe(country);

  ui.weatherWord.textContent = "Reading sky...";
  ui.temperature.textContent = "--";
  ui.weatherDetail.textContent = "Establishing atmospheric telemetry...";

  updateCurrencyConversion();

  // Async World Bank Country API query
  fetchWorldBankProfile(country.code).then((wbProfile) => {
    if (requestId !== state.requestId || !wbProfile) return;
    if (wbProfile.income) ui.income.textContent = wbProfile.income;
    if (wbProfile.lendingType) ui.lendingType.textContent = wbProfile.lendingType;
    if (wbProfile.region) ui.region.textContent = wbProfile.region;
    if (wbProfile.adminRegion && ui.adminRegion) ui.adminRegion.textContent = wbProfile.adminRegion;
    if (wbProfile.capital) ui.detailCapital.textContent = wbProfile.capital;
    if (wbProfile.latitude && wbProfile.longitude) {
      ui.detailCoords.textContent = `${wbProfile.latitude.toFixed(4)}°, ${wbProfile.longitude.toFixed(4)}°`;
    }
    if (ui.wbStatusBadge) ui.wbStatusBadge.textContent = "WORLD BANK LIVE TELEMETRY";
  });

  if (country.latitude && country.longitude) {
    try {
      const weatherData = await loadWeather(country.latitude, country.longitude);
      if (requestId !== state.requestId) return;
      if (weatherData.current) renderWeather(weatherData.current, weatherData.timezone);
    } catch {
      if (requestId !== state.requestId) return;
      ui.weatherWord.textContent = "Signal delayed";
      ui.weatherDetail.textContent = "Weather signal temporarily unavailable.";
    }
  }

  if (requestId === state.requestId) {
    ui.announcement.textContent = `Selected destination: ${country.name}.`;
  }
}

function selectCountry(country) {
  if (!country) return;
  state.activeCountry = country;
  const tourIdx = state.tourCountries.findIndex((item) => item.code === country.code);
  state.index = tourIdx >= 0 ? tourIdx : 0;
  state.seconds = TOUR_LENGTH;

  updateTimer();
  refreshGlobeStyle();
  hydrateCurrentCountry();
}

function moveToNextCountry() {
  const nextIdx = (state.index + 1) % state.tourCountries.length;
  selectCountry(state.tourCountries[nextIdx]);
}

// Timer & Auto-Tour Controls
function updateTimer() {
  const progress = ((TOUR_LENGTH - state.seconds) / TOUR_LENGTH) * 360;
  ui.timerDial.style.setProperty("--timer-progress", `${progress}deg`);
  ui.timerValue.textContent = String(state.seconds).padStart(2, "0");
  ui.timerCaption.textContent = state.playing
    ? `Auto-touring location in ${state.seconds}s.`
    : "Tour paused. Signal locked.";
}

function setPlaying(playing) {
  state.playing = playing;
  ui.pauseButton.setAttribute("aria-label", playing ? "Pause tour" : "Resume tour");
  ui.pauseButton.dataset.tooltip = playing ? "Pause tour" : "Resume tour";
  ui.pauseButton.innerHTML = `<i data-lucide="${playing ? "pause" : "play"}" aria-hidden="true"></i>`;
  window.lucide?.createIcons();
  updateTimer();
}

function startTimer() {
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    if (!state.playing) return;
    state.seconds -= 1;
    if (state.seconds <= 0) {
      moveToNextCountry();
      return;
    }
    updateTimer();
  }, 1000);
}

// Globe Construction with Retry Guard
function resizeGlobe() {
  if (state.globe) {
    state.globe.width(window.innerWidth).height(window.innerHeight);
  }
}

async function initializeGlobe() {
  let retries = 0;
  while (!window.Globe && retries < 25) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    retries++;
  }

  if (!window.Globe) return;

  const globeContainer = ui.globe;
  if (!globeContainer) return;
  globeContainer.replaceChildren();

  const globe = window.Globe()(globeContainer);
  state.globe = globe
    .width(window.innerWidth)
    .height(window.innerHeight)
    .backgroundColor("rgba(0,0,0,0)")
    .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-dark.jpg")
    .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
    .showAtmosphere(true)
    .atmosphereAltitude(0.18)
    .showGraticules(false)
    .polygonCapCurvatureResolution(5)
    .polygonsTransitionDuration(400)
    .polygonLabel((feature) => `<div class="globe-hover-tooltip"><strong>${featureName(feature)}</strong></div>`)
    .onPolygonHover((feature) => {
      state.hoveredPolygon = feature;
      globeContainer.style.cursor = feature ? "pointer" : "grab";
      refreshGlobeStyle();
    })
    .onPolygonClick((feature) => {
      const code = featureCode(feature);
      const matched = state.allCountries.find((c) => c.code === code);
      if (matched) selectCountry(matched);
    });

  const controls = globe.controls();
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.28;
  globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  try {
    const response = await fetch(COUNTRY_SHAPES_URL);
    if (!response.ok) throw new Error("Country shapes unavailable");
    const collection = await response.json();
    state.countryPolygons = collection.features.filter((f) => featureCode(f));
    globe.polygonsData(state.countryPolygons);
    refreshGlobeStyle();
    if (state.activeCountry) focusGlobe(state.activeCountry);
  } catch {
    ui.announcement.textContent = "Globe initialized with satellite point telemetry.";
  }
}

// AI TRAVEL ASSISTANT CHATBOT LOGIC (OpenRouter API)
async function sendChatMessage(userText) {
  if (!userText || !userText.trim() || state.chatBusy) return;
  state.chatBusy = true;

  const text = userText.trim();
  appendChatMessage(text, "user");
  ui.chatUserInput.value = "";

  const typingEl = document.createElement("div");
  typingEl.className = "chat-message bot-msg typing-msg";
  typingEl.innerHTML = `<div class="msg-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
  ui.chatMessages.append(typingEl);
  ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;

  const activeCountry = state.activeCountry || { name: "Earth", capital: "Global", currency: "USD", region: "Global" };
  const currentTemp = state.currentTempCelsius !== null ? `${Math.round(state.currentTempCelsius)}°C` : "N/A";

  const systemPrompt = `You are the Orbital AI Travel Guide for the web application "Around the World". 
Current Active Context:
- Country: ${activeCountry.name} ${activeCountry.flag || ""}
- Capital City: ${activeCountry.capital}
- Region: ${activeCountry.region}
- Income Group: ${activeCountry.income || "N/A"}
- Currency: ${activeCountry.currency} (${activeCountry.currencyName || ""})
- Local Temperature: ${currentTemp}

Act as an enthusiastic, knowledgeable, and warm global travel guide! Answer the user's travel question clearly, using bullet points or concise paragraphs. Focus on real travel tips, top attractions, local food, culture, safety tips, or budget advice for ${activeCountry.name}.`;

  const messagesPayload = [
    { role: "system", content: systemPrompt },
    ...state.chatHistory.slice(-6),
    { role: "user", content: text }
  ];

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.href,
        "X-Title": "Around the World Travel Bot"
      },
      body: JSON.stringify({
        model: "openrouter/auto",
        messages: messagesPayload,
        max_tokens: 450
      })
    });

    typingEl.remove();

    if (!response.ok) throw new Error(`API response code ${response.status}`);

    const data = await response.json();
    const replyText = data.choices?.[0]?.message?.content || generateLocalTravelFallback(text, activeCountry);

    state.chatHistory.push({ role: "user", content: text });
    state.chatHistory.push({ role: "assistant", content: replyText });

    appendChatMessage(replyText, "bot");
  } catch (err) {
    typingEl.remove();
    console.warn("OpenRouter API error, using local fallback:", err);
    const fallbackText = generateLocalTravelFallback(text, activeCountry);
    appendChatMessage(fallbackText, "bot");
  } finally {
    state.chatBusy = false;
  }
}

function generateLocalTravelFallback(userQuery, country) {
  const q = userQuery.toLowerCase();
  const name = country.name;
  const cap = country.capital;
  const curr = country.currency;

  if (q.includes("place") || q.includes("visit") || q.includes("attraction")) {
    return `🏛️ **Top Highlights in ${name}**:\n\n1. **${cap} Historic Center**: Explore key monuments, local markets, and cultural landmarks.\n2. **National Parks & Coastal Wonders**: Discover the stunning natural landscape and iconic vistas.\n3. **UNESCO Heritage Sites**: Visit sacred temples, historic fortresses, and architectural masterworks.\n4. **Cultural Quarters**: Walk through historic neighborhoods rich with artisan crafts.`;
  } else if (q.includes("food") || q.includes("dish") || q.includes("eat")) {
    return `🍲 **Must-Try Culinary Specialties in ${name}**:\n\n• **Signature National Specialty**: Enjoy authentic slow-cooked traditional stew and seasoned rice dishes.\n• **Street Food Delicacies**: Sample crispy savory pastries, grilled skewers, and local flatbreads.\n• **Traditional Desserts**: Savor regional sweets infused with local spices and fruits.`;
  } else if (q.includes("time") || q.includes("season") || q.includes("when")) {
    return `📅 **Best Time to Visit ${name}**:\n\n• The ideal travel window is generally during the shoulder seasons (Spring & Autumn) when weather conditions are pleasant for sightseeing.\n• Avoid peak monsoon or extreme winter months for outdoor trekking!`;
  }
  return `✨ **Travel Telemetry for ${name}**:\n\nExploring ${name} (Capital: ${cap}) is an incredible adventure! Be sure to carry local currency (**${curr}**), respect local customs, and take advantage of public transit in ${cap}. Ask me any specific question about food, sights, or travel budgets!`;
}

function appendChatMessage(messageText, sender) {
  const msgEl = document.createElement("div");
  msgEl.className = `chat-message ${sender}-msg`;

  const formattedContent = messageText
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n• /g, "<br>• ");

  msgEl.innerHTML = `<div class="msg-bubble"><p>${formattedContent}</p></div>`;
  ui.chatMessages.append(msgEl);
  ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
}

// Event Listeners & Interactions
function setupEventListeners() {
  // Search input listeners
  ui.searchInput.addEventListener("input", (e) => {
    const val = e.target.value;
    ui.searchClearBtn.style.display = val.length > 0 ? "grid" : "none";
    filterSearchResults(val);
  });

  ui.searchClearBtn.addEventListener("click", () => {
    ui.searchInput.value = "";
    ui.searchClearBtn.style.display = "none";
    ui.searchResults.style.display = "none";
  });

  // Region filter chips
  ui.regionChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    ui.regionChips.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.selectedRegion = chip.dataset.region;
    filterSearchResults(ui.searchInput.value);
  });

  // Keyboard navigation & shortcuts
  window.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== ui.searchInput && document.activeElement !== ui.chatUserInput) {
      e.preventDefault();
      ui.searchInput.focus();
    } else if (e.key === "Escape") {
      ui.searchResults.style.display = "none";
      if (state.chatOpen) {
        state.chatOpen = false;
        ui.chatModal.style.display = "none";
      }
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-container")) {
      ui.searchResults.style.display = "none";
    }
  });

  // Toggle UI Panels (Globe Viewport Focus Mode)
  ui.toggleUiBtn.addEventListener("click", () => {
    state.uiFaded = !state.uiFaded;
    ui.app.classList.toggle("ui-faded", state.uiFaded);
    ui.toggleUiLabel.textContent = state.uiFaded ? "Show UI Panels" : "Hide UI (Focus Globe)";
    ui.toggleUiIcon.setAttribute("data-lucide", state.uiFaded ? "eye" : "eye-off");
    window.lucide?.createIcons();
  });

  // C/F Temperature unit toggle
  ui.unitCBtn.addEventListener("click", () => {
    state.tempUnit = "C";
    ui.unitCBtn.classList.add("active");
    ui.unitFBtn.classList.remove("active");
    updateTemperatureDisplay();
  });

  ui.unitFBtn.addEventListener("click", () => {
    state.tempUnit = "F";
    ui.unitFBtn.classList.add("active");
    ui.unitCBtn.classList.remove("active");
    updateTemperatureDisplay();
  });

  // Currency Converter Controls
  ui.baseSelect.addEventListener("change", (e) => {
    state.baseCurrency = e.target.value;
    updateCurrencyConversion();
  });

  ui.targetSelect.addEventListener("change", (e) => {
    state.targetCurrency = e.target.value;
    updateCurrencyConversion();
  });

  ui.swapBtn.addEventListener("click", () => {
    const temp = state.baseCurrency;
    state.baseCurrency = state.targetCurrency;
    state.targetCurrency = temp;

    ui.baseSelect.value = state.baseCurrency;
    ui.targetSelect.value = state.targetCurrency;
    updateCurrencyConversion();
  });

  ui.amountInput.addEventListener("input", (e) => {
    const val = Number(e.target.value);
    if (Number.isFinite(val) && val > 0) {
      state.amount = val;
      updateCurrencyConversion();
    }
  });

  ui.presetChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      ui.presetChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.amount = Number(chip.dataset.amount);
      ui.amountInput.value = state.amount;
      updateCurrencyConversion();
    });
  });

  // Selection & Tour buttons
  ui.revealStatsBtn.addEventListener("click", () => {
    document.querySelector("#stats-matrix")?.scrollIntoView({ behavior: "smooth" });
  });

  ui.randomCountryBtn.addEventListener("click", () => {
    const randomIdx = Math.floor(Math.random() * state.allCountries.length);
    selectCountry(state.allCountries[randomIdx]);
  });

  ui.pauseButton.addEventListener("click", () => setPlaying(!state.playing));
  ui.nextButton.addEventListener("click", moveToNextCountry);

  ui.countryPicker.addEventListener("change", (e) => {
    const code = e.target.value;
    const country = state.allCountries.find((c) => c.code === code);
    if (country) selectCountry(country);
  });

  // Chatbot Modal Event Listeners
  ui.chatToggleBtn.addEventListener("click", () => {
    state.chatOpen = !state.chatOpen;
    ui.chatModal.style.display = state.chatOpen ? "flex" : "none";
    if (state.chatOpen) ui.chatUserInput.focus();
  });

  ui.closeChatBtn.addEventListener("click", () => {
    state.chatOpen = false;
    ui.chatModal.style.display = "none";
  });

  ui.clearChatBtn.addEventListener("click", () => {
    state.chatHistory = [];
    ui.chatMessages.replaceChildren();
    appendChatMessage("Greetings Explorer! 🚀 I'm your AI Travel Companion. Ask me anything about attractions, food, culture, travel tips, or budget guides for the current country!", "bot");
  });

  ui.chatSendBtn.addEventListener("click", () => {
    sendChatMessage(ui.chatUserInput.value);
  });

  ui.chatUserInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendChatMessage(ui.chatUserInput.value);
    }
  });

  ui.quickPromptsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".quick-prompt-btn");
    if (btn) {
      const prompt = btn.dataset.prompt;
      sendChatMessage(prompt);
    }
  });

  window.addEventListener("resize", resizeGlobe, { passive: true });
}

// App Initialization Entrypoint
function initApp() {
  initCountryDataset();
  populateCurrencyDropdowns();
  populateCountryPicker();
  createRoute();

  setupEventListeners();

  updateTimer();
  hydrateCurrentCountry();
  startTimer();
  initializeGlobe();

  window.lucide?.createIcons();
}

// Run App when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
