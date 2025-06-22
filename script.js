// ─── 1. Imports and Helpers ────────────────────────────────────────────────────
import Papa from 'papaparse';
import EmblaCarousel from 'embla-carousel';
import { fetchWeather, getTimeOfDay } from './weather.js';

const API_KEY = '4fa7ffeee5d231eb59154b86e43cdbbe';

// ─── 1.0.1. Language Detection and i18n ──────────────────────────────────────────
const supportedLanguages = ['ar', 'de', 'en', 'fr', 'es', 'it', 'pt', 'ja', 'zh'];
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

// ─── 1.0.2 Apply Translations ───────────────────────────────────────────
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
}

// ─── 2. Constants and Variables ───────────────────────────────────────────────
const defaultCity   = 'Seoul';
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTwhCOoNnWCX5qUX_8KuIVoBHkohSlP_N4Rwedjr7z8lrhLWx064VnBRFicyoUXOxkQSpvDC92PwRJY/pub?output=csv';
const CITIES_JSON   = '/cities.json';

let events         = [];
let citiesList     = [];
let selectedCity   = defaultCity;
let cityCoordsMap  = {};
let savedEvents    = JSON.parse(localStorage.getItem('savedEvents') || '[]');

// ─── 3. DOM Elements ───────────────────────────────────────────────────────────
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
const tabSaved          = document.getElementById('saved-tab');
const tabSettings       = document.getElementById('settings-tab');
const tabSavedBtn       = document.querySelector('[data-tab="saved-tab"]');
const tabSettingsBtn    = document.querySelector('[data-tab="settings-tab"]');
const langSwitcher = document.getElementById('lang-switcher');

// ─── 4. Core Functions ──────────────────────────────────────────────────────────

/** 4.0.0 Load cities list from public/cities.json */
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

