// ─── 1. Импорты ────────────────────────────────────────────────────────────
import Papa from 'papaparse';
import { fetchWeather, getTimeOfDay } from './weather.js';
import { cities }              from './cities.js';

// ─── 2. Константы и переменные ─────────────────────────────────────────────
const defaultCity    = 'Seoul';
const SHEET_CSV_URL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTwhCOoNnWCX5qUX_8KuIVoBHkohSlP_N4Rwedjr7z8lrhLWx064VnBRFicyoUXOxkQSpvDC92PwRJY/pub?output=csv';

let events          = [];
let selectedCity    = defaultCity;
let sortByDate      = false;

// ─── 3. DOM-элементы ──────────────────────────────────────────────────────
// Splash-screen
const splash          = document.getElementById('splash');
const enterBtn        = document.getElementById('enter-btn');
const splashCityInput = document.getElementById('splash-city-input');

// Weather
const cityInput       = document.getElementById('city-input');
const getWeatherBtn   = document.getElementById('get-weather-btn');

// Filters & sorting
const cityFilter      = document.getElementById('city-filter');
const categoryFilter  = document.getElementById('category-filter');
const sortDateBtn     = document.getElementById('sort-date-btn');

// ─── 4. Функции ────────────────────────────────────────────────────────────

/**
 * 4.0 Load events from Google Sheets CSV
 */
async function loadEvents() {
  try {
    const res = await fetch(SHEET_CSV_URL);
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true, dynamicTyping: true });
    events = parsed.data.map(row => ({
      id:          row.id,
      city:        row.city,
      title:       row.title,
      description: row.description,
      date:        row.date,
      category:    row.category
    }));
    console.log('✅ events loaded from sheet:', events);
  } catch (err) {
    console.error('❌ Failed to load events from sheet:', err);
    events = [];
  }
}

/**
 * 4.1 Fetch & display weather for a given city
 */
async function update(city) {
  try {
    await fetchWeather(city);
  } catch (err) {
    console.error('Error fetching weather:', err);
    alert(`Could not get weather for "${city}". Please check the city name.`);
  }
}

/**
 * 4.2 Apply page theme based on time of day
 */
function applyTimeTheme() {
  const phase = getTimeOfDay(); // 'morning'|'day'|'evening'|'night'
  document.body.classList.add(`theme-${phase}`);
}

/**
 * 4.3 Apply background image for a given city
 * @param {string} city
 */
function applyCityBackground(city) {
  const config = cities.find(c => c.name === city);
  if (!config) return;
  document.body.style.backgroundImage    = `url("${config.background}")`;
  document.body.style.backgroundSize     = 'cover';
  document.body.style.backgroundPosition = 'center';
  document.body.style.backgroundRepeat   = 'no-repeat';
}

/**
 * 4.4 Populate city/category filters
 */
function populateFilters() {
  const citiesList = [...new Set(events.map(e => e.city))].sort();
  citiesList.forEach(city => {
    const opt = document.createElement('option');
    opt.value = city;
    opt.textContent = city;
    cityFilter.appendChild(opt);
  });

  const categories = [...new Set(events.map(e => e.category))].sort();
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });
}

/**
 * 4.5 Render event cards, respecting filters, sorting and selectedCity
 */
function renderEvents() {
  const container   = document.getElementById('events-container');
  const cityValue   = cityFilter.value;
  const categoryVal = categoryFilter.value;

  container.innerHTML = ''; // clear

  let filtered = events
    // сначала фильтр по Splash-выбранному городу
    .filter(e => e.city === selectedCity)
    // затем по селектам
    .filter(e => (!cityValue   || e.city     === cityValue))
    .filter(e => (!categoryVal || e.category === categoryVal));

  if (sortByDate) {
    filtered = filtered.sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );
  }

  filtered.forEach(event => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <h3>${event.title}</h3>
      <p>${event.description}</p>
      <p><small>${new Date(event.date).toLocaleString()}</small></p>
      <p><em>${event.city} — ${event.category}</em></p>
      <button class="btn">Join Event</button>
    `;
    container.appendChild(card);
  });

  // нажимаем Join Event
  document.querySelectorAll('#events-container .event-card .btn')
    .forEach(btn => btn.addEventListener('click', () => {
      alert('🎉 You joined the event! (Placeholder action)');
    }));
}

// ─── 5. Инициализация после загрузки страницы ───────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // 5.0 Load events first
  await loadEvents();

  // 5.1 Splash-screen: выбор города и вход
  enterBtn.addEventListener('click', () => {
    const chosen = splashCityInput.value.trim();
    const city   = chosen || defaultCity;
    selectedCity = city;
    splash.style.display = 'none';
    update(city);
    applyTimeTheme();
    applyCityBackground(city);
    cityInput.value = city;
    renderEvents();
  });

  // 5.2 Weather controls (button + Enter key)
  getWeatherBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) {
      update(city);
      applyCityBackground(city);
    }
  });
  cityInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      getWeatherBtn.click();
    }
  });

  // 5.3 Populate & bind filters
  populateFilters();
  cityFilter.addEventListener('change', () => {
    const city = cityFilter.value;
    if (city) {
      update(city);
      applyCityBackground(city);
      cityInput.value = city;
      selectedCity = city;
    }
    renderEvents();
  });
  categoryFilter.addEventListener('change', renderEvents);

  // 5.4 Bind sort button
  sortDateBtn.addEventListener('click', () => {
    sortByDate = !sortByDate;
    sortDateBtn.textContent = sortByDate ? 'Unsort' : 'Sort by Date';
    renderEvents();
  });

  // 5.5 Initial render (до Splash, чтобы не было пусто)
  renderEvents();
});
