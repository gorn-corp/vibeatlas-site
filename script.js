// ─── 1. Импорты ────────────────────────────────────────────────────────────
import Papa from 'papaparse';
import EmblaCarousel from 'embla-carousel';
import { fetchWeather, getTimeOfDay } from './weather.js';

// ─── 1.1 Вспомогательные функции для работы с датами ───────────────
function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear()
      && d1.getMonth() === d2.getMonth()
      && d1.getDate() === d2.getDate();
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// ─── 2. Константы и переменные ─────────────────────────────────────────────
const defaultCity   = 'Seoul';
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTwhCOoNnWCX5qUX_8KuIVoBHkohSlP_N4Rwedjr7z8lrhLWx064VnBRFicyoUXOxkQSpvDC92PwRJY/pub?output=csv';
const CITIES_JSON   = '/cities.json';   

let events         = [];
let citiesList     = [];               
let selectedCity   = defaultCity;
let cityCoordsMap = {};
let sortByDate     = false;

// ─── 3. DOM-элементы ──────────────────────────────────────────────────────
const splash            = document.getElementById('splash');
const enterBtn          = document.getElementById('enter-btn');
const heroEnterBtn      = document.getElementById('enter-hero-btn');
const splashCityInput   = document.getElementById('splash-city-input');

const cityInput         = document.getElementById('city-input');
const getWeatherBtn     = document.getElementById('get-weather-btn');
// DOM для Add Event
const addEventBtn       = document.getElementById('add-event-btn');
const eventFormContainer= document.getElementById('event-form-container');
const eventForm         = document.getElementById('event-form');
const evtTitleInput     = document.getElementById('evt-title');
const evtDescInput      = document.getElementById('evt-desc');
const evtDateInput      = document.getElementById('evt-date');
const evtCitySelect     = document.getElementById('evt-city');
const evtCategoryInput  = document.getElementById('evt-category');
const evtCancelBtn      = document.getElementById('evt-cancel-btn');

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
    // Создаём карту координат по названиям
cityCoordsMap = {};
citiesList.forEach(c => {
  cityCoordsMap[c.name.trim()] = {
    lat: parseFloat(c.lat),
    lon: parseFloat(c.lon)
  };
});
console.log('✅ cityCoordsMap:', cityCoordsMap);
    console.log('✅ cities loaded:', citiesList);

    // Сформируем вспомогательную карту: { "Kyoto": {lat, lon}, ... }
    window.cityCoordsMap = {};
    citiesList.forEach(c => {
      if (c.name && c.lat && c.lon) {
        cityCoordsMap[c.name] = { lat: parseFloat(c.lat), lon: parseFloat(c.lon) };
      }
    });

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
      category:    r.category,
      lat:         parseFloat(r.lat),
      lon:         parseFloat(r.lon)
    
    }));

    // Добавим тестовые Kyoto-ивенты (уже с lat/lon)
    const now = new Date();
    const testKyotoEvents = [
      {
        id: 'kyoto1',
        city: 'Kyoto',
        title: 'Zen Meditation Workshop',
        description: 'Morning meditation in a 600-year-old temple.',
        date: new Date(now).toISOString(),
        category: 'Spiritual',
        lat: 35.0031,
        lon: 135.7788
      },
      {
        id: 'kyoto2',
        city: 'Kyoto',
        title: 'Gion Matsuri Night Parade',
        description: 'The ancient float festival in full neon glow.',
        date: new Date(now.setDate(now.getDate() + 1)).toISOString(),
        category: 'Culture',
        lat: 35.0039,
        lon: 135.7780
      },
      {
        id: 'kyoto3',
        city: 'Kyoto',
        title: 'Street Food Fiesta',
        description: 'Local snacks and tea tasting near Nishiki Market.',
        date: new Date(now.setDate(now.getDate() + 2)).toISOString(),
        category: 'Food',
        lat: 35.0042,
        lon: 135.7661
      },
      {
        id: 'kyoto4',
        city: 'Kyoto',
        title: 'Anime Music Live',
        description: 'Orchestra playing Studio Ghibli and classics.',
        date: new Date(now.setDate(now.getDate() + 3)).toISOString(),
        category: 'Music',
        lat: 35.0007,
        lon: 135.7725
      },
      {
        id: 'kyoto5',
        city: 'Kyoto',
        title: 'AI + Zen Symposium',
        description: 'Nova тоже будет, но в голограмме.',
        date: new Date(now.setDate(now.getDate() + 5)).toISOString(),
        category: 'Tech',
        lat: 35.0116,
        lon: 135.7681
      }
    ];
    events = [...events, ...testKyotoEvents];
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
  // Города
  cityFilter.innerHTML = `<option value="">All Cities</option>`;
  citiesList.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    cityFilter.appendChild(opt);
  });
  // Для формы Add Event
  evtCitySelect.innerHTML = `<option value="">Select City</option>`;
  citiesList.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    evtCitySelect.appendChild(opt);
  });
  // Категории
  const catList = [...new Set(events.map(e => e.category))].sort();
  categoryFilter.innerHTML = `<option value="">All Categories</option>`;
  catList.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat; 
    const emojis = {
  Music: "🎵",
  Food: "🍜",
  Culture: "🎭",
  Tech: "🤖",
  Parade: "🎉",
  Romantic: "💖",
  Art: "🎨",
  Festival: "🎪",
  Spiritual: "🧘"
};
opt.textContent = `${emojis[cat] || ''} ${cat}`;
    categoryFilter.appendChild(opt);
  });
}

