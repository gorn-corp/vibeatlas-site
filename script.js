// ─── 1. Imports and Helpers ─────────
import Papa from 'papaparse';
import EmblaCarousel from 'embla-carousel';
import { fetchWeather, getTimeOfDay } from './weather.js';

const API_KEY = '4fa7ffeee5d231eb59154b86e43cdbbe';

// 1.0.1. Language Detection and i18n //
const supportedLanguages = ['ar', 'de', 'en', 'fr', 'es', 'it', 'pt', 'ua', 'ja', 'zh'];
let currentLang = navigator.language.slice(0, 2);
if (!supportedLanguages.includes(currentLang)) currentLang = 'en';

let translations = {};

async function loadTranslations(lang = 'en') {
  try {
    const res = await fetch(`/locales/${lang}.json`);
    translations = await res.json();
    applyTranslations();
  } catch (err) {
    console.error(`❌ Failed to load translations for ${lang}`, err);
  }
}

function t(key) {
  return translations[key] || key;
}

// 🔧 Добавить до renderEvents (или до места, где вызывается isSameDay)
function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear()
    && date1.getMonth() === date2.getMonth()
    && date1.getDate() === date2.getDate();
}

// 1.0.2 Apply Translations //
function applyTranslations() {
  // Обновляем заголовок вкладки
  document.title = t('title');

  // Обновление вручную (если не попадает под data-i18n)
  const splashTitle     = document.getElementById('splash-title');
  const enterBtn        = document.getElementById('enter-btn');
  const tabSavedBtn     = document.querySelector('[data-tab="saved-tab"]');
  const tabSettingsBtn  = document.querySelector('[data-tab="settings-tab"]');
  const heroBtn         = document.getElementById('enter-hero-btn');

  if (splashTitle) splashTitle.textContent = t('title');
  if (enterBtn)    enterBtn.textContent    = t('get_started');
  if (heroBtn)     heroBtn.textContent     = t('get_started');
  if (tabSavedBtn)    tabSavedBtn.textContent = t('saved_events');
  if (tabSettingsBtn) tabSettingsBtn.textContent = t('settings');

  // Обновляем все элементы с data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = t(key);
    if (translation) el.textContent = translation;
  });

  // Обновляем плейсхолдеры
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const translation = t(key);
    if (translation) el.setAttribute('placeholder', translation);
  });

  // Обновляем текст <option> внутри <select>
  document.querySelectorAll('option[data-i18n]').forEach(opt => {
    const key = opt.getAttribute('data-i18n');
    const translation = t(key);
    if (translation) opt.textContent = translation;
  });

  // Дополнительно: плейсхолдер для поля категории (если не помечен data-i18n-placeholder)
  const catInput = document.getElementById('evt-category');
  if (catInput && t('category_placeholder')) {
    catInput.setAttribute('placeholder', t('category_placeholder'));
  }
  // Обновляем отображение профиля после смены языка
  if (typeof populateProfile === 'function') {
    populateProfile();
  }
}

// ─── 2. Constants and Variables ─────────
const defaultCity   = 'Kyoto';
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTwhCOoNnWCX5qUX_8KuIVoBHkohSlP_N4Rwedjr7z8lrhLWx064VnBRFicyoUXOxkQSpvDC92PwRJY/pub?output=csv';
const CITIES_JSON   = '/cities.json';

let events         = [];
let citiesList     = [];
let selectedCity   = defaultCity;
let cityCoordsMap  = {};
let savedEvents    = JSON.parse(localStorage.getItem('savedEvents') || '[]');
let pickedLat = null;
let pickedLon = null;
let editEventId = null;

// ─── 3. DOM Elements ─────────
const splash            = document.getElementById('splash');
const enterBtn          = document.getElementById('enter-btn');
const heroEnterBtn      = document.getElementById('enter-hero-btn');
const splashCityInput   = document.getElementById('splash-city-input');
const userBtn           = document.getElementById('user-btn');
const userPanel         = document.getElementById('user-panel');
const closeUserPanel    = document.getElementById('close-user-panel');
const savedEventsContainer = document.getElementById('saved-events-container');
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
const eventsContainer   = document.getElementById('events-container');
const favoritesOnlyCheckbox = document.getElementById('favorites-only');
const tabMyBtn          = document.querySelector('[data-tab="my-tab"]');
const tabMy             = document.getElementById('my-tab');
const tabSettings       = document.getElementById('settings-tab');
const tabSettingsBtn    = document.querySelector('[data-tab="settings-tab"]');
const langSwitcher      = document.getElementById('lang-switcher');

// ─── 4. Core Functions ─────────

// 4.0.0 Load cities list from public/cities.json //
async function loadCities() {
  try {
    const res = await fetch(CITIES_JSON);
    citiesList = await res.json();

    // Create map of coordinates by city name
    cityCoordsMap = {};
    citiesList.forEach(c => {
      cityCoordsMap[c.name.trim()] = {
        lat: parseFloat(c.lat),
        lon: parseFloat(c.lon)
      };
    });

    console.log('✅ cityCoordsMap:', cityCoordsMap);
    console.log('✅ cities loaded:', citiesList);

  } catch (err) {
    console.error('❌ loadCities error', err);
    citiesList = [];
  }
}

// 4.0 Load events from Google Sheets CSV //
async function loadEvents() {
  try {
    // 1) Попытка загрузить ранее сохранённые события из localStorage
    const storedEvents = JSON.parse(localStorage.getItem('events') || 'null');
    if (storedEvents && Array.isArray(storedEvents) && storedEvents.length) {
      // гарантируем, что id — строки
      events = storedEvents.map(e => ({ ...e, id: String(e.id) }));
      console.log('✅ Loaded events from localStorage:', events.length);
    } else {
      // 2) Если нет сохранённых — подтянуть CSV и сохранить
      const res    = await fetch(SHEET_CSV_URL);
      const csv    = await res.text();
      const parsed = Papa.parse(csv, { header: true, dynamicTyping: true });

      events = parsed.data
        .filter(r => r && (r.title || r.id))
        .map(r => ({
          id: String(r.id || `csv_${Date.now()}_${Math.random().toString(36).slice(2,6)}`),
          city: r.city || '',
          title: r.title || '',
          description: r.description || '',
          date: r.date || '',
          category: r.category || '',
          lat: (r.lat !== undefined && r.lat !== '') ? parseFloat(r.lat) : null,
          lon: (r.lon !== undefined && r.lon !== '') ? parseFloat(r.lon) : null,
          owner: r.owner || ''
        }));

      // Встроенные тестовые события (оставил два из твоего файла)
      const now = new Date();
      const testKyotoEvents = [
        {
          id: 'kyoto1',
          city: 'Kyoto',
          title: 'Zen Meditation Workshop',
          description: 'Morning meditation in a 600-year-old temple.',
          date: new Date(now.getTime()).toISOString(),
          category: 'Spiritual',
          lat: 35.0031,
          lon: 135.7788,
          owner: ''
        },
        {
          id: 'kyoto2',
          city: 'Kyoto',
          title: 'Gion Matsuri Night Parade',
          description: 'The ancient float festival in full neon glow.',
          date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          category: 'Festival',
          lat: 35.0039,
          lon: 135.7800,
          owner: ''
        }
      ];

      events = [...events, ...testKyotoEvents];

      // Сохраняем в localStorage, чтобы в следующий раз загружалось оттуда
      localStorage.setItem('events', JSON.stringify(events));
      console.log('✅ Fetched CSV and saved events to localStorage. Total:', events.length);
    }

    // 3) Если пользователь залогинен — подмешать его персональные события (my_events_<email>)
    const storedUser = JSON.parse(localStorage.getItem('vibe_user') || '{}');
    if (storedUser?.email) {
      const key = `my_events_${storedUser.email}`;
      const myEvents = JSON.parse(localStorage.getItem(key) || '[]');

      // Подмешиваем события пользователя (если их ещё нет в events)
      myEvents.forEach(me => {
        if (!events.find(ev => String(ev.id) === String(me.id))) {
          events.push(me);
        }
      });

      // Обозначаем события, которые присутствуют в myEvents, как принадлежащие текущему пользователю,
      // но только если у них нет явного owner (чтобы не перезаписывать реальные владельцы).
      try {
        const myIds = myEvents.map(me => String(me.id));
        events = events.map(ev => {
          if (ev && myIds.includes(String(ev.id)) && (!ev.owner || String(ev.owner).trim() === '')) {
            return { ...ev, owner: storedUser.email };
          }
          return ev;
        });
      } catch (err) {
        // noop — не ломаем загрузку из-за ошибки в тестовых данных
        console.warn('⚠️ loadEvents: error while marking myEvents owner', err);
      }

      // Обновляем глобальное хранилище — теперь в events есть всё
      localStorage.setItem('events', JSON.stringify(events));
    }

    populateFilters();
    renderEvents();
    initEmbla();

  } catch (err) {
    console.error('❌ loadEvents error:', err);
    // fallback: попытка загрузить только из localStorage
    const stored = JSON.parse(localStorage.getItem('events') || '[]');
    events = stored || [];
    populateFilters();
    renderEvents();
    initEmbla();
  }
}

// 4.1 Fetch and display weather //
async function update(city) {
  try {
    await fetchWeather(city);
  } catch (e) {
    console.error(e);
    alert(`Could not fetch weather for "${city}"`);
  }
}

// 4.2 Time-of-day theme //
function applyTimeTheme() {
  const phase = getTimeOfDay(); // 'morning'|'day'|'evening'|'night'
  document.body.classList.add(`theme-${phase}`);
}