/** 4.0 Load events from Google Sheets CSV */
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
        lon: 135.7788
      },
      {
        id: 'kyoto2',
        city: 'Kyoto',
        title: 'Gion Matsuri Night Parade',
        description: 'The ancient float festival in full neon glow.',
        date: new Date(now.getTime() + 1 * 86400000).toISOString(),
        category: 'Culture',
        lat: 35.0039,
        lon: 135.7780
      },
      {
        id: 'kyoto3',
        city: 'Kyoto',
        title: 'Street Food Fiesta',
        description: 'Local snacks and tea tasting near Nishiki Market.',
        date: new Date(now.getTime() + 2 * 86400000).toISOString(),
        category: 'Food',
        lat: 35.0042,
        lon: 135.7661
      },
      {
        id: 'kyoto4',
        city: 'Kyoto',
        title: 'Anime Music Live',
        description: 'Orchestra playing Studio Ghibli and classics.',
        date: new Date(now.getTime() + 3 * 86400000).toISOString(),
        category: 'Music',
        lat: 35.0007,
        lon: 135.7725
      },
      {
        id: 'kyoto5',
        city: 'Kyoto',
        title: 'AI + Zen Symposium',
        description: 'Nova тоже будет, но в голограмме.',
        date: new Date(now.getTime() + 5 * 86400000).toISOString(),
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

/** 4.1 Fetch and display weather */
async function update(city) {
  try {
    await fetchWeather(city);
  } catch (e) {
    console.error(e);
    alert(`Could not fetch weather for "${city}"`);
  }
}

/** 4.2 Time-of-day theme */
function applyTimeTheme() {
  const phase = getTimeOfDay(); // 'morning'|'day'|'evening'|'night'
  document.body.classList.add(`theme-${phase}`);
}

/** 4.3 City background */
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

/** 4.4 Populate filters */
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

/** 4.5 Render events */
function renderEvents() {
  eventsContainer.innerHTML = '';
  const showOnlyFavorites = favoritesOnlyCheckbox?.checked;

  const now = new Date();
  // Вычисляем завтрашний день прямо здесь
  const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const allFiltered = events
    .filter(e => e.city === selectedCity)
    .filter(e => (!cityFilter?.value || e.city === cityFilter.value))
    .filter(e => (!categoryFilter?.value || e.category === categoryFilter.value))
    .filter(e => !showOnlyFavorites || savedEvents.includes(String(e.id)));

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

      // inline вычисление оставшегося времени вместо getTimeRemaining
      let countdownHtml = '';
      if (isSameDay(new Date(e.date), now)) {
        const diffMs = new Date(e.date) - now;
        const hours   = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        if (diffMs <= 0) {
          countdownHtml = `<p class="countdown">${t('event_started')}</p>`;
        } else {
          countdownHtml = `<p class="countdown">${t('starts_in')
            .replace('{hours}', hours)
            .replace('{minutes}', minutes)}</p>`;
        }
      }

      card.innerHTML = `
  <h3>${e.title}</h3>
  <p>${e.description}</p>
  <p><small>${new Date(e.date).toLocaleString(currentLang)}</small></p>
  <p><em>${e.city} — ${e.category}</em></p>
  <div class="event-actions">
    <button class="btn details-btn" data-i18n="view_details">${t('view_details')}</button>
    <button class="btn map-btn" data-i18n="show_on_map">${t('show_on_map')}</button>
    <button class="btn save-btn" data-i18n="${savedEvents.includes(String(e.id)) ? 'saved_event' : 'save_event'}">
      ${savedEvents.includes(String(e.id)) ? t('saved_event') : t('save_event')}
    </button>
  </div>
  ${countdownHtml}
`;
      const slide = document.createElement('div');
      slide.className = 'embla__slide';
      slide.appendChild(card);
      eventsContainer.appendChild(slide);

      // Event handlers
      const detailsBtn = card.querySelector('.details-btn');
      detailsBtn.addEventListener('click', () => {
        document.getElementById('modal-title').textContent       = e.title;
        document.getElementById('modal-description').textContent = e.description;
        document.getElementById('modal-date').textContent        = `${t('modal_date')}: ${new Date(e.date).toLocaleString(currentLang)}`;
        document.getElementById('modal-city').textContent        = `${t('modal_city')}: ${e.city}`;
        document.getElementById('modal-category').textContent    = `${t('modal_category')}: ${e.category}`;
        document.getElementById('event-modal').classList.remove('hidden');

        loadEventWeather(e.city, e.date);

        setTimeout(() => {
          const lat = parseFloat(e.lat);
          const lon = parseFloat(e.lon);
          const mapEl = document.getElementById('modal-map');

          if (!isNaN(lat) && !isNaN(lon)) {
            mapEl.innerHTML = '';
            const modalMap = L.map(mapEl, {
              attributionControl: false,
              zoomControl: false,
              dragging: false
            }).setView([lat, lon], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(modalMap);
            L.marker([lat, lon]).addTo(modalMap).bindPopup(e.title).openPopup();

            const closeBtn = document.getElementById('modal-close');
            closeBtn.addEventListener('click', () => {
              modalMap.remove();
            }, { once: true });
          } else {
            mapEl.innerHTML = `<p style="color:gray;">${t('no_map')}</p>`;
          }
        }, 100);
      });

      const mapBtn = card.querySelector('.map-btn');
      mapBtn.addEventListener('click', () => {
        const lat = parseFloat(e.lat);
        const lon = parseFloat(e.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          showMap(lat, lon, e.title);
        } else {
          alert(t('no_coordinates'));
        }
      });

      const saveBtn = card.querySelector('.save-btn');
      saveBtn.addEventListener('click', () => {
        toggleSaveEvent(e.id);
      });
    });
  }

  renderGroup("event_today", today);
  renderGroup("event_tomorrow", tomorrow);
  renderGroup("event_upcoming", later);
  applyTranslations();
}

/** Toggle save/unsave event */
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

// ─── 5. Initialization and Event Listeners ──────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // 5.0 Load Translations
  await loadTranslations(currentLang);

  // 5.1 Language Switcher
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

  // 5.2 Load core data
  await loadCities();
  await loadEvents();

  // 5.3 Splash input and button
  const splashInput = document.getElementById('splash-city-input');
  const splashBtn   = document.getElementById('enter-btn');

  if (splashInput && splashBtn) {
    splashInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        splashBtn.click();
      }
    });

    splashBtn.addEventListener('click', () => {
      const city = splashInput.value.trim() || defaultCity;
      selectedCity = city;
      splash.style.display = 'none';

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

  // 5.4 Hero enter button
  const heroEnterBtn = document.getElementById('enter-hero-btn');
  if (heroEnterBtn && splashBtn) {
    heroEnterBtn.addEventListener('click', () => splashBtn.click());
  } else {
    console.warn('⚠️ heroEnterBtn or splashBtn not found in DOM');
  }

  // 5.5 Live search
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderEvents();
      initEmbla();
    });
  }

  // 5.6 City filter
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

  // 5.7 Category filter
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      renderEvents();
      initEmbla();
    });
  }

  // 5.8 Favorites checkbox
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

