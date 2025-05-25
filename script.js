import { fetchWeather, getTimeOfDay } from './weather.js';

const defaultCity = 'London';
const cityInput = document.getElementById('city-input');
const getWeatherBtn = document.getElementById('get-weather-btn');

async function update(city) {
  try {
    await fetchWeather(city);
  } catch (err) {
    console.error('Error fetching weather:', err);
    alert(`Could not get weather for "${city}". Please check the city name.`);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // 1) Загрузка по умолчанию
  update(defaultCity);

  // 2) Обработчик клика по кнопке
  getWeatherBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) {
      update(city);
    }
  });

  // 3) Обработка Enter в поле ввода
  cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      getWeatherBtn.click();
    }
  });
});

import { getTimeOfDay } from './weather.js';

/**
 * Устанавливает класс на <body> в зависимости от времени суток
 */
function applyTimeTheme() {
  const phase = getTimeOfDay(); // 'morning' | 'day' | 'evening' | 'night'
  document.body.classList.add(`theme-${phase}`);
}

// после DOMContentLoaded, сразу после update(defaultCity);
window.addEventListener('DOMContentLoaded', () => {
  // ...существующий код...

  // Настройка темы
  applyTimeTheme();
});