// 4.3 City background //
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

// 4.4 Populate filters //
function populateFilters() {
  if (!cityFilter || !categoryFilter) {
    console.warn('❌ Filters (city/category) not found.');
    return;
  }

  // Собираем объединённый список городов из citiesList и events
  const citiesFromConfig = citiesList.map(c => c.name.trim());
  const citiesFromEvents = [...new Set(events.map(e => e.city))];
  const allCities = Array.from(new Set([...citiesFromConfig, ...citiesFromEvents])).sort();

  // Cities filter
  cityFilter.innerHTML = `<option value="" data-i18n="all_cities">${t('all_cities')}</option>`;
  allCities.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    cityFilter.appendChild(opt);
  });

  // For Add Event form
if (evtCitySelect) {
  evtCitySelect.innerHTML = `<option value="" data-i18n="select_city">${t('select_city')}</option>`;
  allCities.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    evtCitySelect.appendChild(opt);
  });
}

// For Edit Event form
const editCitySelect = document.getElementById('edit-evt-city');
if (editCitySelect) {
  editCitySelect.innerHTML = `<option value="" data-i18n="select_city">${t('select_city')}</option>`;
  allCities.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    editCitySelect.appendChild(opt);
  });
}

  // Categories filter
  const catList = [...new Set(events.map(e => e.category).filter(Boolean))].sort();
  categoryFilter.innerHTML = `<option value="" data-i18n="all_categories">${t('all_categories')}</option>`;
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

    opt.textContent = `${emojis[cat] || ''} ${cat}`.trim();
    categoryFilter.appendChild(opt);
  });
}

// 4.5 Render events //
function renderEvents() {
  eventsContainer.innerHTML = '';
  const showOnlyFavorites = favoritesOnlyCheckbox?.checked;

  const now = new Date();
  const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const currentUser = JSON.parse(localStorage.getItem('vibe_user') || '{}');

  const allFiltered = events
    .filter(e => e.city === selectedCity)
    .filter(e => (!cityFilter?.value || e.city === cityFilter.value))
    .filter(e => (!categoryFilter?.value || e.category === categoryFilter.value))
    .filter(e => !showOnlyFavorites || savedEvents.includes(String(e.id)))
    .filter(e => {
      if (!e.private) return true;
      return e.owner === currentUser?.email;
    });

  const query = searchInput?.value.trim().toLowerCase();
  let filtered = allFiltered;

  if (query) {
    filtered = filtered.filter(e =>
      e.title.toLowerCase().includes(query) ||
      e.description.toLowerCase().includes(query)
    );
  }

  filtered = filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

  const today    = filtered.filter(e => isSameDay(new Date(e.date), now));
  const tomorrow = filtered.filter(e => isSameDay(new Date(e.date), tomorrowDate));
  const later    = filtered.filter(e => new Date(e.date) > tomorrowDate);

  if (filtered.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'no-events';
    msg.textContent = t('no_events_found');
    eventsContainer.appendChild(msg);
    return;
  }

  function renderGroup(titleKey, list) {
    if (list.length === 0) return;
    const titleEl = document.createElement('h3');
    titleEl.textContent = t(titleKey);
    titleEl.setAttribute('data-i18n', titleKey);
    titleEl.style.margin = '1rem 0 0.5rem';
    eventsContainer.appendChild(titleEl);

    list.forEach(e => {
      const card = document.createElement('div');
      card.className = 'event-card';
      card.dataset.id = e.id;

      const privateTag = e.private ? `<span class="private-tag">🔒 ${t('private_event')}</span><br />` : '';

      let countdownHtml = '';
      if (isSameDay(new Date(e.date), now)) {
        const diffMs = new Date(e.date) - now;
        const hours   = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        countdownHtml = diffMs <= 0
          ? `<p class="countdown">${t('event_started')}</p>`
          : `<p class="countdown">${t('starts_in').replace('{hours}', hours).replace('{minutes}', minutes)}</p>`;
      }

      const isSaved = savedEvents.includes(String(e.id));
      const isMine = e.owner === currentUser.email;
      const showSaveButton = !(isMine && e.private);

      card.innerHTML = `
        ${privateTag}
        <h3>${e.title}</h3>
        <p>${e.description}</p>
        <p><small>${new Date(e.date).toLocaleString(currentLang)}</small></p>
        <p><em>${e.city} — ${e.category}</em></p>
        <div class="event-actions">
          <button class="btn details-btn" data-i18n="view_details">${t('view_details')}</button>
          <button class="btn map-btn" data-i18n="show_on_map">${t('show_on_map')}</button>
          ${showSaveButton ? `<button class="btn save-btn" data-i18n="${isSaved ? 'saved_event' : 'save_event'}">${t(isSaved ? 'saved_event' : 'save_event')}</button>` : ''}
        </div>
        ${countdownHtml}
      `;

      const slide = document.createElement('div');
      slide.className = 'embla__slide';
      slide.appendChild(card);
      eventsContainer.appendChild(slide);

      card.querySelector('.details-btn')?.addEventListener('click', () => {
        const ev = e;
        document.getElementById('modal-title').textContent       = ev.title;
        document.getElementById('modal-description').textContent = ev.description;
        document.getElementById('modal-date').textContent        = `${t('modal_date')}: ${new Date(ev.date).toLocaleString(currentLang)}`;
        document.getElementById('modal-city').textContent        = `${t('modal_city')}: ${ev.city}`;
        document.getElementById('modal-category').textContent    = `${t('modal_category')}: ${ev.category}`;

        const modalAddr = document.getElementById('modal-address');
        if (modalAddr) modalAddr.textContent = ev.address || '—';

        const privBlock = document.getElementById('modal-private');
        if (privBlock) privBlock.classList.add('hidden');

        document.getElementById('event-modal').classList.remove('hidden');
        loadEventWeather(ev.city, ev.date);

        setTimeout(() => {
          const lat = parseFloat(ev.lat);
          const lon = parseFloat(ev.lon);
          const mapEl = document.getElementById('modal-map');
          if (!isNaN(lat) && !isNaN(lon)) {
            while (mapEl.firstChild) mapEl.removeChild(mapEl.firstChild);
            if (mapEl._leaflet_id) mapEl._leaflet_id = null;
            if (window._modalMap) {
              window._modalMap.remove();
              window._modalMap = null;
            }
            const modalMap = L.map(mapEl, {
              attributionControl: false,
              zoomControl: false,
              dragging: false
            }).setView([lat, lon], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(modalMap);
            L.marker([lat, lon]).addTo(modalMap).bindPopup(ev.title).openPopup();
            window._modalMap = modalMap;

            document.getElementById('modal-close').addEventListener('click', () => {
              modalMap.remove();
              window._modalMap = null;
            }, { once: true });
          } else {
            mapEl.innerHTML = `<p style="color:gray;">${t('no_map')}</p>`;
          }
        }, 100);
      });

      card.querySelector('.map-btn')?.addEventListener('click', () => {
        const lat = parseFloat(e.lat);
        const lon = parseFloat(e.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          showMap(lat, lon, e.title);
        } else {
          alert(t('no_coordinates'));
        }
      });

      card.querySelector('.save-btn')?.addEventListener('click', () => {
        toggleSaveEvent(e.id);
      });
    });
  }

  renderGroup("event_today", today);
  renderGroup("event_tomorrow", tomorrow);
  renderGroup("event_upcoming", later);
  applyTranslations();
}

// Toggle save/unsave event //
function toggleSaveEvent(id) {
  const idStr = String(id);
  const idx = savedEvents.indexOf(idStr);
  if (idx > -1) {
    savedEvents.splice(idx, 1);
  } else {
    savedEvents.push(idStr);
  }
  localStorage.setItem('savedEvents', JSON.stringify(savedEvents));
  renderEvents();
}

// ─── 5. Initialization and Event Listeners ─────────
window.addEventListener('DOMContentLoaded', async () => {
  // 5.0 Load Translations //
  await loadTranslations(currentLang);

  // 5.1 Language Switcher //
  if (langSwitcher) {
    supportedLanguages.forEach(lang => {
      const opt = document.createElement('option');
      opt.value = lang;
      opt.textContent = lang.toUpperCase();
      langSwitcher.appendChild(opt);
    });
    langSwitcher.value = currentLang;

    langSwitcher.addEventListener('change', async () => {
      currentLang = langSwitcher.value;
      await loadTranslations(currentLang);
      applyTranslations();
    });
  }

  // 5.2 Load core data //
  await loadCities();
  await loadEvents();

  // 🧼 Set min/max for evt-date input (±100 years)
  const evtDateInput = document.getElementById('evt-date');
  if (evtDateInput) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const pad = n => n.toString().padStart(2, '0');

    const minDate = `${currentYear - 100}-01-01T00:00`;
    const maxDate = `${currentYear + 100}-12-31T23:59`;

    evtDateInput.min = minDate;
    evtDateInput.max = maxDate;
  }

  // 5.3 Splash input and button //
  const splashInput = document.getElementById('splash-city-input');
  const splashBtn   = document.getElementById('enter-btn');
  const GEODB_API_KEY = '4fa7ffeee5d231eb59154b86e43cdbbe';

  if (splashInput && splashBtn) {
    splashInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        splashBtn.click();
      }
    });

    splashBtn.addEventListener('click', async () => {
      const city = splashInput.value.trim() || defaultCity;
      selectedCity = city;
      splash.style.display = 'none';

      // Проверяем, есть ли уже координаты для этого города
      if (!cityCoordsMap[city]) {
        try {
          const response = await fetch(`https://geodb-free-service.wirefreethought.com/v1/geo/cities?limit=1&namePrefix=${encodeURIComponent(city)}`, {
            headers: { 'X-RapidAPI-Key': GEODB_API_KEY }
          });

          const data = await response.json();
          const result = data?.data?.[0];

          if (result && result.latitude && result.longitude) {
            cityCoordsMap[city] = { lat: result.latitude, lon: result.longitude };

            // Временно добавляем город в citiesList
            citiesList.push({
              name: city,
              lat: result.latitude,
              lon: result.longitude,
              background: '' // Пусто, если нет картинки
            });
          } else {
            alert(`⚠️ City "${city}" not found.`);
            return;
          }
        } catch (err) {
          console.error('City fetch error:', err);
          alert('❌ Failed to fetch city data.');
          return;
        }
      }

      update(city);
      applyTimeTheme();
      applyCityBackground(city);
      populateFilters();
      cityFilter.value = selectedCity;
      renderEvents();
      initEmbla();
    });
  } else {
    console.warn("❌ splashInput or splashBtn not found in DOM");
  }

  // 5.4 Hero enter button //
  const heroEnterBtn = document.getElementById('enter-hero-btn');
  if (heroEnterBtn && splashBtn) {
    heroEnterBtn.addEventListener('click', () => splashBtn.click());
  } else {
    console.warn('⚠️ heroEnterBtn or splashBtn not found in DOM');
  }

  // 5.5 Live search //
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderEvents();
      initEmbla();
    });
  }

  // 5.6 City filter //
  if (cityFilter) {
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
  }

  // 5.7 Category filter //
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      renderEvents();
      initEmbla();
    });
  }

  // 5.8 Favorites checkbox //
  if (favoritesOnlyCheckbox) {
    favoritesOnlyCheckbox.addEventListener('change', () => {
      showOnlyFavorites = favoritesOnlyCheckbox.checked;
      renderEvents();
      initEmbla();
    });
  }
});

