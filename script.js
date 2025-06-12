// ─── 1. Imports and Helpers ────────────────────────────────────────────────────
import Papa from 'papaparse';
import EmblaCarousel from 'embla-carousel';
import { fetchWeather, getTimeOfDay } from './weather.js';

const API_KEY = '4fa7ffeee5d231eb59154b86e43cdbbe';

// 1.1 Date helpers
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

function getTimeRemaining(dateStr) {
  const eventDate = new Date(dateStr);
  const now = new Date();
  const diffMs = eventDate - now;

  if (diffMs <= 0) return null;

  const totalSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  return { hours, minutes };
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
  // Cities filter
  cityFilter.innerHTML = `<option value="">All Cities</option>`;
  citiesList.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    cityFilter.appendChild(opt);
  });

  // For Add Event form
  evtCitySelect.innerHTML = `<option value="">Select City</option>`;
  citiesList.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    evtCitySelect.appendChild(opt);
  });

  // Categories filter
  const catList = [...new Set(events.map(e => e.category).filter(Boolean))].sort();
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

/** 4.5 Render events */
function renderEvents() {
  eventsContainer.innerHTML = '';
  const showOnlyFavorites = favoritesOnlyCheckbox.checked;

  const now = new Date();
  const allFiltered = events
    .filter(e => e.city === selectedCity)
    .filter(e => (!cityFilter.value     || e.city     === cityFilter.value))
    .filter(e => (!categoryFilter.value || e.category === categoryFilter.value))
    .filter(e => !showOnlyFavorites || savedEvents.includes(String(e.id)));

  const query = searchInput.value.trim().toLowerCase();
  let filtered = allFiltered;

  if (query) {
    filtered = filtered.filter(e =>
      e.title.toLowerCase().includes(query) ||
      e.description.toLowerCase().includes(query)
    );
  }

  filtered = filtered.sort((a, b) =>
  new Date(a.date) - new Date(b.date)
);

  const today    = filtered.filter(e => isSameDay(new Date(e.date), now));
  const tomorrow = filtered.filter(e => isSameDay(new Date(e.date), addDays(now, 1)));
  const later    = filtered.filter(e => new Date(e.date) > addDays(now, 1));

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
      card.dataset.id = e.id;

      card.innerHTML = `
        <h3>${e.title}</h3>
        <p>${e.description}</p>
        <p><small>${new Date(e.date).toLocaleString()}</small></p>
        <p><em>${e.city} — ${e.category}</em></p>
        <div class="event-actions">
          <button class="btn details-btn">View Details</button>
          <button class="btn map-btn">📍 Show on Map</button>
          <button class="btn save-btn">${savedEvents.includes(String(e.id)) ? '★ Saved' : '☆ Save'}</button>
        </div>
        ${isSameDay(new Date(e.date), now) ? (() => {
          const remaining = getTimeRemaining(e.date);
          if (!remaining) return '<p class="countdown">⏰ Started</p>';
          return `<p class="countdown">⏳ Starts in ${remaining.hours}h ${remaining.minutes}m</p>`;
        })() : ''}
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
        document.getElementById('modal-date').textContent        = new Date(e.date).toLocaleString();
        document.getElementById('modal-city').textContent        = e.city;
        document.getElementById('modal-category').textContent    = e.category;
        document.getElementById('event-modal').classList.remove('hidden');

          loadEventWeather(e.city, e.date);
        
        setTimeout(() => {
          const lat = parseFloat(e.lat);
          const lon = parseFloat(e.lon);

          if (!isNaN(lat) && !isNaN(lon)) {
            document.getElementById('modal-map').innerHTML = ''; // 👈 Очистка перед повторной инициализацией
            const modalMap = L.map('modal-map', {
              attributionControl: false,
              zoomControl: false,
              dragging: false
            }).setView([lat, lon], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(modalMap);
            L.marker([lat, lon]).addTo(modalMap).bindPopup(e.title).openPopup();

            document.getElementById('modal-close').addEventListener('click', () => {
              modalMap.remove();
            });
          } else {
            document.getElementById('modal-map').innerHTML = '<p style="color:gray;">No map available</p>';
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
          alert("This event has no coordinates yet.");
        }
      });

      const saveBtn = card.querySelector('.save-btn');
      saveBtn.addEventListener('click', () => {
        toggleSaveEvent(e.id);
      });
    });
  }

  renderGroup("Today",    today);
  renderGroup("Tomorrow", tomorrow);
  renderGroup("Upcoming", later);
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
  await loadCities();
  await loadEvents();

  // 5.1 ENTER on Splash input
  splashCityInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      enterBtn.click();
    }
  });

  enterBtn.addEventListener('click', () => {
    const city = splashCityInput.value.trim() || defaultCity;
    selectedCity = city;
    cityFilter.value = city;

    splash.style.display = 'none';
    update(city);
    applyTimeTheme();
    applyCityBackground(city);
    populateFilters();
    cityFilter.value = selectedCity;
    renderEvents();
    initEmbla();
  });

  heroEnterBtn.addEventListener('click', () => enterBtn.click());

  searchInput.addEventListener('input', () => {
    renderEvents();
    initEmbla();
  });

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

  categoryFilter.addEventListener('change', () => {
    renderEvents();
    initEmbla();
  });

  favoritesOnlyCheckbox.addEventListener('change', () => {
    renderEvents();
    initEmbla();
  });
});

// ─── 6. Show/Hide Add Event Form ──────────────────────────────────────────────
addEventBtn.addEventListener('click', () => {
  eventFormContainer.style.display = 'flex';
});

evtCancelBtn.addEventListener('click', () => {
  eventFormContainer.style.display = 'none';
});

// On city selection for Add Event — set coordinates
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

// ─── Submit New Event Form ──────────────────────────────────────────
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
  initEmbla();

  eventFormContainer.style.display = 'none';

  evtTitleInput.value    = '';
  evtDescInput.value     = '';
  evtDateInput.value     = '';
  evtCitySelect.value    = '';
  evtCategoryInput.value = '';
});

// ─── 7. Embla Carousel Setup ───────────────────────────────────────────────
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
    savedEventsContainer.innerHTML = '<p style="text-align:center;">No saved events yet.</p>';
    return;
  }

  saved.forEach(e => {
    const div = document.createElement('div');
    div.className = 'event-card';
    div.innerHTML = `
      <h4>${e.title}</h4>
      <p>${e.description}</p>
      <p><small>${new Date(e.date).toLocaleString()}</small></p>
      <p><em>${e.city} — ${e.category}</em></p>
      <button class="remove-saved-btn">Remove</button>
    `;
    div.querySelector('.remove-saved-btn').addEventListener('click', () => {
      toggleSaveEvent(e.id);
      renderSavedEvents();
    });
    savedEventsContainer.appendChild(div);
  });
}

// ─── Прогноз погоды для события (View Details) ─────────────────────────────
async function loadEventWeather(city, dateStr) {
  const weatherEl = document.getElementById('modal-weather');
  weatherEl.textContent = 'Loading weather forecast...';

  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((date - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      weatherEl.textContent = 'Event already happened.';
      return;
    }

    if (diffDays > 4) {
      // если слишком далеко — показываем фразу-заглушку
      weatherEl.textContent = `Typical weather in ${city} in ${date.toLocaleString('en-US', { month: 'long' })} is often unpredictable.`;
      return;
    }

    const coords = cityCoordsMap?.[city];
    if (!coords) {
      weatherEl.textContent = 'No weather data (missing coordinates).';
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
      weatherEl.textContent = `Forecast: ${desc}, ${temp}°C`;
    } else {
      weatherEl.textContent = `No forecast available yet.`;
    }
  } catch (err) {
    weatherEl.textContent = 'Weather unavailable.';
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
