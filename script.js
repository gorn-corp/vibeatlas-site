// script.js
import { fetchWeather, getTimeOfDay } from './weather.js';

const defaultCity = 'London';
const cityInput = document.getElementById('city-input');
const getWeatherBtn = document.getElementById('get-weather-btn');

/**
 * Запрашивает и показывает погоду для города.
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
 * Устанавливает тему страницы по времени суток.
 */
function applyTimeTheme() {
  const phase = getTimeOfDay(); // 'morning'|'day'|'evening'|'night'
  document.body.classList.add(`theme-${phase}`);
}

window.addEventListener('DOMContentLoaded', () => {
  // 1) Загрузка по умолчанию
  update(defaultCity);

  // 2) Обработчик клика по кнопке
  getWeatherBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) update(city);
  });

  // 3) Обработка Enter в поле ввода
  cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      getWeatherBtn.click();
    }
  });

  // 4) Применяем тему
  applyTimeTheme();
});