document.getElementById('toggle-profile-details')?.addEventListener('click', () => {
  const details = document.getElementById('profile-extra');
  if (details) {
    details.style.display = details.style.display === 'none' ? 'block' : 'none';
  }
});

// ─── 6. Show/Hide Add Event Form ─────────
if (addEventBtn && eventFormContainer) {
  addEventBtn.addEventListener('click', () => {
    editEventId = null; // сбрасываем режим редактирования
    eventFormContainer.style.display = 'flex';

    const titleEl = eventFormContainer.querySelector('h3');
    const submitBtn = eventFormContainer.querySelector('button[type="submit"]');
    if (titleEl) titleEl.textContent = t('add_event_title'); // стандартный заголовок
    if (submitBtn) submitBtn.textContent = t('submit_event');

    if (evtTitleInput) evtTitleInput.value = '';
    if (evtDescInput) evtDescInput.value = '';
    if (evtDateInput) evtDateInput.value = '';
    if (evtCitySelect) evtCitySelect.value = '';
    if (evtCategoryInput) evtCategoryInput.value = '';
    const addrInput = document.getElementById('evt-address');
    if (addrInput) addrInput.value = '';
    const coordsEl = document.getElementById('picked-coords');
    if (coordsEl) coordsEl.textContent = '—';
    const privateCheckbox = document.getElementById('evt-private');
    if (privateCheckbox) privateCheckbox.checked = false;
    pickedLat = null;
    pickedLon = null;

    const closeTopBtn = document.getElementById('evt-close-top');
    if (closeTopBtn && eventFormContainer) {
      closeTopBtn.addEventListener('click', () => {
        eventFormContainer.style.display = 'none';
      });
    }

    const mapContainer = document.getElementById('map-container');
    const addressInput = document.getElementById('evt-address');

    if (!window._eventMap && mapContainer) {
      const defaultLat = 35.0116;
      const defaultLon = 135.7681;

      window._eventMap = L.map(mapContainer).setView([defaultLat, defaultLon], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(window._eventMap);

      window._eventMarker = L.marker([defaultLat, defaultLon], { draggable: true }).addTo(window._eventMap);

      const reverseGeocode = async (lat, lon) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
          const data = await res.json();
          if (data && data.display_name && addressInput) {
            addressInput.value = data.display_name;
          }
        } catch (err) {
          console.warn('Failed to fetch address:', err);
        }
      };

      window._eventMarker.on('moveend', e => {
        const { lat, lng } = e.target.getLatLng();
        reverseGeocode(lat, lng);
      });

      window._eventMap.on('click', e => {
        window._eventMarker.setLatLng(e.latlng);
        reverseGeocode(e.latlng.lat, e.latlng.lng);
      });
    }
  });
}

// ─── 6.1 Cancel Button ─────────
if (evtCancelBtn && eventFormContainer) {
  evtCancelBtn.addEventListener('click', () => {
    eventFormContainer.style.display = 'none';
    editEventId = null; // сбросить флаг редактирования
  });
}

// ─── 6.2 City → Координаты ─────────
if (evtCitySelect) {
  evtCitySelect.addEventListener('change', () => {
    const selected = evtCitySelect.value;
    const coords = cityCoordsMap?.[selected];
    const addressInput = document.getElementById('evt-address');

    if (coords && window._eventMap && window._eventMarker) {
      const lat = parseFloat(coords.lat);
      const lon = parseFloat(coords.lon);
      window._eventMap.setView([lat, lon], 13);
      window._eventMarker.setLatLng([lat, lon]);

      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
        .then(res => res.json())
        .then(data => {
          if (data?.display_name && addressInput) {
            addressInput.value = data.display_name;
          }
        });
    }
  });
}

// ─── 6.3 Submit Event (Create or Edit) ─────────
if (eventForm) {
  eventForm.addEventListener('submit', e => {
    e.preventDefault();

    const mode = eventForm.getAttribute('data-mode') || 'add';
    const title     = evtTitleInput.value.trim();
    const desc      = evtDescInput.value.trim();
    const dateVal   = evtDateInput.value;
    const cityVal   = evtCitySelect.value.trim();
    const catVal    = evtCategoryInput.value.trim();
    const address   = document.getElementById('evt-address')?.value.trim();
    const isPrivate = document.getElementById('evt-private')?.checked;

    if (!title || !desc || !dateVal || !cityVal || !catVal) {
      alert('Please fill in all fields.');
      return;
    }

    const dateObj = new Date(dateVal);
    const year = dateObj.getFullYear();
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 100;
    const maxYear = currentYear + 100;

    if (isNaN(dateObj.getTime()) || year < minYear || year > maxYear) {
      alert(`⚠️ Please enter a valid date between ${minYear} and ${maxYear}.`);
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem('vibe_user') || '{}');
    if (!currentUser?.email) {
      alert('Please log in with email to create events.');
      return;
    }

    const newId = (mode === 'edit' && editEventId) ? editEventId : Date.now().toString();

    const newEvent = {
      id: String(newId),
      city: cityVal,
      title,
      description: desc,
      date: dateVal,
      category: catVal,
      address: address || '',
      lat: pickedLat,
      lon: pickedLon,
      private: !!isPrivate,
      owner: currentUser.email
    };

    if (mode === 'edit' && editEventId) {
      // Обновляем глобальный массив
      const index = events.findIndex(ev => String(ev.id) === String(editEventId));
      if (index !== -1) events[index] = newEvent;
      // Обновляем персональное хранилище пользователя
      const key = `my_events_${currentUser.email}`;
      let myEvents = JSON.parse(localStorage.getItem(key) || '[]');
      const myIndex = myEvents.findIndex(ev => String(ev.id) === String(editEventId));
      if (myIndex !== -1) myEvents[myIndex] = newEvent;
      else myEvents.push(newEvent);
      localStorage.setItem(key, JSON.stringify(myEvents));
      editEventId = null;
    } else {
      // Добавляем новое событие
      events.push(newEvent);
      const key = `my_events_${currentUser.email}`;
      const myEvents = JSON.parse(localStorage.getItem(key) || '[]');
      myEvents.push(newEvent);
      localStorage.setItem(key, JSON.stringify(myEvents));
    }

    // Сохраняем глобальную коллекцию событий
    localStorage.setItem('events', JSON.stringify(events));

    populateFilters();
    renderEvents();
    if (typeof renderMyEvents === 'function') renderMyEvents();

    // Сброс и закрытие формы
    eventFormContainer.style.display = 'none';
    eventForm.setAttribute('data-mode', 'add');

    evtTitleInput.value = '';
    evtDescInput.value = '';
    evtDateInput.value = '';
    evtCitySelect.value = '';
    evtCategoryInput.value = '';
    const addrInput = document.getElementById('evt-address');
    if (addrInput) addrInput.value = '';
    const coordsEl = document.getElementById('picked-coords');
    if (coordsEl) coordsEl.textContent = '—';
    const privateCheckbox = document.getElementById('evt-private');
    if (privateCheckbox) privateCheckbox.checked = false;
    pickedLat = null;
    pickedLon = null;
  });
}

// ─── 6.3.1 Submit Edited Event ───────────────
const editForm = document.getElementById('edit-event-form');

