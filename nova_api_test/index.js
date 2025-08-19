import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testOpenAI() {
  try {
    console.log("Отправляем запрос к OpenAI...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Ты помощник, который отвечает одним предложением." },
        { role: "user", content: "Скажи что-нибудь дружелюбное, чтобы проверить API." }
      ]
    });

    console.log("Ответ OpenAI:", response.choices[0].message.content);
  } catch (error) {
    console.error("Ошибка при запросе к OpenAI:", error);
  }
}

testOpenAI();
