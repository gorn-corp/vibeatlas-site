import { fetchWeather, getTimeOfDay } from './weather.js';

console.log('API ключ:', import.meta.env.VITE_WEATHER_API_KEY);

// Пример работы функций (если они уже реализованы в weather.js)
async function init() {
  try {
    const city = 'Moscow';
    const weatherData = await fetchWeather(city);
    console.log(`Погода в ${city}:`, weatherData);

    const timeOfDay = getTimeOfDay();
    console.log('Сейчас:', timeOfDay);
  } catch (err) {
    console.error('Ошибка при получении данных:', err);
  }
}

init();