if (editForm) {
  editForm.addEventListener('submit', e => {
    e.preventDefault();

    const title     = document.getElementById('edit-evt-title').value.trim();
    const desc      = document.getElementById('edit-evt-desc').value.trim();
    const dateVal   = document.getElementById('edit-evt-date').value;
    const cityVal   = document.getElementById('edit-evt-city').value.trim();
    const catVal    = document.getElementById('edit-evt-category').value.trim();
    const address   = document.getElementById('edit-evt-address')?.value.trim();
    const isPrivate = document.getElementById('edit-evt-private')?.checked;

    if (!title || !desc || !dateVal || !cityVal || !catVal) {
      alert('Please fill in all fields.');
      return;
    }

    const dateObj = new Date(dateVal);
    const year = dateObj.getFullYear();
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 100;
    const maxYear = currentYear + 100;

    if (isNaN(dateObj.getTime()) || year < minYear || year > maxYear) {
      alert(`⚠️ Please enter a valid date between ${minYear} and ${maxYear}.`);
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem('vibe_user') || '{}');
    if (!currentUser?.email) {
      alert('Please log in with email to edit events.');
      return;
    }

    const index = events.findIndex(ev => String(ev.id) === String(editEventId));
    if (index === -1) {
      alert('Event not found.');
      return;
    }

    const updated = {
      id: String(editEventId),
      city: cityVal,
      title,
      description: desc,
      date: dateVal,
      category: catVal,
      address: address || '',
      lat: pickedLat,
      lon: pickedLon,
      private: !!isPrivate,
      owner: currentUser.email
    };

    events[index] = updated;

    // Сохраняем глобально
    localStorage.setItem('events', JSON.stringify(events));

    // Обновляем персональное хранилище
    const key = `my_events_${currentUser.email}`;
    let myEvents = JSON.parse(localStorage.getItem(key) || '[]');
    const mi = myEvents.findIndex(ev => String(ev.id) === String(editEventId));
    if (mi !== -1) myEvents[mi] = updated;
    else myEvents.push(updated);
    localStorage.setItem(key, JSON.stringify(myEvents));

    editEventId = null;
    populateFilters();
    renderEvents();
    if (typeof renderMyEvents === 'function') renderMyEvents();

    document.getElementById('edit-event-form-container').style.display = 'none';
  });
}

// ─── 6.3.2 Cancel Edit Event ───────────────
const editCancelBtn = document.getElementById('edit-evt-cancel-btn');
if (editCancelBtn) {
  editCancelBtn.addEventListener('click', () => {
    document.getElementById('edit-event-form-container').style.display = 'none';
    editEventId = null;
    pickedLat = null;
    pickedLon = null;
  });
}

// 6.4 Pick on Map for Location //
const pickBtn = document.getElementById('pick-location');
const pickedCoordsDisplay = document.getElementById('picked-coords');
const addressInput = document.getElementById('evt-address');
const userEventsKey = 'my_events';

if (pickBtn && pickedCoordsDisplay && addressInput) {
  pickBtn.addEventListener('click', () => {
    if (document.getElementById('map-popup')) return;

    // Определяем координаты выбранного города из выпадашки
    let startLat = 35.0116;
    let startLon = 135.7681;
    const selectedCity = document.getElementById('city-filter')?.value;
    if (selectedCity && Array.isArray(citiesList)) {
      const cityObj = citiesList.find(c => c.name === selectedCity);
      if (cityObj) {
        startLat = cityObj.lat;
        startLon = cityObj.lon;
      }
    }

    const modal = document.createElement('div');
    modal.id = 'map-popup';
    modal.style.position = 'fixed';
    modal.style.top = 0;
    modal.style.left = 0;
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.zIndex = 9999;
    modal.style.background = '#000000b0';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = '80%';
    wrapper.style.height = '80%';
    wrapper.style.borderRadius = '8px';
    wrapper.style.overflow = 'hidden';
    modal.appendChild(wrapper);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '10px';
    closeBtn.style.right = '15px';
    closeBtn.style.zIndex = 1000;
    closeBtn.style.fontSize = '1.5rem';
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = 'white';
    closeBtn.style.border = 'none';
    closeBtn.style.cursor = 'pointer';
    wrapper.appendChild(closeBtn);

    const mapDiv = document.createElement('div');
    mapDiv.style.width = '100%';
    mapDiv.style.height = '100%';
    wrapper.appendChild(mapDiv);

    document.body.appendChild(modal);

    const map = L.map(mapDiv).setView([startLat, startLon], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    let marker = null;
    map.on('click', e => {
      if (marker) map.removeLayer(marker);
      marker = L.marker(e.latlng).addTo(map);

      pickedLat = e.latlng.lat;
      pickedLon = e.latlng.lng;

      pickedCoordsDisplay.textContent = `${pickedLat.toFixed(4)}, ${pickedLon.toFixed(4)}`;
      pickedCoordsDisplay.style.color = '#aaa';

      fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pickedLat}&lon=${pickedLon}`)
        .then(res => res.json())
        .then(data => {
          if (data?.display_name) {
            addressInput.value = data.display_name;
          }
        })
        .catch(err => console.warn('Geocoding error:', err));
    });

    closeBtn.addEventListener('click', () => {
      map.remove();
      modal.remove();
    });

    modal.addEventListener('click', e => {
      if (e.target === modal) {
        map.remove();
        modal.remove();
      }
    });
  });
}

// 6.4b Pick on Map for Editing Event //
const editPickBtn = document.getElementById('edit-pick-location');
const editCoordsDisplay = document.getElementById('edit-picked-coords');
const editAddressInput = document.getElementById('edit-evt-address');

if (editPickBtn && editCoordsDisplay && editAddressInput) {
  editPickBtn.addEventListener('click', () => {
    if (document.getElementById('map-popup')) return;

    let startLat = 35.0116;
    let startLon = 135.7681;
    const selectedCity = document.getElementById('edit-evt-city')?.value;
    if (selectedCity && Array.isArray(citiesList)) {
      const cityObj = citiesList.find(c => c.name === selectedCity);
      if (cityObj) {
        startLat = cityObj.lat;
        startLon = cityObj.lon;
      }
    }

    const modal = document.createElement('div');
    modal.id = 'map-popup';
    modal.style.position = 'fixed';
    modal.style.top = 0;
    modal.style.left = 0;
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.zIndex = 9999;
    modal.style.background = '#000000b0';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = '80%';
    wrapper.style.height = '80%';
    wrapper.style.borderRadius = '8px';
    wrapper.style.overflow = 'hidden';
    modal.appendChild(wrapper);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '10px';
    closeBtn.style.right = '15px';
    closeBtn.style.zIndex = 1000;
    closeBtn.style.fontSize = '1.5rem';
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = 'white';
    closeBtn.style.border = 'none';
    closeBtn.style.cursor = 'pointer';
    wrapper.appendChild(closeBtn);

    const mapDiv = document.createElement('div');
    mapDiv.style.width = '100%';
    mapDiv.style.height = '100%';
    wrapper.appendChild(mapDiv);

    document.body.appendChild(modal);

    const map = L.map(mapDiv).setView([startLat, startLon], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    let marker = null;
    map.on('click', e => {
      if (marker) map.removeLayer(marker);
      marker = L.marker(e.latlng).addTo(map);

      pickedLat = e.latlng.lat;
      pickedLon = e.latlng.lng;

      editCoordsDisplay.textContent = `${pickedLat.toFixed(4)}, ${pickedLon.toFixed(4)}`;
      editCoordsDisplay.style.color = '#aaa';

      fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pickedLat}&lon=${pickedLon}`)
        .then(res => res.json())
        .then(data => {
          if (data?.display_name) {
            editAddressInput.value = data.display_name;
          }
        })
        .catch(err => console.warn('Geocoding error:', err));
    });

    closeBtn.addEventListener('click', () => {
      map.remove();
      modal.remove();
    });

    modal.addEventListener('click', e => {
      if (e.target === modal) {
        map.remove();
        modal.remove();
      }
    });
  });
}

// 6.5 Save My Events Separately //
function saveMyEvent(eventObj) {
  const user = JSON.parse(localStorage.getItem('vibe_user') || '{}');
  if (!user?.email) return;

  const key = `${userEventsKey}_${user.email}`;
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  list.push(eventObj);
  localStorage.setItem(key, JSON.stringify(list));
}

// ─── 7. Embla Carousel Setup ─────────
let embla;
function initEmbla() {
  const viewport = document.querySelector('.embla__viewport');
  if (!viewport) {
    console.warn('⚠️ Embla viewport not found.');
    return;
  }

  // Удаляем старый инстанс если он уже есть
  if (embla && embla.destroy) {
    embla.destroy();
  }

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

// Close modal window
document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('event-modal').classList.add('hidden');
});

// ─── 8. User Panel: Open/Close and Custom Buttons ─────────

// Ожидаю, что переменные userBtn, userPanel, closeUserPanel уже объявлены выше
userBtn.addEventListener('click', () => {
  userPanel.classList.add('open');
  hideAllTabs();        // при открытии скрываем всё
  deactivateAllButtons();
});

closeUserPanel.addEventListener('click', () => {
  userPanel.classList.remove('open');
});

// Profile Details toggle
document.getElementById('toggle-profile-details')?.addEventListener('click', () => {
  const extra = document.getElementById('profile-extra');
  if (extra) {
    const isHidden = extra.style.display === 'none' || extra.style.display === '';
    extra.style.display = isHidden ? 'block' : 'none';
  }
});

// Memory Mode toggle
document.getElementById('toggle-memory-mode')?.addEventListener('click', () => {
  const memoryOptions = document.getElementById('memory-mode-options');
  if (memoryOptions) memoryOptions.classList.toggle('hidden');

  const mmBtn = document.getElementById('toggle-memory-mode');
  if (mmBtn && !mmBtn.dataset.i18n) mmBtn.textContent = '🧠 Memory Mode';
});

// Events toggle
document.getElementById('toggle-events-tab')?.addEventListener('click', () => {
  toggleTab('my-tab', 'toggle-events-tab', renderMyEvents);
});