// ─── 6. Show/Hide Add Event Form ──────────────────────────────────────────────
if (addEventBtn && eventFormContainer) {
  addEventBtn.addEventListener('click', () => {
    eventFormContainer.style.display = 'flex';
  });
}

if (evtCancelBtn && eventFormContainer) {
  evtCancelBtn.addEventListener('click', () => {
    eventFormContainer.style.display = 'none';
  });
}

if (evtCitySelect) {
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
}

// ─── Submit New Event Form ──────────────────────────────────────────
if (eventForm) {
  eventForm.addEventListener('submit', e => {
    e.preventDefault();

    const title   = evtTitleInput.value.trim();
    const desc    = evtDescInput.value.trim();
    const dateVal = evtDateInput.value;
    const cityVal = evtCitySelect.value.trim();
    const catVal  = evtCategoryInput.value.trim();

    if (!title || !desc || !dateVal || !cityVal || !catVal) {
      alert('Please fill in all fields.');
      return;
    }

    const newId = Date.now().toString();

    let lat, lon;
    const coords = cityCoordsMap?.[cityVal];
    if (coords) {
      lat = parseFloat(coords.lat);
      lon = parseFloat(coords.lon);
    }

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

    events.push(newEvent);
    populateFilters();
    renderEvents();

    eventFormContainer.style.display = 'none';

    evtTitleInput.value    = '';
    evtDescInput.value     = '';
    evtDateInput.value     = '';
    evtCitySelect.value    = '';
    evtCategoryInput.value = '';
  });
} 

// ─── 7. Embla Carousel Setup ───────────────────────────────────────────────
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

// ─── Close modal window ────────────────────────────────────────────────
document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('event-modal').classList.add('hidden');
});

// ─── 8. User Panel: Open/Close and Tabs ──────────────────────────────────
userBtn.addEventListener('click', () => {
  userPanel.classList.add('open');
  tabSaved.classList.add('active');
  tabSettings.classList.remove('active');
  tabSavedBtn.classList.add('active');
  tabSettingsBtn.classList.remove('active');
  renderSavedEvents();
});

closeUserPanel.addEventListener('click', () => {
  userPanel.classList.remove('open');
});

tabSavedBtn.addEventListener('click', () => {
  tabSaved.classList.add('active');
  tabSettings.classList.remove('active');
  tabSavedBtn.classList.add('active');
  tabSettingsBtn.classList.remove('active');
  renderSavedEvents();
});

tabSettingsBtn.addEventListener('click', () => {
  tabSettings.classList.add('active');
  tabSaved.classList.remove('active');
  tabSettingsBtn.classList.add('active');
  tabSavedBtn.classList.remove('active');
});

// Render saved events in user panel
function renderSavedEvents() {
  savedEventsContainer.innerHTML = '';

  const saved = events.filter(e => savedEvents.includes(String(e.id)));

  if (saved.length === 0) {
    savedEventsContainer.innerHTML = `<p style="text-align:center;">${t('no_saved_events')}</p>`;
    return;
  }

  saved.forEach(e => {
    const div = document.createElement('div');
    div.className = 'event-card';
    div.innerHTML = `
      <h4>${e.title}</h4>
      <p>${e.description}</p>
      <p><small>${new Date(e.date).toLocaleString(currentLang)}</small></p>
      <p><em>${e.city} — ${e.category}</em></p>
      <div class="event-actions">
        <button class="btn details-btn">${t('view_details')}</button>
        <button class="btn remove-saved-btn">🗑 ${t('remove_saved')}</button>
      </div>
    `;

    div.querySelector('.details-btn').addEventListener('click', () => {
      document.getElementById('modal-title').textContent       = e.title;
      document.getElementById('modal-description').textContent = e.description;
      document.getElementById('modal-date').textContent        = `${t('modal_date')}: ${new Date(e.date).toLocaleString(currentLang)}`;
      document.getElementById('modal-city').textContent        = `${t('modal_city')}: ${e.city}`;
      document.getElementById('modal-category').textContent    = `${t('modal_category')}: ${e.category}`;
      document.getElementById('event-modal').classList.remove('hidden');
      loadEventWeather(e.city, e.date);
    });

    div.querySelector('.remove-saved-btn').addEventListener('click', () => {
      toggleSaveEvent(e.id);
      renderSavedEvents();
    });

    savedEventsContainer.appendChild(div);
  });
}

