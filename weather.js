const API_KEY = '4fa7ffeee5d231eb59154b86e43cdbbe';
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

/**
 * Fetches weather data for a given city and updates the DOM.
 * @param {string} city
 */
export async function fetchWeather(city) {
  const url = `${BASE_URL}?q=${city}&units=metric&appid=${API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }
  const data = await response.json();

  // Update DOM
  document.getElementById('city-name').textContent = data.name;
  document.getElementById('temperature').textContent = data.main.temp.toFixed(1);
  document.getElementById('weather-condition').textContent = data.weather[0].description;
  const icon = data.weather[0].icon;
  const isDay = icon.endsWith('d');
  document.getElementById('day-status').textContent = isDay ? 'Day' : 'Night';

  return data;
}

/**
 * Determines the time of day.
 * @returns {'morning'|'day'|'evening'|'night'}
 */
export function getTimeOfDay() {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'day';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}