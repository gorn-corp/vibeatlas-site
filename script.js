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
  // Обновляем отображение профиля после смены языка
  if (typeof populateProfile === 'function') {
    populateProfile();
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
const tabMyBtn          = document.querySelector('[data-tab="my-tab"]');
const tabMy             = document.getElementById('my-tab');
const tabSettings       = document.getElementById('settings-tab');
const tabSettingsBtn    = document.querySelector('[data-tab="settings-tab"]');
const langSwitcher      = document.getElementById('lang-switcher');

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

if (evtCancelBtn && eventFormContainer) {
  evtCancelBtn.addEventListener('click', () => {
    eventFormContainer.style.display = 'none';
  });
}

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

      // обновить адрес
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

/** 6.1 Submit New Event Form */
let pickedLat = null;
let pickedLon = null;
let editEventId = null;

if (eventForm) {
  eventForm.addEventListener('submit', e => {
    e.preventDefault();

    const title       = evtTitleInput.value.trim();
    const desc        = evtDescInput.value.trim();
    const dateVal     = evtDateInput.value;
    const cityVal     = evtCitySelect.value.trim();
    const catVal      = evtCategoryInput.value.trim();
    const address     = document.getElementById('evt-address')?.value.trim();
    const isPrivate   = document.getElementById('evt-private')?.checked;

    if (!title || !desc || !dateVal || !cityVal || !catVal) {
      alert('Please fill in all fields.');
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem('vibe_user') || '{}');
    if (!currentUser?.email) {
      alert('Please log in with email to create events.');
      return;
    }

    const newId = editEventId || Date.now().toString();

    const newEvent = {
      id: newId,
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

    if (editEventId) {
      const index = events.findIndex(ev => ev.id === editEventId);
      if (index !== -1) events[index] = newEvent;
      editEventId = null;
    } else {
      events.push(newEvent);

      const key = `my_events_${currentUser.email}`;
      const myEvents = JSON.parse(localStorage.getItem(key) || '[]');
      myEvents.push(newEvent);
      localStorage.setItem(key, JSON.stringify(myEvents));
    }

    // Обновляем фильтры и рендерим
    populateFilters();
    renderEvents();

    // Обновляем сразу My Events
    if (typeof renderMyEvents === 'function') renderMyEvents();

    // Закрываем форму и очищаем поля
    eventFormContainer.style.display = 'none';
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

// ─── 6.2 Pick on Map for Location ───────────────────────────────────────────
const pickBtn = document.getElementById('pick-location');
const pickedCoordsDisplay = document.getElementById('picked-coords');
const addressInput = document.getElementById('evt-address');
const userEventsKey = 'my_events';

if (pickBtn && pickedCoordsDisplay && addressInput) {
  pickBtn.addEventListener('click', () => {
    if (document.getElementById('map-popup')) return;

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

    const map = L.map(mapDiv).setView([35.0116, 135.7681], 13);
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

// ─── 6.3 Save My Events Separately ─────────────────────────────────────────────
function saveMyEvent(eventObj) {
  const user = JSON.parse(localStorage.getItem('vibe_user') || '{}');
  if (!user?.email) return;

  const key = `${userEventsKey}_${user.email}`;
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  list.push(eventObj);
  localStorage.setItem(key, JSON.stringify(list));
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
  tabMy.classList.add('active');
  tabSettings.classList.remove('active');
  tabMyBtn.classList.add('active');
  tabSettingsBtn.classList.remove('active');
  renderMyEvents();
  populateProfile();
});

closeUserPanel.addEventListener('click', () => {
  userPanel.classList.remove('open');
});

tabMyBtn.addEventListener('click', () => {
  tabMy.classList.add('active');
  tabSettings.classList.remove('active');
  tabMyBtn.classList.add('active');
  tabSettingsBtn.classList.remove('active');
  renderMyEvents();
});

tabSettingsBtn.addEventListener('click', () => {
  tabSettings.classList.add('active');
  tabMy.classList.remove('active');
  tabSettingsBtn.classList.add('active');
  tabMyBtn.classList.remove('active');
  populateProfile();
});

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

    // Показываем имя и роль в user panel
    const nameEl = document.getElementById('user-name-display');
    const roleEl = document.getElementById('user-role-display');
    if (user?.name && nameEl) nameEl.textContent = user.name;
    if (user?.role && roleEl) {
      const key = user.role === 'organizer' ? 'login_role_organizer' : 'login_role_user';
      roleEl.textContent = t(key);
    }
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
      lastname: lastName,
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

// 8.5 Render My Events in User Panel (saved + private combined)
function renderMyEvents() {
  const container = document.getElementById('my-events-container');
  if (!container) return;
  container.innerHTML = '';

  const currentUser = JSON.parse(localStorage.getItem('vibe_user') || '{}');

  const saved = events.filter(e => savedEvents.includes(String(e.id)));
  const mine  = events.filter(e => e.private && e.owner === currentUser.email);
  const all   = [...saved, ...mine];

  if (all.length === 0) {
    container.innerHTML = `<p style="text-align:center;">${t('no_events_found')}</p>`;
    return;
  }

  all.forEach(e => {
    const div = document.createElement('div');
    div.className = 'event-card';

    const privateTag = e.private ? `<span class="private-tag">🔒 ${t('private_event')}</span><br />` : '';
    const addressBlock = e.address ? `<p><strong>${t('address_label')}:</strong> ${e.address}</p>` : '';

    div.innerHTML = `
      ${privateTag}
      <h4>${e.title}</h4>
      <p>${e.description}</p>
      ${addressBlock}
      <p><small>${new Date(e.date).toLocaleString(currentLang)}</small></p>
      <p><em>${e.city} — ${e.category}</em></p>
      <div class="event-actions">
        <button class="btn details-btn">${t('view_details')}</button>
        ${e.private && e.owner === currentUser.email ? `<button class="btn edit-my-btn">✏️ ${t('edit')}</button>
        <button class="btn delete-my-btn">🗑️ ${t('delete')}</button>` : `<button class="btn remove-saved-btn">🗑 ${t('remove_saved')}</button>`}
      </div>
    `;

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

    if (e.private && e.owner === currentUser.email) {
      div.querySelector('.edit-my-btn').addEventListener('click', () => {
        document.getElementById('evt-title').value = e.title;
        document.getElementById('evt-desc').value = e.description;
        document.getElementById('evt-date').value = e.date;
        document.getElementById('evt-city').value = e.city;
        document.getElementById('evt-category').value = e.category;
        document.getElementById('evt-address').value = e.address || '';
        document.getElementById('evt-private').checked = !!e.private;
        const coordsEl = document.getElementById('picked-coords');
        if (coordsEl && e.lat && e.lon) {
          coordsEl.textContent = `${e.lat.toFixed(4)}, ${e.lon.toFixed(4)}`;
          coordsEl.style.color = '#aaa';
        }
        pickedLat = e.lat;
        pickedLon = e.lon;
        editEventId = e.id;
        eventFormContainer.style.display = 'block';
      });

      div.querySelector('.delete-my-btn').addEventListener('click', () => {
        const index = events.findIndex(ev => ev.id === e.id);
        if (index !== -1) {
          events.splice(index, 1);
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
}

// ─── 🧾 Populate User Profile Fields in User Panel ─────────────────────────
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

// ─── 8.6 Tabs Logic ─────────────────────────────────────
document.querySelectorAll('.user-panel-tabs .btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.user-panel-tabs .btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.tab;
    document.querySelectorAll('.user-tab').forEach(tab => tab.classList.add('hidden'));
    document.getElementById(target)?.classList.remove('hidden');

    if (target === 'my-tab') {
      renderMyEvents();
    } else if (target === 'saved-tab') {
      renderSavedEvents();
    } else if (target === 'settings-tab') {
      populateProfile();
    }
  });
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
