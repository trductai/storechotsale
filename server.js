const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN; // Facebook Page Access Token
const VERIFY_TOKEN = "ngoclinh2024";

const conversations = {};

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
// WEBHOOK VERIFICATION - Facebook yêu cầu
// ==========================================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log(`Webhook verify: mode=${mode}, token=${token}`);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified!");
    res.status(200).send(challenge);
  } else {
    console.log("❌ Webhook verify failed!");
    res.sendStatus(403);
  }
});

// ==========================================
// NHẬN TIN NHẮN TỪ FACEBOOK
// ==========================================
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Phản hồi Facebook ngay

  const body = req.body;
  if (body.object !== "page") return;

  for (const entry of body.entry) {
    const messaging = entry.messaging || [];
    for (const event of messaging) {
      if (!event.message || event.message.is_echo) continue;

      const senderId = event.sender.id;
      const text = event.message.text;
      if (!text) continue;

      console.log(`📩 Khách [${senderId}]: ${text}`);

      const reply = await askClaude(senderId, text);
      if (reply) await sendMessage(senderId, reply);
    }
  }
});

// ==========================================
// GỌI CLAUDE
// ==========================================
async function askClaude(userId, userMessage) {
  if (!conversations[userId]) conversations[userId] = [];
  conversations[userId].push({ role: "user", content: userMessage });
  if (conversations[userId].length > 20) {
    conversations[userId] = conversations[userId].slice(-20);
  }
  try {
    const res = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: conversations[userId],
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
    conversations[userId].push({ role: "assistant", content: reply });
    return reply;
  } catch (err) {
    console.error("Lỗi Claude:", err.response?.data || err.message);
    return null;
  }
}

// ==========================================
// GỬI TIN NHẮN QUA FACEBOOK
// ==========================================
async function sendMessage(recipientId, message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${FB_PAGE_TOKEN}`,
      {
        recipient: { id: recipientId },
        message: { text: message },
      }
    );
    console.log(`✅ Đã reply cho ${recipientId}`);
  } catch (err) {
    console.error("Lỗi gửi tin:", err.response?.data || err.message);
  }
}

app.get("/", (req, res) => res.send("✅ Ngọc Linh Store Bot đang hoạt động!"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server chạy tại port ${PORT}`);
});