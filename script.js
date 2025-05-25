// script.js
import { fetchWeather, getTimeOfDay } from './weather.js';

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

  // 5) Применяем тему фона
  applyTimeTheme();
});
