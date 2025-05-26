// script.js
import { fetchWeather, getTimeOfDay } from './weather.js';
import { events } from './events.js';

const defaultCity = 'London';
const cityInput = document.getElementById('city-input');
const getWeatherBtn = document.getElementById('get-weather-btn');

// Элементы для splash-экрана
const splash = document.getElementById('splash');
const enterBtn = document.getElementById('enter-btn');

/**
 * Запрашивает и показывает погоду для указанного города.
 * @param {string} city
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
 * Применяет тему страницы по времени суток.
 */
function applyTimeTheme() {
  const phase = getTimeOfDay(); // 'morning'|'day'|'evening'|'night'
  document.body.classList.add(`theme-${phase}`);
}

window.addEventListener('DOMContentLoaded', () => {
  // 1) Скрытие splash-экрана при клике
  enterBtn.addEventListener('click', () => {
    splash.style.display = 'none';
  });

  // 2) Загрузка погоды по умолчанию
  update(defaultCity);

  // 3) Обработчик кнопки
  getWeatherBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) update(city);
  });

  // 4) Обработка Enter в поле ввода
  cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      getWeatherBtn.click();
    }
  });

  /**
 * Рендерит карточки событий в контейнер #events-container
 */
function renderEvents() {
  const container = document.getElementById('events-container');
  container.innerHTML = ''; // очищаем
  events.forEach(event => {
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

  // 5) Применяем тему фона
  applyTimeTheme();

  // 6) Рендерим события
  renderEvents();
});
