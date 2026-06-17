const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const PANCAKE_API_KEY = process.env.PANCAKE_API_KEY;
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

async function getConversations() {
  try {
    const res = await axios.get(
      `https://pages.fm/api/v1/pages/${PAGE_ID}/conversations`,
      {
        headers: { "X-API-KEY": PANCAKE_API_KEY },
        params: { limit: 20 }
      }
    );
    return res.data.conversations || [];
  } catch (err) {
    console.error("Lỗi lấy hội thoại:", err.response?.data || err.message);
    return [];
  }
}

async function getMessages(conversationId) {
  try {
    const res = await axios.get(
      `https://pages.fm/api/v1/pages/${PAGE_ID}/conversations/${conversationId}/messages`,
      {
        headers: { "X-API-KEY": PANCAKE_API_KEY },
        params: { limit: 5 }
      }
    );
    return res.data.messages || [];
  } catch (err) {
    console.error("Lỗi lấy tin nhắn:", err.response?.data || err.message);
    return [];
  }
}

async function sendMessage(conversationId, message) {
  try {
    await axios.post(
      `https://pages.fm/api/v1/pages/${PAGE_ID}/conversations/${conversationId}/messages`,
      { message },
      { headers: { "X-API-KEY": PANCAKE_API_KEY } }
    );
    console.log(`✅ Đã gửi reply`);
  } catch (err) {
    console.error("Lỗi gửi tin:", err.response?.data || err.message);
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
  const convList = await getConversations();
  for (const conv of convList) {
    const convId = conv.id;
    const messages = await getMessages(convId);
    if (!messages.length) continue;

    const lastMsg = messages[0];
    if (!lastMsg) continue;

    const msgId = lastMsg.id;
    // Chỉ xử lý tin từ khách (không phải từ page)
    const isFromCustomer = lastMsg.from_page === false;
    if (processedMessages.has(msgId) || !isFromCustomer) continue;

    processedMessages.add(msgId);
    if (processedMessages.size > 1000) {
      const first = processedMessages.values().next().value;
      processedMessages.delete(first);
    }

    const customerId = conv.customer?.id || convId;
    const text = lastMsg.message || lastMsg.text || "";
    if (!text.trim()) continue;

    console.log(`📩 Khách [${customerId}]: ${text}`);
    const reply = await askClaude(customerId, text);
    if (reply) await sendMessage(convId, reply);
  }
}

setInterval(pollMessages, POLL_INTERVAL);
console.log("🤖 Bot Ngọc Linh Store đang chạy...");

app.get("/", (req, res) => res.send("✅ Ngọc Linh Store Bot đang hoạt động!"));

// Dùng PORT từ Railway, mặc định 8080
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server chạy tại port ${PORT}`);
});