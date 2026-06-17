const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

// ==========================================
// CẤU HÌNH
// ==========================================
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const PANCAKE_API_KEY = process.env.PANCAKE_API_KEY;
const PAGE_ID = "271557229384823"; // Ngọc Linh Store
const POLL_INTERVAL = 5000; // Kiểm tra tin mỗi 5 giây

// Lưu lịch sử chat và tin đã xử lý
const conversations = {};
const processedMessages = new Set();

// ==========================================
// SYSTEM PROMPT - Nhân viên Ngọc Linh Store
// ==========================================
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

// ==========================================
// LẤY DANH SÁCH HỘI THOẠI MỚI TỪ PANCAKE
// ==========================================
async function getConversations() {
  try {
    const res = await axios.get(
      `https://pages.fm/api/v1/pages/${PAGE_ID}/conversations`,
      {
        headers: { "X-API-KEY": PANCAKE_API_KEY },
        params: { limit: 20, status: "open" }
      }
    );
    return res.data.conversations || [];
  } catch (err) {
    console.error("Lỗi lấy hội thoại:", err.response?.data || err.message);
    return [];
  }
}

// ==========================================
// LẤY TIN NHẮN MỚI NHẤT TRONG HỘI THOẠI
// ==========================================
async function getMessages(conversationId) {
  try {
    const res = await axios.get(
      `https://pages.fm/api/v1/pages/${PAGE_ID}/conversations/${conversationId}/messages`,
      {
        headers: { "X-API-KEY": PANCAKE_API_KEY },
        params: { limit: 10 }
      }
    );
    return res.data.messages || [];
  } catch (err) {
    console.error("Lỗi lấy tin nhắn:", err.response?.data || err.message);
    return [];
  }
}

// ==========================================
// GỬI TIN NHẮN TRẢ LỜI QUA PANCAKE
// ==========================================
async function sendMessage(conversationId, message) {
  try {
    await axios.post(
      `https://pages.fm/api/v1/pages/${PAGE_ID}/conversations/${conversationId}/messages`,
      { message },
      { headers: { "X-API-KEY": PANCAKE_API_KEY } }
    );
    console.log(`✅ Đã gửi: ${message.substring(0, 50)}...`);
  } catch (err) {
    console.error("Lỗi gửi tin:", err.response?.data || err.message);
  }
}

// ==========================================
// GỌI CLAUDE ĐỂ TẠO PHẢN HỒI
// ==========================================
async function askClaude(customerId, userMessage) {
  if (!conversations[customerId]) conversations[customerId] = [];

  conversations[customerId].push({ role: "user", content: userMessage });

  // Giữ tối đa 20 tin gần nhất
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

// ==========================================
// VÒNG LẶP POLLING - Kiểm tra tin mỗi 5 giây
// ==========================================
async function pollMessages() {
  const convList = await getConversations();

  for (const conv of convList) {
    const convId = conv.id;
    const messages = await getMessages(convId);

    if (!messages.length) continue;

    // Lấy tin nhắn mới nhất từ khách
    const lastMsg = messages[0]; // Tin mới nhất
    if (!lastMsg) continue;

    const msgId = lastMsg.id;
    const isFromCustomer = lastMsg.from_page === false || lastMsg.type === "customer";

    // Bỏ qua nếu đã xử lý hoặc không phải tin từ khách
    if (processedMessages.has(msgId) || !isFromCustomer) continue;

    processedMessages.add(msgId);

    // Giới hạn set không quá lớn
    if (processedMessages.size > 1000) {
      const first = processedMessages.values().next().value;
      processedMessages.delete(first);
    }

    const customerId = conv.customer?.id || convId;
    const text = lastMsg.message || lastMsg.text || "";

    if (!text) continue;

    console.log(`📩 [${customerId}] Khách: ${text}`);

    const reply = await askClaude(customerId, text);
    if (reply) {
      await sendMessage(convId, reply);
    }
  }
}

// Bắt đầu polling
setInterval(pollMessages, POLL_INTERVAL);
console.log("🤖 Bot Ngọc Linh Store đang chạy, kiểm tra tin mỗi 5 giây...");

// Health check endpoint
app.get("/", (req, res) => {
  res.send("✅ Ngọc Linh Store Bot đang hoạt động!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy tại port ${PORT}`);
});