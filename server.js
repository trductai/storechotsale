const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const PANCAKE_TOKEN = process.env.PANCAKE_API_KEY;
const PAGE_ID = "271557229384823";
const POLL_INTERVAL = 5000;

const conversations = {};
const processedMessages = new Set();

const SYSTEM_PROMPT = `Bạn là nhân viên tư vấn bán hàng của Ngọc Linh Store - shop thời trang và phụ kiện.

NHIỆM VỤ:
- Chào hỏi thân thiện, nhiệt tình
- Tư vấn sản phẩm thời trang, phụ kiện phù hợp với khách
- Hỏi size, màu sắc, sở thích của khách
- Chốt đơn hàng bằng cách hỏi: Tên, Số điện thoại, Địa chỉ giao hàng
- Xác nhận lại đơn hàng trước khi kết thúc
- Thông báo thời gian giao hàng 2-3 ngày

CÁCH TRẢ LỜI:
- Ngắn gọn, tự nhiên như nhắn tin thật
- Dùng emoji vừa phải 😊
- Tối đa 4-5 câu mỗi lần
- Luôn kết thúc bằng câu hỏi để duy trì hội thoại

KHI CHỐT ĐƠN hỏi lần lượt:
1. Tên khách
2. Số điện thoại
3. Địa chỉ giao hàng
4. Xác nhận lại toàn bộ đơn

Chỉ trả lời bằng tiếng Việt.`;

async function apiGet(url, params = {}) {
  try {
    const res = await axios.get(url, {
      headers: { "Authorization": `Bearer ${PANCAKE_TOKEN}` },
      params
    });
    return res.data;
  } catch (err) {
    try {
      const res2 = await axios.get(url, { params: { ...params, access_token: PANCAKE_TOKEN } });
      return res2.data;
    } catch (err2) {
      console.error("API GET lỗi:", err2.response?.data || err2.message);
      return null;
    }
  }
}

async function apiPost(url, data) {
  try {
    await axios.post(url, data, {
      headers: { "Authorization": `Bearer ${PANCAKE_TOKEN}`, "Content-Type": "application/json" }
    });
    return true;
  } catch (err) {
    try {
      await axios.post(`${url}?access_token=${PANCAKE_TOKEN}`, data);
      return true;
    } catch (err2) {
      console.error("API POST lỗi:", err2.response?.data || err2.message);
      return false;
    }
  }
}

async function askClaude(customerId, userMessage) {
  if (!conversations[customerId]) conversations[customerId] = [];
  conversations[customerId].push({ role: "user", content: userMessage });
  if (conversations[customerId].length > 20) {
    conversations[customerId] = conversations[customerId].slice(-20);
  }
  try {
    const res = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: conversations[customerId],
      },
      {
        headers: {
          "x-api-key": CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      }
    );
    const reply = res.data.content[0].text;
    conversations[customerId].push({ role: "assistant", content: reply });
    return reply;
  } catch (err) {
    console.error("Lỗi Claude:", err.response?.data || err.message);
    return null;
  }
}

async function pollMessages() {
  const data = await apiGet(`https://pages.fm/api/v1/pages/${PAGE_ID}/conversations`, { limit: 10 });
  if (!data) return;

  const convList = data.conversations || [];
  console.log(`🔍 Tìm thấy ${convList.length} hội thoại`);

  for (const conv of convList) {
    const convId = conv.id;
    const msgData = await apiGet(
      `https://pages.fm/api/v1/pages/${PAGE_ID}/conversations/${convId}/messages`,
      { limit: 3 }
    );
    if (!msgData) continue;

    const messages = msgData.messages || [];
    if (!messages.length) continue;

    const lastMsg = messages[0];
    const msgId = lastMsg.id;

    // Log để debug
    console.log(`💬 Conv ${convId} - Tin cuối: "${lastMsg.message || lastMsg.text || ''}" | from_page: ${lastMsg.from_page} | type: ${lastMsg.type}`);

    // Bỏ qua tin đã xử lý
    if (processedMessages.has(msgId)) continue;

    // Chỉ xử lý tin từ KHÁCH (không phải từ page/bot)
    const isFromCustomer = lastMsg.from_page === false || lastMsg.from_page === 0 || lastMsg.type === "customer";
    if (!isFromCustomer) {
      console.log(`⏭️ Bỏ qua - tin từ page/bot`);
      processedMessages.add(msgId);
      continue;
    }

    processedMessages.add(msgId);
    if (processedMessages.size > 1000) {
      const first = processedMessages.values().next().value;
      processedMessages.delete(first);
    }

    const customerId = conv.customer?.id || convId;
    const text = lastMsg.message || lastMsg.text || "";
    if (!text.trim()) continue;

    console.log(`📩 KHÁCH [${customerId}]: ${text}`);
    const reply = await askClaude(customerId, text);
    if (reply) {
      const sent = await apiPost(
        `https://pages.fm/api/v1/pages/${PAGE_ID}/conversations/${convId}/messages`,
        { message: reply }
      );
      if (sent) console.log(`✅ Đã reply: ${reply.substring(0, 50)}...`);
    }
  }
}

setInterval(pollMessages, POLL_INTERVAL);
console.log("🤖 Bot Ngọc Linh Store đang chạy...");

app.get("/", (req, res) => res.send("✅ Ngọc Linh Store Bot đang hoạt động!"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server chạy tại port ${PORT}`);
});