// Archive toggle
document.getElementById('toggle-archive-tab')?.addEventListener('click', () => {
  toggleTab('archive-tab', 'toggle-archive-tab', renderArchiveEvents);
});

// Settings toggle
document.getElementById('toggle-settings-btn')?.addEventListener('click', () => {
  toggleTab('settings-tab', 'toggle-settings-btn', populateProfile);
});

// универсальная функция переключения
function toggleTab(tabId, btnId, callback) {
  const tab = document.getElementById(tabId);
  const btn = document.getElementById(btnId);
  const isVisible = tab && tab.classList.contains('active');

  hideAllTabs();
  deactivateAllButtons();

  if (!isVisible) {
    if (tab) {
      tab.classList.add('active');
      tab.classList.remove('hidden');
    }
    if (btn) btn.classList.add('active');
    if (typeof callback === 'function') callback();
  }
}

// helper: скрыть все табы
function hideAllTabs() {
  ['my-tab', 'archive-tab', 'settings-tab'].forEach(tabId => {
    const tab = document.getElementById(tabId);
    if (tab) {
      tab.classList.remove('active', 'hidden');
      tab.classList.add('hidden');
    }
  });
}

// helper: убрать active со всех кнопок
function deactivateAllButtons() {
  ['toggle-events-tab', 'toggle-archive-tab', 'toggle-settings-btn'].forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.remove('active');
  });
}

// 8.1 User Login Logic //
const loginSubmit = document.getElementById('login-submit');

loginSubmit?.addEventListener('click', () => {
  const name = document.getElementById('login-name').value.trim();
  const role = document.getElementById('login-role').value;
  const avatarInput = document.getElementById('login-avatar');
  const file = avatarInput.files[0];

  // Новые поля
  const surname = (document.getElementById('login-surname') || {}).value?.trim() || '';
  const email   = (document.getElementById('login-email') || {}).value?.trim() || '';
  const country = (document.getElementById('login-country') || {}).value?.trim() || '';
  const city    = (document.getElementById('login-city') || {}).value?.trim() || '';
  const phone   = (document.getElementById('login-phone') || {}).value?.trim() || '';

  if (!name) {
    alert('Please enter your name.');
    return;
  }

  const saveUser = (avatarBase64 = '') => {
    const user = {
  name,
  lastName: surname,
  role,
  avatar: avatarBase64,
  email,
  country,
  city,
  phone
};

    localStorage.setItem('vibe_user', JSON.stringify(user));
    loginModal.classList.add('hidden');
    loginBtn.textContent = `👤 ${name}`;
    applyTranslations();

    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl && avatarBase64) {
      avatarEl.src = avatarBase64;
      avatarEl.classList.remove('hidden');
    }

    // 👤 Обновление имени и роли в user panel
    const nameEl = document.getElementById('user-name-display');
    const roleEl = document.getElementById('user-role-display');
    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = role === 'organizer' ? 'Organizer' : 'User';

    // 🧾 Дополнительные поля (если блоки существуют)
    const emailEl   = document.getElementById('profile-email');
    const countryEl = document.getElementById('profile-country');
    const cityEl    = document.getElementById('profile-city');
    const phoneEl   = document.getElementById('profile-phone');

    if (emailEl)   emailEl.textContent = email;
    if (countryEl) countryEl.textContent = country;
    if (cityEl)    cityEl.textContent = city;
    if (phoneEl)   phoneEl.textContent = phone;
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      saveUser(reader.result);
    };
    reader.readAsDataURL(file);
  } else {
    saveUser();
  }
});

// 8.2 Restore User From Storage //
document.addEventListener('DOMContentLoaded', () => {
  let rawUser = localStorage.getItem('vibe_user');
  let storedUser = {};

  try {
    storedUser = typeof rawUser === 'string' ? JSON.parse(rawUser) : {};
  } catch (e) {
    console.warn('Invalid vibe_user in localStorage:', e);
  }

  const key = storedUser?.email ? `my_events_${storedUser.email}` : null;
  const storedMyEvents = key ? JSON.parse(localStorage.getItem(key) || '[]') : [];

  if (Array.isArray(storedMyEvents)) {
    for (const e of storedMyEvents) {
      if (!events.some(ev => ev.id === e.id)) {
        events.push(e);
      }
    }
  }

  if (storedUser) {
    const user = storedUser;
    const loginBtn = document.getElementById('user-btn');
    if (user?.name && loginBtn) {
      loginBtn.textContent = `👤 ${user.name}`;
    }

    // Показываем аватар
    if (user?.avatar) {
      const avatarEl = document.getElementById('user-avatar');
      if (avatarEl) {
        avatarEl.src = user.avatar;
        avatarEl.classList.remove('hidden');
      }
    }

    // Показываем роль в user panel
    const roleEl = document.getElementById('user-role-display');
    if (user?.role && roleEl) {
      const key = user.role === 'organizer' ? 'login_role_organizer' : 'login_role_user';
      roleEl.textContent = t(key);
    }

    // 🛠️ Подставляем first/last name в отдельные спаны
    const firstSpan = document.getElementById('display-first');
    const lastSpan  = document.getElementById('display-last');
    if (firstSpan) firstSpan.textContent = user.name || '';
    if (lastSpan)  lastSpan.textContent  = user.lastName || '';

    // ✅ Восстанавливаем доп. данные профиля
    const emailEl     = document.getElementById('profile-email');
    const cityEl      = document.getElementById('profile-city');
    const countryEl   = document.getElementById('profile-country');
    const phoneEl     = document.getElementById('profile-phone');
    const lastNameEl  = document.getElementById('profile-lastname'); 

    if (emailEl)     emailEl.textContent     = user.email     || '—';
    if (cityEl)      cityEl.textContent      = user.city      || '—';
    if (countryEl)   countryEl.textContent   = user.country   || '—';
    if (phoneEl)     phoneEl.textContent     = user.phone     || '—';
    if (lastNameEl)  lastNameEl.textContent  = user.lastName  || '—'; 
  }
});

// 8.3 Full Registration Logic //
const registerModal = document.getElementById('register-modal');
const registerBtn = document.getElementById('enter-hero-btn');
const registerClose = document.getElementById('register-close');
const registerSubmit = document.getElementById('register-submit');

registerBtn?.addEventListener('click', () => {
  registerModal.classList.remove('hidden');
});

registerClose?.addEventListener('click', () => {
  registerModal.classList.add('hidden');
});

registerSubmit?.addEventListener('click', () => {
  const firstName = document.getElementById('reg-firstname').value.trim();
  const lastName  = document.getElementById('reg-lastname').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const phone     = document.getElementById('reg-phone').value.trim();
  const country   = document.getElementById('reg-country').value.trim();
  const city      = document.getElementById('reg-city').value.trim();
  const role      = document.getElementById('reg-role')?.value || 'user';
  const avatarInput = document.getElementById('reg-avatar');
  const file = avatarInput.files[0];

  if (!firstName) {
    alert('Please enter your name.');
    return;
  }

  const saveUser = (avatarBase64 = '') => {
    const user = {
      name: firstName,
      lastName: lastName,
      email,
      phone,
      country,
      city,
      avatar: avatarBase64,
      role
    };
    localStorage.setItem('vibe_user', JSON.stringify(user));
    registerModal.classList.add('hidden');
    document.getElementById('user-btn').textContent = `👤 ${firstName}`;
    applyTranslations();

    // 👤 Имя и роль в панели
    const nameEl = document.getElementById('user-name-display');
    const roleEl = document.getElementById('user-role-display');
    if (nameEl) nameEl.textContent = firstName;
    if (roleEl) {
      const roleLabel = role === 'organizer' ? t('login_role_organizer') : t('login_role_user');
      roleEl.textContent = roleLabel;
    }

    // 🖼️ Аватар
    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl && avatarBase64) {
      avatarEl.src = avatarBase64;
      avatarEl.classList.remove('hidden');
    }

    // 📋 Остальные поля профиля
    const emailEl   = document.getElementById('profile-email');
    const countryEl = document.getElementById('profile-country');
    const cityEl    = document.getElementById('profile-city');
    const phoneEl   = document.getElementById('profile-phone');

    if (emailEl)   emailEl.textContent = email;
    if (countryEl) countryEl.textContent = country;
    if (cityEl)    cityEl.textContent = city;
    if (phoneEl)   phoneEl.textContent = phone;
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      saveUser(reader.result);
    };
    reader.readAsDataURL(file);
  } else {
    saveUser();
  }
});
// ProfileExit //
const logoutBtn = document.getElementById('logout-btn');
logoutBtn?.addEventListener('click', () => {
  localStorage.removeItem('vibe_user');
  location.reload();
});

// 8.4 Edit Profile Modal //
const editModal          = document.getElementById('edit-profile-modal');
const editBtn            = document.getElementById('edit-profile-btn');
const editClose          = document.getElementById('edit-profile-close');
const editSave           = document.getElementById('edit-profile-save');
const profileDetailsBtn  = document.getElementById('toggle-profile-details');
const profileExtra       = document.getElementById('profile-extra');
const settingsBtn        = document.getElementById('toggle-settings-btn');
const settingsExtra      = document.getElementById('settings-tab'); 
const eventsBtn     = document.getElementById('toggle-events-tab');
const eventsExtra   = document.getElementById('events-extra');
const memoryModeBtn = document.getElementById('toggle-memory-mode');
const memoryOptions = document.getElementById('memory-mode-options');

// 🟢 Profile Details toggle
profileDetailsBtn?.addEventListener('click', () => {
  if (profileExtra) {
    profileExtra.style.display = profileExtra.style.display === 'none' ? 'block' : 'none';
  }
});

