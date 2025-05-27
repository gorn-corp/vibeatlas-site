// ─── 1. Импорты ────────────────────────────────────────────────────────────
import { fetchWeather, getTimeOfDay } from './weather.js';
import { events } from './events.js';

// ─── 2. Переменные DOM ────────────────────────────────────────────────────
const defaultCity       = 'London';

// Splash-screen
const splash            = document.getElementById('splash');           // линия ~8
const enterBtn          = document.getElementById('enter-btn');       // линия ~9
const splashCityInput   = document.getElementById('splash-city-input'); // линия ~10

// Weather
const cityInput         = document.getElementById('city-input');      // линия ~12
const getWeatherBtn     = document.getElementById('get-weather-btn'); // линия ~13

// Event filters
const cityFilter        = document.getElementById('city-filter');     // линия ~15
const categoryFilter    = document.getElementById('category-filter'); // линия ~16
const sortDateBtn = document.getElementById('sort-date-btn');
let sortByDate = false;

// ─── 3. Функции ────────────────────────────────────────────────────────────

/**
 * 3.1 Fetch & display weather for a given city
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
 * 3.2 Apply page theme based on time of day
 */
function applyTimeTheme() {
  const phase = getTimeOfDay(); // 'morning'|'day'|'evening'|'night'
  document.body.classList.add(`theme-${phase}`);
}

/**
 * 3.3 Render events into #events-container,
 *      taking into account current filters
 */
function renderEvents() {
  const container   = document.getElementById('events-container');
  const cityValue   = cityFilter.value;
  const categoryVal = categoryFilter.value;

  container.innerHTML = '';

  let filtered = events
    .filter(e => (!cityValue || e.city === cityValue))
    .filter(e => (!categoryVal || e.category === categoryVal));

  if (sortByDate) {
    filtered = filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
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
}

/**
 * 3.4 Populate filter dropdowns with unique cities and categories
 */
function populateFilters() {
  // Cities
  const cities = [...new Set(events.map(e => e.city))].sort();
  cities.forEach(city => {
    const opt = document.createElement('option');
    opt.value = city;
    opt.textContent = city;
    cityFilter.appendChild(opt);
  });
  // Categories
  const cats = [...new Set(events.map(e => e.category))].sort();
  cats.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });
}

// ─── 4. Инициализация после загрузки страницы ───────────────────────────────
window.addEventListener('DOMContentLoaded', () => {

  // 4.1 Splash-screen: выбор города и вход
  enterBtn.addEventListener('click', () => {
    const chosen = splashCityInput.value.trim();
    const city   = chosen || defaultCity;
    splash.style.display = 'none';
    update(city);
    applyTimeTheme();
    // После первой загрузки обновляем main-input, чтобы он совпадал
    cityInput.value = city;
  });

  // 4.2 Weather: кнопка и Enter
  getWeatherBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) update(city);
  });
  cityInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      getWeatherBtn.click();
    }
  });

  // 4.3 Populate & bind event filters
  populateFilters();
  cityFilter.addEventListener('change', renderEvents);
  categoryFilter.addEventListener('change', renderEvents);

  // 4.3.1 Sort button logic
  sortDateBtn.addEventListener('click', () => {
    sortByDate = !sortByDate;
    sortDateBtn.textContent = sortByDate ? 'Unsort' : 'Sort by Date';
    renderEvents();
  });

  // 4.4 Initial render of events
  renderEvents();

  // 4.5) Stub для кнопок “Join Event”
  document.querySelectorAll('#events-container .event-card .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      alert('🎉 You joined the event! (Placeholder action)');
    });
  });
});
