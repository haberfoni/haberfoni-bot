import axios from 'axios';
import { getSettingByKey } from './db.js';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function rewriteNews(title, summary, content) {
    // Gemini Free Tier kotasina (15 RPM) takilmamak icin 4 saniye bekle
    await sleep(4000);

    const apiKey = await getSettingByKey('ai_api_key');
    const groqKey = await getSettingByKey('groq_api_key');
    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';

    if (!apiKey && !groqKey) {
        console.warn('[AI] No API keys found in database.');
        return null;
    }

    const prompt = `Lütfen aşağıdaki haberi, profesyonel bir haber editörü gibi davranarak, SEO kurallarına uygun, ilgi çekici ve özgün bir şekilde yeniden yaz. 
    Haberin anlamını bozma ama cümleleri tamamen değiştir.

    BAŞLIK: ${title}
    ÖZET: ${summary}
    İÇERİK: ${content}

    Yanıtını şu JSON formatında ver (sadece JSON döndür):
    {
      "title": "Yeni Başlık",
      "summary": "Yeni Özet",
      "content": "Yeni İçerik (HTML formatında)",
      "seo_title": "SEO Başlığı",
      "seo_description": "SEO Açıklaması",
      "seo_keywords": "keyword1, keyword2, keyword3",
      "title_en": "English Title",
      "summary_en": "English Summary",
      "content_en": "English Content"
    }`;

    // Try Gemini First
    if (apiKey) {
        try {
            console.log('[AI] Attempting rewrite with Gemini...');
            const response = await axios.post(`${apiUrl}?key=${apiKey}`, {
                contents: [{ parts: [{ text: prompt }] }]
            }, { timeout: 30000 });

            if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                const rawText = response.data.candidates[0].content.parts[0].text;
                const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const result = JSON.parse(jsonMatch[0]);
                    result.model = 'Gemini';
                    return result;
                }
            }
        } catch (error) {
            console.error('[AI] Gemini Error:', error.response?.data || error.message);
            // Fallback to Groq handled below
        }
    }

    // Fallback to Groq
    if (groqKey) {
        try {
            console.log('[AI] Gemini failed or unavailable. Falling back to Groq...');
            const response = await axios.post(groqUrl, {
                model: "mixtral-8x7b-32768",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                response_format: { type: "json_object" }
            }, {
                headers: { 'Authorization': `Bearer ${groqKey}` },
                timeout: 30000
            });

            if (response.data?.choices?.[0]?.message?.content) {
                const result = JSON.parse(response.data.choices[0].message.content);
                result.model = 'Groq (Safe Fallback)';
                return result;
            }
        } catch (error) {
            console.error('[AI] Groq Error:', error.response?.data || error.message);
        }
    }

    return null;
}