// ⚙️ Settings toggle (как Profile Details)
settingsBtn?.addEventListener('click', () => {
  if (settingsExtra) {
    settingsExtra.style.display = settingsExtra.style.display === 'none' ? 'block' : 'none';
  }
});

// 🧠 Memory Mode toggle
memoryModeBtn?.addEventListener('click', () => {
  if (memoryOptions) {
    const isHidden = memoryOptions.style.display === 'none' || memoryOptions.style.display === '';
    memoryOptions.style.display = isHidden ? 'flex' : 'none';
  }
});

// 🧍 My Events toggle
eventsBtn?.addEventListener('click', () => {
  if (eventsExtra) {
    const isHidden = eventsExtra.style.display === 'none' || eventsExtra.style.display === '';
    eventsExtra.style.display = isHidden ? 'block' : 'none';
    if (isHidden) renderMyEvents();
  }
});

// ✏️ Edit profile open
editBtn?.addEventListener('click', () => {
  const user = JSON.parse(localStorage.getItem('vibe_user') || '{}');
  document.getElementById('edit-name').value      = user.name || '';
  document.getElementById('edit-lastname').value  = user.lastName || '';
  document.getElementById('edit-email').value     = user.email || '';
  document.getElementById('edit-phone').value     = user.phone || '';
  document.getElementById('edit-country').value   = user.country || '';
  document.getElementById('edit-city').value      = user.city || '';
  document.getElementById('edit-role').value      = user.role || 'user';
  document.getElementById('edit-avatar').value    = '';
  editModal.classList.remove('hidden');
});

// ✏️ Edit profile close
editClose?.addEventListener('click', () => {
  editModal.classList.add('hidden');
});

// 💾 Save profile changes
editSave?.addEventListener('click', () => {
  const user = JSON.parse(localStorage.getItem('vibe_user') || '{}');

  user.name     = document.getElementById('edit-name').value.trim();
  user.lastName = document.getElementById('edit-lastname').value.trim();
  user.email    = document.getElementById('edit-email').value.trim();
  user.phone    = document.getElementById('edit-phone').value.trim();
  user.country  = document.getElementById('edit-country').value.trim();
  user.city     = document.getElementById('edit-city').value.trim();
  user.role     = document.getElementById('edit-role').value;

  const avatarInput = document.getElementById('edit-avatar');
  const file = avatarInput?.files?.[0];

  const finish = () => {
    localStorage.setItem('vibe_user', JSON.stringify(user));
    updateUserPanel(user);
    editModal.classList.add('hidden');
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      user.avatar = reader.result;
      finish();
    };
    reader.readAsDataURL(file);
  } else {
    finish();
  }
});

// 🧯 Logout from Edit Profile
const editLogoutBtn = document.getElementById('logout-btn');
editLogoutBtn?.addEventListener('click', () => {
  localStorage.removeItem('vibe_user');
  location.reload();
});

// 8.4.1 Memory Photo Gallery Logic //

const memoryPhotoBtn     = document.getElementById('memory-photo-btn');
const memoryPhotoArea    = document.getElementById('memory-photo-area');
const photoGrid          = document.getElementById('photo-grid');
const photoUpload        = document.getElementById('photo-upload');

const memoryModal        = document.getElementById('memory-modal');
const memoryModalImage   = document.getElementById('memory-modal-image');
const memoryModalClose   = document.getElementById('memory-modal-close');
const memoryDeleteBtn    = document.getElementById('memory-delete-btn');

const MAX_PHOTOS = 20;
let currentPhotoIndex = null;

// 📸 Показ / скрытие галереи
memoryPhotoBtn?.addEventListener('click', () => {
  if (memoryPhotoArea) {
    memoryPhotoArea.style.display = memoryPhotoArea.style.display === 'none' ? 'block' : 'none';
    renderPhotoGrid();
  }
});

