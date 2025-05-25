const API_KEY = import.meta.env.VITE_WEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

export async function fetchWeather(city) {
  const url = `${BASE_URL}?q=${city}&units=metric&appid=${API_KEY}&lang=ru`;

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  return data;
}

export function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'утро';
  if (hour >= 12 && hour < 18) return 'день';
  if (hour >= 18 && hour < 22) return 'вечер';
  return 'ночь';
}
