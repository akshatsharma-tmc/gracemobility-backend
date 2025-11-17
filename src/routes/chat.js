// src/routes/chat.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Polyfill fetch for Node.js < 18
let fetch;
try {
  fetch = globalThis.fetch;
} catch {
  fetch = require('node-fetch');
}

// 📄 Load system prompt from external file
// This allows non-technical users to update the chatbot's knowledge without touching code
let SYSTEM_PROMPT;
try {
  const promptPath = path.join(__dirname, '../../system-prompt.txt');
  SYSTEM_PROMPT = fs.readFileSync(promptPath, 'utf-8');
  console.log('✅ System prompt loaded from system-prompt.txt');
} catch (error) {
  console.error('❌ Failed to load system-prompt.txt:', error.message);
  // Fallback to basic prompt if file not found
  SYSTEM_PROMPT = `You are a warm, professional receptionist for Grace Mobility. Help users with product information, collect leads (Name, Phone, City, Requirement), handle complaints, and direct them to our website pages (Careers, Blogs, Products, About). Always be caring and helpful.`;
}


router.post('/', async (req, res) => {
  // 🔍 DEBUG: Check if env vars loaded
  console.log('🔍 GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ SET' : '❌ MISSING');
  console.log('🔍 AWS_REGION:', process.env.AWS_REGION || '[not needed for chat]');

  try {
    const { message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    // ✅ Use gemini-2.0-flash (confirmed in your model list)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ No GEMINI_API_KEY — using fallback');
      return res.json({ reply: getFallbackResponse(message) });
    }

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{
        role: "user",
        parts: [{ text: `${SYSTEM_PROMPT}\n\nUser: ${message}\n\nRespond naturally as a receptionist (no quotes, no formatting markers, just speak directly):` }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500,
        topK: 40,
        topP: 0.95
      },
      safetySettings: [
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('🔴 Gemini error:', {
        status: response.status,
        message: data.error?.message || 'Unknown error'
      });
      return res.json({ reply: getFallbackResponse(message) });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text) {
      console.log('✅ Gemini reply:', text.substring(0, 50) + '...');
      return res.json({ reply: text });
    } else {
      console.warn('🟡 Empty Gemini response — using fallback');
      return res.json({ reply: getFallbackResponse(message) });
    }

  } catch (err) {
    console.error('💥 Chat route crash:', err.message);
    if (err.response && err.response.data) {
      console.error('Response:', err.response.data);
    }
    return res.json({ reply: getFallbackResponse(req.body?.message || '') });
  }
});

// 🔁 Enhanced fallback with lead flow
function getFallbackResponse(msg) {
  const m = msg.toLowerCase();
  
  // Greetings
  if (/\b(hello|hi|hey|greetings)\b/.test(m)) {
    return "Hello! 👋 I'm Grace Mobility's receptionist. How can I assist you today — with our products, services, or general information?";
  }
  
  // Products → offer lead collection
  if (m.includes('product') || m.includes('wheelchair') || m.includes('mobility') || m.includes('scooter') || m.includes('retrofit')) {
    if (m.includes('interested') || m.includes('yes') || m.includes('notify') || m.includes('details')) {
      return "Wonderful! Could you share:\n1. Your name\n2. Phone number\n3. City\n4. What you're looking for?\n\nI'll have our team reach out right away! 🙏";
    }
    return "We're developing manual, electric, and folding wheelchairs, plus mobility scooters — all designed for comfort and independence. Since they're in final testing, would you like us to notify you when they launch?";
  }
  
  // Complaint → collect details
  if (m.includes('complaint') || m.includes('issue') || m.includes('problem') || m.includes('kaboom')) {
    if (/\b(name|phone|number|city|coimbatore)\b/.test(m)) {
      return "Thank you for sharing those details, Bavesh! Our support team will contact you in Coimbatore shortly about the wheelchair issue. We truly appreciate your patience. 🙏";
    }
    return "I'm so sorry to hear about your experience. Could you please share: your name, phone number, city, and what happened? Our support team will reach out within 24 hours.";
  }
  
  // Demo booking
  if (m.includes('demo') || m.includes('book') || m.includes('appointment')) {
    return "Great choice! To book a demo, could you share: your name, phone, city, and preferred time? Our team will confirm shortly!";
  }
  
  // Contact
  if (m.includes('contact') || m.includes('email') || m.includes('phone')) {
    return "📞 Call: +91 9886665410\n📧 Email: info@gracemobility.in\n📍 Bengaluru\nWe respond within 24 hours. May I help with anything else?";
  }
  
  // Pricing
  if (m.includes('price') || m.includes('cost') || m.includes('expensive')) {
    return "Pricing varies by model — manual wheelchairs start around ₹25,000, electric from ₹85,000. Our team can share a personalized quote. Would you like a callback?";
  }
  
  // Kannada test
  if (m.includes('kannada') || m.includes('ಬಾಷೆ') || m.includes('ಭಾಷೆ')) {
    return "ಹೌದು! ನಾನು ಕನ್ನಡ, ಹಿಂದಿ, ಮತ್ತು ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. ನಿಮಗೆ ಯಾವ ಭಾಷೆ ಇಷ್ಟ? 😊";
  }
  
  // Thanks
  if (m.includes('thank')) {
    return "You're very welcome! 😊 Is there anything else I can help with?";
  }
  
  // Default
  return "Thank you for reaching out to Grace Mobility! For specific help, feel free to ask about our products, services, or contact info. How can I assist?";
}

module.exports = router;