/** 4.5 Рендер событий */
function renderEvents() {
  // Очищаем контейнер
  eventsContainer.innerHTML = '';

  // 1) Фильтруем по selectedCity + по фильтрам UI
  const now = new Date();
  const allFiltered = events
    .filter(e => e.city === selectedCity)
    .filter(e => (!cityFilter.value     || e.city     === cityFilter.value))
    .filter(e => (!categoryFilter.value || e.category === categoryFilter.value));

  // 2) Live search
  const query = searchInput.value.trim().toLowerCase();
  let filtered = allFiltered;
  if (query) {
    filtered = filtered.filter(e =>
      e.title.toLowerCase().includes(query) ||
      e.description.toLowerCase().includes(query)
    );
  }

  // 3) Сортировка по дате
  if (sortByDate) {
    filtered = filtered.sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );
  }

  // 4) Разбиваем на Today/Tomorrow/Upcoming
  const today    = filtered.filter(e => isSameDay(new Date(e.date), now));
  const tomorrow = filtered.filter(e => isSameDay(new Date(e.date), addDays(now, 1)));
  const later    = filtered.filter(e => new Date(e.date) > addDays(now, 1));

  // 5) Если нет карточек
  if (filtered.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'no-events';
    msg.textContent = 'No events found for this selection.';
    eventsContainer.appendChild(msg);
    return;
  }

  // 6) Рендер группы
  function renderGroup(title, list) {
    if (list.length === 0) return;
    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    titleEl.style.margin = '1rem 0 0.5rem';
    eventsContainer.appendChild(titleEl);

    list.forEach(e => {
      // Карточка
      const card = document.createElement('div');
      card.className = 'event-card';
      card.dataset.id = e.id;

      card.innerHTML = `
        <h3>${e.title}</h3>
        <p>${e.description}</p>
        <p><small>${new Date(e.date).toLocaleString()}</small></p>
        <p><em>${e.city} — ${e.category}</em></p>
        <div class="event-actions">
          <button class="btn details-btn">View Details</button>
          <button class="btn map-btn">📍 Show on Map</button>
        </div>
      `;

      // Embla wrap
      const slide = document.createElement('div');
      slide.className = 'embla__slide';
      slide.appendChild(card);
      eventsContainer.appendChild(slide);

      // ─── Обработчики ──────────────────────────────────────────────────────

      // View Details
      const detailsBtn = card.querySelector('.details-btn');
      detailsBtn.addEventListener('click', () => {
        document.getElementById('modal-title').textContent       = e.title;
        document.getElementById('modal-description').textContent = e.description;
        document.getElementById('modal-date').textContent        = new Date(e.date).toLocaleString();
        document.getElementById('modal-city').textContent        = e.city;
        document.getElementById('modal-category').textContent    = e.category;
        document.getElementById('event-modal').classList.remove('hidden');
        // если есть координаты — показываем мини-карту в модалке
setTimeout(() => {
  const lat = parseFloat(e.lat);
  const lon = parseFloat(e.lon);

  if (!isNaN(lat) && !isNaN(lon)) {
    const modalMap = L.map('modal-map', {
      attributionControl: false,
      zoomControl: false,
      dragging: false
    }).setView([lat, lon], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(modalMap);
    L.marker([lat, lon]).addTo(modalMap).bindPopup(e.title).openPopup();

    // уничтожаем при закрытии, чтобы не баговалось
    document.getElementById('modal-close').addEventListener('click', () => {
      modalMap.remove();
    });
  } else {
    document.getElementById('modal-map').innerHTML = '<p style="color:gray;">No map available</p>';
  }
}, 100);

      });

      // Show on Map
      const mapBtn = card.querySelector('.map-btn');
      mapBtn.addEventListener('click', () => {
        const lat = parseFloat(e.lat);
        const lon = parseFloat(e.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          showMap(lat, lon, e.title);
        } else {
          alert("This event has no coordinates yet.");
        }
      });

      // Join Event (если есть)
      const joinBtn = card.querySelector('.join-btn');
      if (joinBtn) {
        joinBtn.addEventListener('click', () => {
          alert('🎉 You joined the event! (Placeholder)');
        });
      }
    });
  }

  renderGroup("Today",    today);
  renderGroup("Tomorrow", tomorrow);
  renderGroup("Upcoming", later);
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
    cityFilter.value = city; // чтобы сразу видно было в фильтре

    splash.style.display = 'none';
    update(city);
    applyTimeTheme();
    applyCityBackground(city);
    populateFilters();
    cityFilter.value = selectedCity;
    renderEvents();
    initEmbla();
  });

  // 5.3 Hero Get Started
  heroEnterBtn.addEventListener('click', () => enterBtn.click());

  // 5.4 live-поиск
  searchInput.addEventListener('input', () => {
    renderEvents();
    initEmbla();
  });

  // 5.5 фильтр города
  cityFilter.addEventListener('change', () => {
    const city = cityFilter.value;
    if (city) {
      selectedCity = city;
      update(city);
      applyCityBackground(city);
    }
    renderEvents();
    initEmbla();
  });

  // 5.6 фильтр категории
  categoryFilter.addEventListener('change', () => {
    renderEvents();
    initEmbla();
  });

  // 5.7 сортировка
  sortDateBtn.addEventListener('click', () => {
    sortByDate = !sortByDate;
    sortDateBtn.textContent = sortByDate ? 'Unsort' : 'Sort by Date';
    renderEvents();
    initEmbla();
  });

  // ─── 6. Показ/скрытие формы Add Event ─────────────────────────────

  addEventBtn.addEventListener('click', () => {
    eventFormContainer.style.display = 'flex';
  });

  // При выборе города — подставим координаты из cityCoordsMap
