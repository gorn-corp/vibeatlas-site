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
// ───  DOM-элементы для Add Event ─────────────────────────────────
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
        // Добавим тестовые события для Kyoto
    const now = new Date();
    const testKyotoEvents = [
      {
        id: 'kyoto1',
        city: 'Kyoto',
        title: 'Zen Meditation Workshop',
        description: 'Morning meditation in a 600-year-old temple.',
        date: new Date(now).toISOString(),
        category: 'Spiritual'
      },
      {
        id: 'kyoto2',
        city: 'Kyoto',
        title: 'Gion Matsuri Night Parade',
        description: 'The ancient float festival in full neon glow.',
        date: new Date(now.setDate(now.getDate() + 1)).toISOString(),
        category: 'Culture'
      },
      {
        id: 'kyoto3',
        city: 'Kyoto',
        title: 'Street Food Fiesta',
        description: 'Local snacks and tea tasting near Nishiki Market.',
        date: new Date(now.setDate(now.getDate() + 2)).toISOString(),
        category: 'Food'
      },
      {
        id: 'kyoto4',
        city: 'Kyoto',
        title: 'Anime Music Live',
        description: 'Orchestra playing Studio Ghibli and classics.',
        date: new Date(now.setDate(now.getDate() + 3)).toISOString(),
        category: 'Music'
      },
      {
        id: 'kyoto5',
        city: 'Kyoto',
        title: 'AI + Zen Symposium',
        description: 'Nova тоже будет, но в голограмме.',
        date: new Date(now.setDate(now.getDate() + 5)).toISOString(),
        category: 'Tech'
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
  // города из JSON
  cityFilter.innerHTML = `<option value="">All Cities</option>`;
  citiesList.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    cityFilter.appendChild(opt);
  });
  // Город (для формы Add Event):
  evtCitySelect.innerHTML = `<option value="">Select City</option>`;
  citiesList.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    evtCitySelect.appendChild(opt);
  });
  // категории (фильтр) 
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

  if (sortByDate) {
    filtered = filtered.sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );
  }

  const now = new Date();
  const today = filtered.filter(e => isSameDay(new Date(e.date), now));
  const tomorrow = filtered.filter(e => isSameDay(new Date(e.date), addDays(now, 1)));
  const later = filtered.filter(e => new Date(e.date) > addDays(now, 1));

  if (filtered.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'no-events';
    msg.textContent = 'No events found for this selection.';
    eventsContainer.appendChild(msg);
    return;
  }

  function renderGroup(title, list) {
    if (list.length === 0) return;
    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    titleEl.style.margin = '1rem 0 0.5rem';
    eventsContainer.appendChild(titleEl);

    list.forEach(e => {
      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
  <h3>${e.title}</h3>
  <p>${e.description}</p>
  <p><small>${new Date(e.date).toLocaleString()}</small></p>
  <p><em>${e.city} — ${e.category}</em></p>
  <button class="btn details-btn">View Details</button>
`;

      const slide = document.createElement('div');
      slide.className = 'embla__slide';
      slide.appendChild(card);
      eventsContainer.appendChild(slide);
    });
  }

  renderGroup("Today", today);
  renderGroup("Tomorrow", tomorrow);
  renderGroup("Upcoming", later);

  // Обработка кнопок "View Details"
eventsContainer.querySelectorAll('.details-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const card = e.target.closest('.event-card');
    if (!card) return;

    document.getElementById('modal-title').textContent = card.querySelector('h3').textContent;
    document.getElementById('modal-description').textContent = card.querySelector('p').textContent;
    document.getElementById('modal-date').textContent = card.querySelector('small')?.textContent || '';
    document.getElementById('modal-city').textContent = card.querySelector('em')?.textContent?.split(' — ')[0] || '';
    document.getElementById('modal-category').textContent = card.querySelector('em')?.textContent?.split(' — ')[1] || '';

    document.getElementById('event-modal').classList.remove('hidden');
  });
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
    initEmbla(); // 🔧 запускаем Embla после рендера
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

  // Показ формы
  addEventBtn.addEventListener('click', () => {
    eventFormContainer.style.display = 'flex';
  });

  // Отмена (скрытие) без добавления
  evtCancelBtn.addEventListener('click', () => {
    eventFormContainer.style.display = 'none';
  });

  // Обработка submit формы
  eventForm.addEventListener('submit', e => {
    e.preventDefault();
    // Простейшая валидация
    const title    = evtTitleInput.value.trim();
    const desc     = evtDescInput.value.trim();
    const dateVal  = evtDateInput.value;
    const cityVal  = evtCitySelect.value;
    const catVal   = evtCategoryInput.value.trim();

    if (!title || !desc || !dateVal || !cityVal || !catVal) {
      alert('Please fill in all fields.');
      return;
    }

    // Сгенерируем простое уникальное ID
    const newId = Date.now().toString();

    // Создаём объект события
    const newEvent = {
      id:          newId,
      city:        cityVal,
      title:       title,
      description: desc,
      date:        dateVal,
      category:    catVal
    };

    // Добавляем в массив и перерисовываем
    events.push(newEvent);

    // Обновляем фильтр категорий
    populateFilters();

    // Закрываем форму
    eventFormContainer.style.display = 'none';

    // Очищаем поля формы
    evtTitleInput.value = '';
    evtDescInput.value  = '';
    evtDateInput.value  = '';
    evtCitySelect.value = '';
    evtCategoryInput.value = '';

    // Рендерим события заново
    renderEvents();
    initEmbla();
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