// ─── 8.1 User Login Logic ───────────────────────────────────────────────
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
      name, role, avatar: avatarBase64,
      surname, email, country, city, phone
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

// ─── 8.2 Restore User From Storage ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const storedUser = localStorage.getItem('vibe_user');
  if (storedUser) {
    const user = JSON.parse(storedUser);
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

    // Показываем имя и роль в user panel
    const nameEl = document.getElementById('user-name-display');
    const roleEl = document.getElementById('user-role-display');
    if (user?.name && nameEl) nameEl.textContent = user.name;
    if (user?.role && roleEl) roleEl.textContent = user.role === 'organizer' ? 'Organizer' : 'User';
  }
});

// ─── 8.3 Full Registration Logic ─────────────────────────────────────────────
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
  const avatarInput = document.getElementById('reg-avatar');
  const file = avatarInput.files[0];

  if (!firstName) {
    alert('Please enter your name.');
    return;
  }

  const saveUser = (avatarBase64 = '') => {
    const user = {
      name: firstName,
      lastname: lastName,
      email,
      phone,
      country,
      city,
      avatar: avatarBase64,
      role: 'user'
    };
    localStorage.setItem('vibe_user', JSON.stringify(user));
    registerModal.classList.add('hidden');
    document.getElementById('user-btn').textContent = `👤 ${firstName}`;
    applyTranslations();

    // 👤 Имя и роль в панели
    const nameEl = document.getElementById('user-name-display');
    const roleEl = document.getElementById('user-role-display');
    if (nameEl) nameEl.textContent = firstName;
    if (roleEl) roleEl.textContent = 'User';

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

// ─── 8.4 Edit Profile Modal ─────────────────────────────────────────────
const editModal = document.getElementById('edit-profile-modal');
const editBtn = document.getElementById('edit-profile-btn');
const editClose = document.getElementById('edit-profile-close');
const editSave = document.getElementById('edit-profile-save');

editBtn?.addEventListener('click', () => {
  const user = JSON.parse(localStorage.getItem('vibe_user') || '{}');
  document.getElementById('edit-name').value = user.name || '';
  document.getElementById('edit-email').value = user.email || '';
  document.getElementById('edit-phone').value = user.phone || '';
  document.getElementById('edit-country').value = user.country || '';
  document.getElementById('edit-city').value = user.city || '';
  editModal.classList.remove('hidden');
});

editClose?.addEventListener('click', () => {
  editModal.classList.add('hidden');
});

editSave?.addEventListener('click', () => {
  const user = JSON.parse(localStorage.getItem('vibe_user') || '{}');

  user.name = document.getElementById('edit-name').value.trim();
  user.email = document.getElementById('edit-email').value.trim();
  user.phone = document.getElementById('edit-phone').value.trim();
  user.country = document.getElementById('edit-country').value.trim();
  user.city = document.getElementById('edit-city').value.trim();

  localStorage.setItem('vibe_user', JSON.stringify(user));
  editModal.classList.add('hidden');

  // Обновить на странице
  document.getElementById('user-btn').textContent = `👤 ${user.name}`;
  document.getElementById('user-name-display').textContent = user.name;
  document.getElementById('profile-email').textContent = user.email;
  document.getElementById('profile-phone').textContent = user.phone;
  document.getElementById('profile-country').textContent = user.country;
  document.getElementById('profile-city').textContent = user.city;
});

// ─── Прогноз погоды для события (View Details) ─────────────────────────────
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

// ─── 9. Map Logic ──────────────────────────────────────────────────────
const mapContainer = document.getElementById('map-container');
const mapCloseBtn = document.getElementById('map-close');
let mapInstance;

mapCloseBtn.addEventListener('click', () => {
  mapContainer.classList.add('hidden');
});

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