// 🖼️ Отрисовка сетки с фото и кнопкой добавления
function renderPhotoGrid() {
  if (!photoGrid) return;

  const photos = JSON.parse(localStorage.getItem('memory_photos') || '[]');
  photoGrid.innerHTML = '';

  photos.slice(0, MAX_PHOTOS).forEach((src, index) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Photo ${index + 1}`;
    img.dataset.index = index;
    photoGrid.appendChild(img);
  });

  if (photos.length < MAX_PHOTOS) {
    const addBtn = document.createElement('div');
    addBtn.className = 'add-photo-btn';
    addBtn.innerHTML = '+';
    addBtn.addEventListener('click', () => photoUpload?.click());
    photoGrid.appendChild(addBtn);
  }
}

// 📂 Загрузка нового фото
photoUpload?.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const src = e.target.result;
    const photos = JSON.parse(localStorage.getItem('memory_photos') || '[]');
    if (photos.length >= MAX_PHOTOS) return;
    photos.push(src);
    localStorage.setItem('memory_photos', JSON.stringify(photos));
    renderPhotoGrid();
  };
  reader.readAsDataURL(file);
});

// 🔍 Открытие модалки
photoGrid?.addEventListener('click', (e) => {
  const target = e.target;
  if (target.tagName === 'IMG') {
    currentPhotoIndex = parseInt(target.dataset.index, 10);
    memoryModalImage.src = target.src;
    const captions = JSON.parse(localStorage.getItem('memory_captions') || '[]');
    memoryCaptionText.textContent = captions[currentPhotoIndex] || '';
    memoryModal.classList.remove('hidden');
  }
});

// ❌ Закрытие модалки
memoryModalClose?.addEventListener('click', () => {
  memoryModal.classList.add('hidden');
  memoryModalImage.src = '';
  currentPhotoIndex = null;
});

// 🗑 Удаление фото
memoryDeleteBtn?.addEventListener('click', () => {
  if (currentPhotoIndex !== null) {
    let photos = JSON.parse(localStorage.getItem('memory_photos') || '[]');
    photos.splice(currentPhotoIndex, 1);
    localStorage.setItem('memory_photos', JSON.stringify(photos));
    renderPhotoGrid();
    memoryModal.classList.add('hidden');
    memoryModalImage.src = '';
    currentPhotoIndex = null;
  }
});

const memoryCaptionBtn = document.getElementById('memory-caption-btn');
const memoryCaptionText = document.getElementById('memory-caption-text');

memoryCaptionBtn?.addEventListener('click', () => {
  let captions = JSON.parse(localStorage.getItem('memory_captions') || '[]');
  const currentCaption = captions[currentPhotoIndex] || '';
  const input = prompt('Enter caption (max 100 chars):', currentCaption);

  if (input !== null) {
    captions[currentPhotoIndex] = input.substring(0, 100);
    localStorage.setItem('memory_captions', JSON.stringify(captions));
    memoryCaptionText.textContent = captions[currentPhotoIndex];
  }
});

// 8.4.2 Memory Video Gallery Logic //
const memoryVideoBtn   = document.getElementById('memory-video-btn');
const memoryVideoArea  = document.getElementById('memory-video-area');
const videoGrid        = document.getElementById('video-grid');
const videoUpload      = document.getElementById('video-upload');

const MAX_VIDEOS = 5;

// Показ / скрытие галереи
memoryVideoBtn?.addEventListener('click', () => {
  if (memoryVideoArea) {
    memoryVideoArea.style.display = memoryVideoArea.style.display === 'none' ? 'block' : 'none';
    renderVideoGrid();
  }
});

// Рендер сетки
function renderVideoGrid() {
  if (!videoGrid) return;

  const videos = JSON.parse(localStorage.getItem('memory_videos') || '[]');
  videoGrid.innerHTML = '';

  videos.slice(0, MAX_VIDEOS).forEach((src, index) => {
    const video = document.createElement('video');
    video.src = src;
    video.controls = true;
    video.className = 'video-thumb';
    videoGrid.appendChild(video);
  });

  if (videos.length < MAX_VIDEOS) {
    const addBtn = document.createElement('div');
    addBtn.className = 'add-video-btn';
    addBtn.innerHTML = '+';
    addBtn.addEventListener('click', () => videoUpload?.click());
    videoGrid.appendChild(addBtn);
  }
}

// Загрузка нового видео
videoUpload?.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const src = e.target.result;
    const videos = JSON.parse(localStorage.getItem('memory_videos') || '[]');
    if (videos.length >= MAX_VIDEOS) return;
    videos.push(src);
    localStorage.setItem('memory_videos', JSON.stringify(videos));
    renderVideoGrid();
  };
  reader.readAsDataURL(file);
});

// Memory Video Modal 
const videoModal         = document.getElementById('video-modal');
const videoModalPlayer   = document.getElementById('video-modal-player');
const videoModalClose    = document.getElementById('video-modal-close');
const videoDeleteBtn     = document.getElementById('video-delete-btn');
const videoGallery       = document.getElementById('video-grid');

let currentVideoIndex = null;

// Открытие модалки
videoGallery?.addEventListener('click', (e) => {
  const target = e.target;
  if (target.tagName === 'VIDEO') {
    currentVideoIndex = [...videoGallery.querySelectorAll('video')].indexOf(target);
    videoModalPlayer.src = target.src;
    videoModal.classList.remove('hidden');
  }
});

// Закрытие
videoModalClose?.addEventListener('click', () => {
  videoModal.classList.add('hidden');
  videoModalPlayer.pause();
  videoModalPlayer.src = '';
});

// Удаление
videoDeleteBtn?.addEventListener('click', () => {
  if (currentVideoIndex !== null) {
    let memoryVideos = JSON.parse(localStorage.getItem('memory_videos') || '[]');
    memoryVideos.splice(currentVideoIndex, 1);
    localStorage.setItem('memory_videos', JSON.stringify(memoryVideos));
    videoModal.classList.add('hidden');
    videoModalPlayer.pause();
    videoModalPlayer.src = '';
    renderVideoGrid();
  }
});

// 8.4.3 Memory Notes Logic //
const memoryNotesBtn   = document.getElementById('memory-notes-btn');
const memoryNotesArea  = document.getElementById('memory-notes-area');
const memoryNoteInput  = document.getElementById('memory-note-input');
const memoryNoteFeedback = document.getElementById('memory-note-feedback');

memoryNotesBtn?.addEventListener('click', () => {
  if (memoryNotesArea) {
    const isVisible = memoryNotesArea.style.display === 'block';
    memoryNotesArea.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) loadNote();
  }
});

memoryNoteInput?.addEventListener('input', () => {
  const note = memoryNoteInput.value.trim();
  localStorage.setItem('memory_note', note);
  updateFeedback();
});

function loadNote() {
  const savedNote = localStorage.getItem('memory_note') || '';
  memoryNoteInput.value = savedNote;
  updateFeedback();
}

function updateFeedback() {
  const currentLength = memoryNoteInput.value.length;
  memoryNoteFeedback.textContent = `${currentLength}/500 characters used`;
}

// 🔄 8.8.8 Обновление UI //
function updateUserPanel(user) {
  const userBtn = document.getElementById('user-btn');
  if (userBtn) userBtn.textContent = `👤 ${user.name}`;

  const firstEl = document.getElementById('display-first');
  const lastEl  = document.getElementById('display-last');

  if (firstEl) firstEl.textContent = user.name || '';
  if (lastEl)  lastEl.textContent  = user.lastName || '';

  const emailEl   = document.getElementById('profile-email');
  const cityEl    = document.getElementById('profile-city');
  const countryEl = document.getElementById('profile-country');
  const phoneEl   = document.getElementById('profile-phone');

  if (emailEl)   emailEl.textContent   = user.email   || '—';
  if (cityEl)    cityEl.textContent    = user.city    || '—';
  if (countryEl) countryEl.textContent = user.country || '—';
  if (phoneEl)   phoneEl.textContent   = user.phone   || '—';

  const roleEl = document.getElementById('user-role-display');
  const roleKey = user.role === 'organizer' ? 'login_role_organizer' : 'login_role_user';
  if (roleEl) roleEl.textContent = t(roleKey);

  const avatarEl = document.getElementById('user-avatar');
  if (avatarEl && user.avatar) {
    avatarEl.src = user.avatar;
    avatarEl.classList.remove('hidden');
  }
}

// 8.5 Render My Events in User Panel (saved + private combined) //
function renderMyEvents() {
  const container = document.getElementById('my-events-container');
  if (!container) return;
  container.innerHTML = '';

  const currentUser = JSON.parse(localStorage.getItem('vibe_user') || '{}');
  const now = new Date();

  // helper: считается ли событие прошедшим (валидная дата и дата < now)
  const isPast = ev => {
    if (!ev || !ev.date) return false;
    const d = new Date(ev.date);
    return !isNaN(d.getTime()) && d < now;
  };

  // saved (как было) — не трогаем (в архив попадают только OWN события)
  const saved = events.filter(e => savedEvents.includes(String(e.id)));

  // mine — только текущие / будущие события владельца (прошедшие убираем)
  const mine  = events.filter(e => e.owner === currentUser.email && !isPast(e));

  // объединяем saved + mine, убираем дубликаты по id
  const allMap = new Map();
  [...saved, ...mine].forEach(ev => {
    const key = String(ev.id);
    if (!allMap.has(key)) allMap.set(key, ev);
  });
  const all = Array.from(allMap.values());

  if (all.length === 0) {
    container.innerHTML = `<p style="text-align:center;">${t('no_events_found')}</p>`;
  } else {
    all.forEach(e => {
      const div = document.createElement('div');
      div.className = 'event-card';

      const privateTag = e.private ? `<span class="private-tag">🔒 ${t('private_event')}</span><br />` : '';
      const addressBlock = e.address ? `<p><strong>${t('address_label')}:</strong> ${e.address}</p>` : '';

      const isMine = e.owner === currentUser.email;

      div.innerHTML = `
        ${privateTag}
        <h4>${e.title}</h4>
        <p>${e.description}</p>
        ${addressBlock}
        <p><small>${new Date(e.date).toLocaleString(currentLang)}</small></p>
        <p><em>${e.city} — ${e.category}</em></p>
        <div class="event-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
          <button class="btn details-btn" data-i18n="view_details">${t('view_details')}</button>
          ${isMine ? `
            <button class="btn edit-my-btn" data-i18n="edit">✏️ ${t('edit')}</button>
            <button class="btn delete-my-btn" data-i18n="delete">🗑️ ${t('delete')}</button>
          ` : `
            <button class="btn remove-saved-btn" data-i18n="remove_saved">🗑 ${t('remove_saved')}</button>
          `}
        </div>
      `;

      // ─── View Details ─────────
      div.querySelector('.details-btn').addEventListener('click', () => {
        document.getElementById('modal-title').textContent       = e.title;
        document.getElementById('modal-description').textContent = e.description;
        document.getElementById('modal-date').textContent        = `${t('modal_date')}: ${new Date(e.date).toLocaleString(currentLang)}`;
        document.getElementById('modal-city').textContent        = `${t('modal_city')}: ${e.city}`;
        document.getElementById('modal-category').textContent    = `${t('modal_category')}: ${e.category}`;
        document.getElementById('modal-address').textContent     = e.address || '—';
        document.getElementById('event-modal').classList.remove('hidden');
        loadEventWeather(e.city, e.date);

        setTimeout(() => {
          const lat = parseFloat(e.lat);
          const lon = parseFloat(e.lon);
          const mapEl = document.getElementById('modal-map');
          if (!isNaN(lat) && !isNaN(lon)) {
            while (mapEl.firstChild) mapEl.removeChild(mapEl.firstChild);
            if (mapEl._leaflet_id) mapEl._leaflet_id = null;

            const modalMap = L.map(mapEl, {
              attributionControl: false,
              zoomControl: false,
              dragging: false
            }).setView([lat, lon], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(modalMap);
            L.marker([lat, lon]).addTo(modalMap).bindPopup(e.title).openPopup();
            window._modalMap = modalMap;

            document.getElementById('modal-close').addEventListener('click', () => {
              modalMap.remove();
              window._modalMap = null;
            }, { once: true });
          } else {
            mapEl.innerHTML = `<p style="color:gray;">${t('no_map')}</p>`;
          }
        }, 100);
      });

      // ─── If Owner ─────────────
      if (isMine) {
        div.querySelector('.edit-my-btn').addEventListener('click', () => {
          document.getElementById('edit-evt-title').value     = e.title;
          document.getElementById('edit-evt-desc').value      = e.description;
          document.getElementById('edit-evt-date').value      = e.date;
          document.getElementById('edit-evt-city').value      = e.city;
          document.getElementById('edit-evt-category').value  = e.category;
          document.getElementById('edit-evt-address').value   = e.address || '';
          document.getElementById('edit-evt-private').checked = !!e.private;

          const coordsEl = document.getElementById('edit-picked-coords');
          if (coordsEl && e.lat && e.lon) {
            coordsEl.textContent = `${e.lat.toFixed(4)}, ${e.lon.toFixed(4)}`;
            coordsEl.style.color = '#aaa';
          }

          pickedLat = e.lat;
          pickedLon = e.lon;
          editEventId = e.id;

          document.getElementById('edit-event-form-container').style.display = 'flex';
        });

        div.querySelector('.delete-my-btn').addEventListener('click', () => {
          const index = events.findIndex(ev => String(ev.id) === String(e.id));
          if (index !== -1) {
            // удаляем из глобального массива
            events.splice(index, 1);
            // удаляем из персонального хранилища
            const key = `my_events_${currentUser.email}`;
            let myEvents = JSON.parse(localStorage.getItem(key) || '[]');
            myEvents = myEvents.filter(me => String(me.id) !== String(e.id));
            localStorage.setItem(key, JSON.stringify(myEvents));
            // сохраняем глобально и обновляем UI
            localStorage.setItem('events', JSON.stringify(events));
            renderMyEvents();
            renderEvents();
          }
        });
      } else {
        div.querySelector('.remove-saved-btn').addEventListener('click', () => {
          toggleSaveEvent(e.id);
          renderMyEvents();
        });
      }

      container.appendChild(div);
    });

    // ─── Добавляем кнопку очистки избранного ─────────
    const clearDiv = document.createElement('div');
    clearDiv.style.textAlign = 'center';
    clearDiv.style.marginTop = '1rem';
    clearDiv.innerHTML = `
      <button id="clear-saved-btn" class="btn clear-favorites-btn" data-i18n="clear_saved">
        ${t('clear_saved')}
      </button>
    `;
    container.appendChild(clearDiv);
  }

  // ─── Обработчик кнопки очистки избранного ─────────
  const clearBtn = document.getElementById('clear-saved-btn');
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (confirm(t('confirm_clear_saved'))) {
        savedEvents = [];
        localStorage.setItem('savedEvents', JSON.stringify(savedEvents));
        renderMyEvents();
        renderEvents();
      }
    };
  }
  applyTranslations();
}

// 8.5.0.1 Render Archive Events (past events only) //
function renderArchiveEvents() {
  const container = document.getElementById('archive-events-container');
  if (!container) return;
  container.innerHTML = '';

  const currentUser = JSON.parse(localStorage.getItem('vibe_user') || '{}');
  const now = new Date();

  // savedEvents может быть глобальной переменной — если нет, берём из localStorage
  let savedIds = [];
  if (typeof savedEvents !== 'undefined' && Array.isArray(savedEvents)) {
    savedIds = savedEvents.map(String);
  } else {
    try {
      savedIds = JSON.parse(localStorage.getItem('savedEvents') || '[]').map(String);
    } catch (err) {
      savedIds = [];
    }
  }

  // архив = прошедшие события, которые РАНЬШЕ были в My Events текущего пользователя
  const archived = events.filter(e => {
    if (!e || !e.date) return false;
    const d = new Date(e.date);
    if (isNaN(d.getTime())) return false;
    if (d >= now) return false; // не прошедшие
    // попадали ли они в My Events: владелец или сохранены текущим пользователем
    const wasInMyEvents = (String(e.owner) === String(currentUser.email)) || savedIds.includes(String(e.id));
    return wasInMyEvents;
  });

  if (archived.length === 0) {
    container.innerHTML = `<p style="text-align:center;">${t('no_events_found')}</p>`;
    applyTranslations();
    return;
  }

  archived.forEach(e => {
    const div = document.createElement('div');
    div.className = 'event-card';

    const privateTag = e.private ? `<span class="private-tag">🔒 ${t('private_event')}</span><br />` : '';
    const addressBlock = e.address ? `<p><strong>${t('address_label')}:</strong> ${e.address}</p>` : '';
    const isMine = String(e.owner) === String(currentUser.email);

    div.innerHTML = `
      ${privateTag}
      <h4>${e.title}</h4>
      <p>${e.description}</p>
      ${addressBlock}
      <p><small>${new Date(e.date).toLocaleString(currentLang)}</small></p>
      <p><em>${e.city} — ${e.category}</em></p>
      <div class="event-actions" style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
        <button class="btn details-btn" data-i18n="view_details">${t('view_details')}</button>
        <button class="btn delete-archive-btn" data-i18n="delete">🗑️ ${t('delete')}</button>
      </div>
    `;

    // ─── View Details ─────────
    div.querySelector('.details-btn').addEventListener('click', () => {
      document.getElementById('modal-title').textContent       = e.title;
      document.getElementById('modal-description').textContent = e.description;
      document.getElementById('modal-date').textContent        = `${t('modal_date')}: ${new Date(e.date).toLocaleString(currentLang)}`;
      document.getElementById('modal-city').textContent        = `${t('modal_city')}: ${e.city}`;
      document.getElementById('modal-category').textContent    = `${t('modal_category')}: ${e.category}`;
      document.getElementById('modal-address').textContent     = e.address || '—';
      document.getElementById('event-modal').classList.remove('hidden');
      loadEventWeather(e.city, e.date);
    });

    // ─── Delete from Archive ─────────────
    div.querySelector('.delete-archive-btn').addEventListener('click', () => {
      const idStr = String(e.id);
      const index = events.findIndex(ev => String(ev.id) === idStr);
      if (index === -1) return;

      // сохраняем владельца до удаления
      const ownerEmail = events[index].owner;

      // удаляем событие из глобального массива
      events.splice(index, 1);
      localStorage.setItem('events', JSON.stringify(events));

      // удаляем из savedEvents если есть
      try {
        let savedArr = (typeof savedEvents !== 'undefined' && Array.isArray(savedEvents)) ? savedEvents.slice() : JSON.parse(localStorage.getItem('savedEvents') || '[]');
        if (savedArr.includes(idStr)) {
          savedArr = savedArr.filter(sid => String(sid) !== idStr);
          if (typeof savedEvents !== 'undefined') savedEvents = savedArr;
          localStorage.setItem('savedEvents', JSON.stringify(savedArr));
        }
      } catch (err) {
        // noop
      }

      // удаляем из my_events текущего пользователя (если есть)
      try {
        const keyCur = `my_events_${currentUser.email}`;
        let myCur = JSON.parse(localStorage.getItem(keyCur) || '[]');
        myCur = myCur.filter(me => String(me.id) !== idStr);
        localStorage.setItem(keyCur, JSON.stringify(myCur));
      } catch (err) { /* noop */ }

      // удаляем из my_events владельца события (если владелец задан)
      try {
        if (ownerEmail) {
          const keyOwner = `my_events_${ownerEmail}`;
          let ownerArr = JSON.parse(localStorage.getItem(keyOwner) || '[]');
          ownerArr = ownerArr.filter(me => String(me.id) !== idStr);
          localStorage.setItem(keyOwner, JSON.stringify(ownerArr));
        }
      } catch (err) { /* noop */ }

      // обновляем UI
      renderArchiveEvents();
      renderEvents();
    });

    container.appendChild(div);
  });

  applyTranslations();
}

// 8.5.1 🧾 Populate User Profile Fields in User Panel //
function populateProfile() {
  const user = JSON.parse(localStorage.getItem('vibe_user') || '{}');
  if (!user) return;

  const nameEl = document.getElementById('user-name-display');
  const roleEl = document.getElementById('user-role-display');
  const emailEl = document.getElementById('profile-email');
  const countryEl = document.getElementById('profile-country');
  const cityEl = document.getElementById('profile-city');
  const phoneEl = document.getElementById('profile-phone');

  if (nameEl) nameEl.textContent = user.name || '';

  // 🧠 Используем i18n-перевод
  if (roleEl) {
    const key = user.role === 'organizer' ? 'login_role_organizer' : 'login_role_user';
    roleEl.textContent = t(key);
  }

  if (emailEl) emailEl.textContent = user.email || '—';
  if (countryEl) countryEl.textContent = user.country || '—';
  if (cityEl) cityEl.textContent = user.city || '—';
  if (phoneEl) phoneEl.textContent = user.phone || '—';
}

// 8.6 Tabs Logic //
document.querySelectorAll('.user-action-buttons .btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // переключаем класс active на кнопках в панели действий
    document.querySelectorAll('.user-action-buttons .btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // определяем целевую вкладку: сначала data-tab, затем по id (fallback)
    let target = btn.dataset.tab;
    if (!target) {
      const idMap = {
        'toggle-events-tab': 'my-tab',
        'toggle-archive-tab': 'archive-tab',
        'toggle-settings-btn': 'settings-tab'
      };
      target = idMap[btn.id] || null;
    }

    if (!target) return;

    // скрываем все вкладки и показываем нужную
    document.querySelectorAll('.user-tab').forEach(tab => tab.classList.add('hidden'));
    document.getElementById(target)?.classList.remove('hidden');

    // вызываем рендер соответствующей вкладки
    if (target === 'my-tab') {
      renderMyEvents();
    } else if (target === 'saved-tab') {
      renderSavedEvents && renderSavedEvents();
    } else if (target === 'archive-tab') {
      renderArchiveEvents && renderArchiveEvents();
    } else if (target === 'settings-tab') {
      populateProfile();
    }
  });
});

// 8.7 Прогноз погоды для события (View Details) //
async function loadEventWeather(city, dateStr) {
  const weatherEl = document.getElementById('modal-weather');
  weatherEl.textContent = t('modal_weather_loading');

  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((date - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      weatherEl.textContent = t('modal_weather_event_passed');
      return;
    }

    if (diffDays > 4) {
      const month = date.toLocaleString(currentLang, { month: 'long' });
      weatherEl.textContent = t('modal_weather_far_future')
        .replace('{city}', city)
        .replace('{month}', month);
      return;
    }

    const coords = cityCoordsMap?.[city];
    if (!coords) {
      weatherEl.textContent = t('modal_weather_missing_coords');
      return;
    }

    const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${coords.lat}&lon=${coords.lon}&appid=${API_KEY}&units=metric`);
    const data = await res.json();

    const targetDate = date.toISOString().split('T')[0];

    const forecast = data.list.find(item => {
      const [dateStr, timeStr] = item.dt_txt.split(' ');
      return dateStr === targetDate && timeStr >= '12:00:00';
    });

    const fallback = data.list.find(item => item.dt_txt.startsWith(targetDate));
    const forecastToUse = forecast || fallback;

    if (forecastToUse) {
      const temp = forecastToUse.main.temp.toFixed(1);
      const desc = forecastToUse.weather[0].description;
      weatherEl.textContent = t('modal_weather_forecast')
        .replace('{desc}', desc)
        .replace('{temp}', temp);
    } else {
      weatherEl.textContent = t('modal_weather_unavailable');
    }
  } catch (err) {
    weatherEl.textContent = t('modal_weather_unavailable');
    console.error('❌ Weather fetch failed:', err.message, err);
  }
}

// ─── 9. Map Logic ─────────
const mapContainer = document.getElementById('map-container');
const mapCloseBtn = document.getElementById('map-close');
let mapInstance;

mapCloseBtn.addEventListener('click', () => {
  mapContainer.classList.add('hidden');
});

function showMap(lat, lon, label) {
  // Если координаты не переданы — берём из #city-filter
  if (typeof lat === 'undefined' || typeof lon === 'undefined') {
    const selectedCity = document.getElementById('city-filter')?.value;
    if (selectedCity && Array.isArray(cities)) {
      const cityObj = cities.find(c => c.name === selectedCity);
      if (cityObj) {
        lat = cityObj.lat;
        lon = cityObj.lon;
        label = cityObj.name;
      }
    }
  }

  // Если всё ещё нет координат — дефолт на Kyoto
  lat = lat || 35.0116;
  lon = lon || 135.7681;
  label = label || "Kyoto";

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
