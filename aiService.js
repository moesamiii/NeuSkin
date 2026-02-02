// aiService.js
import Groq from "groq-sdk";

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function askAI(userMessage) {
  const completion = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "أنت موظف خدمة عملاء (call center) لعيادة. رد فقط على الأسئلة المتعلقة بالمواعيد، الأسعار، الموقع، والحجز. ولا تجاوب خارج هذا النطاق. تحدث بالعربية فقط.",
      },
      { role: "user", content: userMessage },
    ],
  });

  return completion.choices[0]?.message?.content;
}