evtCitySelect.addEventListener('change', () => {
  const selected = evtCitySelect.value;
  const coords = cityCoordsMap?.[selected];
  if (coords) {
    evtCitySelect.dataset.lat = coords.lat;
    evtCitySelect.dataset.lon = coords.lon;
  } else {
    delete evtCitySelect.dataset.lat;
    delete evtCitySelect.dataset.lon;
  }
});

  evtCancelBtn.addEventListener('click', () => {
    eventFormContainer.style.display = 'none';
  });

// ─── Обработка submit формы ──────────────────────
eventForm.addEventListener('submit', e => {
  e.preventDefault();

  const title    = evtTitleInput.value.trim();
  const desc     = evtDescInput.value.trim();
  const dateVal  = evtDateInput.value;
  const cityVal  = evtCitySelect.value.trim(); // ← обрезаем пробелы
  const catVal   = evtCategoryInput.value.trim();

  if (!title || !desc || !dateVal || !cityVal || !catVal) {
    alert('Please fill in all fields.');
    return;
  }

  const newId = Date.now().toString();

  // 🧭 Берём координаты по названию города
  let lat = undefined;
  let lon = undefined;

  const coords = cityCoordsMap?.[cityVal];
  if (coords) {
    lat = parseFloat(coords.lat);
    lon = parseFloat(coords.lon);
  }

  // ⚠️ если координаты так и не нашлись — логгируем предупреждение
  if (isNaN(lat) || isNaN(lon)) {
    console.warn(`⚠️ No coordinates found for city "${cityVal}"`);
    lat = undefined;
    lon = undefined;
  }

  const newEvent = {
    id:          newId,
    city:        cityVal,
    title:       title,
    description: desc,
    date:        dateVal,
    category:    catVal,
    lat,
    lon
  };

  // Добавляем и рендерим
  events.push(newEvent);
  populateFilters();
  renderEvents();
  initEmbla();

  // Закрываем форму
  eventFormContainer.style.display = 'none';

  // Очищаем поля
  evtTitleInput.value = '';
  evtDescInput.value  = '';
  evtDateInput.value  = '';
  evtCitySelect.value = '';
  evtCategoryInput.value = '';
});

  // ─── 7. Embla Carousel Setup ─────────────────────────────────────
  let embla;
  function initEmbla() {
    const viewport = document.querySelector('.embla__viewport');
    if (!viewport) return;

    embla = EmblaCarousel(viewport, {
      loop: false,
      align: 'start',
      dragFree: true,
    });

    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');

    if (prevBtn && nextBtn) {
      prevBtn.addEventListener('click', () => embla.scrollPrev());
      nextBtn.addEventListener('click', () => embla.scrollNext());
    }
  }

  // Закрытие модалки
  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('event-modal').classList.add('hidden');
  });
});

// ─── MAP LOGIC ─────────────────────────────────────────────
const mapContainer = document.getElementById('map-container');
const mapCloseBtn = document.getElementById('map-close');
let mapInstance;

// Закрыть карту
mapCloseBtn.addEventListener('click', () => {
  mapContainer.classList.add('hidden');
});

// Показать карту
function showMap(lat = 35.0116, lon = 135.7681, label = "Kyoto") {
  mapContainer.classList.remove('hidden');

  if (!mapInstance) {
    mapInstance = L.map('map').setView([lat, lon], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstance);
  } else {
    mapInstance.setView([lat, lon], 13);
  }

  L.marker([lat, lon]).addTo(mapInstance)
    .bindPopup(label)
    .openPopup();
}
