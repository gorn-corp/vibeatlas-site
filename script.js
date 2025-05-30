// ─── 1. Импорты ────────────────────────────────────────────────────────────
import Papa from 'papaparse';
import { fetchWeather, getTimeOfDay } from './weather.js';

// ─── 2. Константы и переменные ─────────────────────────────────────────────
const defaultCity   = 'Seoul';
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTwhCOoNnWCX5qUX_8KuIVoBHkohSlP_N4Rwedjr7z8lrhLWx064VnBRFicyoUXOxkQSpvDC92PwRJY/pub?output=csv';
const CITIES_JSON   = '/cities.json';     // <-- новый путь

let events         = [];
let citiesList     = [];                  // <-- сюда запишем города из JSON
let selectedCity   = defaultCity;
let sortByDate     = false;

// ─── 3. DOM-элементы ──────────────────────────────────────────────────────
const splash            = document.getElementById('splash');
const enterBtn          = document.getElementById('enter-btn');
const heroEnterBtn      = document.getElementById('enter-hero-btn');
const splashCityInput   = document.getElementById('splash-city-input');

const cityInput         = document.getElementById('city-input');
const getWeatherBtn     = document.getElementById('get-weather-btn');

const searchInput       = document.getElementById('search-input');
const cityFilter        = document.getElementById('city-filter');
const categoryFilter    = document.getElementById('category-filter');
const sortDateBtn       = document.getElementById('sort-date-btn');
const eventsContainer   = document.getElementById('events-container');

// ─── 4. Функции ────────────────────────────────────────────────────────────

/** 4.0.0 Загрузка списка городов из public/cities.json */
async function loadCities() {
  try {
    const res = await fetch(CITIES_JSON);
    citiesList = await res.json();
    console.log('✅ cities loaded:', citiesList);
  } catch (err) {
    console.error('❌ loadCities error', err);
    citiesList = [];
  }
}

/** 4.0 Загрузка событий из Google Sheets CSV */
async function loadEvents() {
  try {
    const res    = await fetch(SHEET_CSV_URL);
    const csv    = await res.text();
    const parsed = Papa.parse(csv, { header: true, dynamicTyping: true });
    events = parsed.data.map(r => ({
      id:          r.id,
      city:        r.city,
      title:       r.title,
      description: r.description,
      date:        r.date,
      category:    r.category
    }));
    console.log('✅ events loaded:', events);
  } catch (err) {
    console.error('❌ loadEvents error', err);
    events = [];
  }
}

/** 4.1 Получение и отображение погоды */
async function update(city) {
  try {
    await fetchWeather(city);
  } catch (e) {
    console.error(e);
    alert(`Could not fetch weather for "${city}"`);
  }
}

/** 4.2 Тема дня */
function applyTimeTheme() {
  const phase = getTimeOfDay(); // 'morning'|'day'|'evening'|'night'
  document.body.classList.add(`theme-${phase}`);
}

/** 4.3 Фон по городу */
function applyCityBackground(city) {
  const cfg = citiesList.find(c => c.name === city);
  if (!cfg) return;
  Object.assign(document.body.style, {
    backgroundImage:    `url("${cfg.background}")`,
    backgroundSize:     'cover',
    backgroundPosition: 'center',
    backgroundRepeat:   'no-repeat'
  });
}

/** 4.4 Заполнение фильтров */
function populateFilters() {
  // города из JSON
  cityFilter.innerHTML = `<option value="">All Cities</option>`;
  citiesList.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    cityFilter.appendChild(opt);
  });
  // категории из events 
  const catList = [...new Set(events.map(e => e.category))].sort();
  categoryFilter.innerHTML = `<option value="">All Categories</option>`;
  catList.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat; opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });
}

/** 4.5 Рендер событий */
function renderEvents() {
  eventsContainer.innerHTML = '';
  let filtered = events
    .filter(e => e.city === selectedCity)
    .filter(e => (!cityFilter.value    || e.city     === cityFilter.value))
    .filter(e => (!categoryFilter.value|| e.category === categoryFilter.value));

  const query = searchInput.value.trim().toLowerCase();
  if (query) {
    filtered = filtered.filter(e =>
      e.title.toLowerCase().includes(query) ||
      e.description.toLowerCase().includes(query)
    );
  }

  if (filtered.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'no-events';
    msg.textContent = 'No events found for this selection.';
    eventsContainer.appendChild(msg);
    return;
  }

  if (sortByDate) {
    filtered = filtered.sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );
  }

  filtered.forEach(e => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <h3>${e.title}</h3>
      <p>${e.description}</p>
      <p><small>${new Date(e.date).toLocaleString()}</small></p>
      <p><em>${e.city} — ${e.category}</em></p>
      <button class="btn join-btn">Join Event</button>
    `;
    eventsContainer.appendChild(card);
  });

  // обработчик кнопок
  eventsContainer.querySelectorAll('.join-btn')
    .forEach(btn => btn.addEventListener('click', () => {
      alert('🎉 You joined the event! (Placeholder)');
    }));
}

// ─── 5. Инициализация ───────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // 5.0 загружаем города и события
  await loadCities();
  await loadEvents();

  // 5.1 ENTER на Splash-input
  splashCityInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') enterBtn.click();
  });

  // 5.2 клик Splash Enter
  enterBtn.addEventListener('click', () => {
    const city = splashCityInput.value.trim() || defaultCity;
    selectedCity = city;
    splash.style.display = 'none';
    update(city);
    applyTimeTheme();
    applyCityBackground(city);
    populateFilters();
    renderEvents();
  });

  // 5.3 Hero Get Started
  heroEnterBtn.addEventListener('click', () => enterBtn.click());

  // live-поиск
searchInput.addEventListener('input', renderEvents);

  // 5.4 фильтр города
  cityFilter.addEventListener('change', () => {
    const city = cityFilter.value;
    if (city) {
      selectedCity = city;
      update(city);
      applyCityBackground(city);
    }
    renderEvents();
  });

  // 5.5 фильтр категории
  categoryFilter.addEventListener('change', renderEvents);

  // 5.6 сортировка
  sortDateBtn.addEventListener('click', () => {
    sortByDate = !sortByDate;
    sortDateBtn.textContent = sortByDate ? 'Unsort' : 'Sort by Date';
    renderEvents();
  });

  // ─── 6. Карусель: кнопки пролистывания
const carousel = document.querySelector('.carousel');
document.querySelector('.prev-btn').addEventListener('click', () => {
  carousel.scrollBy({ left: -320, behavior: 'smooth' });
});
document.querySelector('.next-btn').addEventListener('click', () => {
  carousel.scrollBy({ left: +320, behavior: 'smooth' });
});

});
