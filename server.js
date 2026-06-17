const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

// ==========================================
// CẤU HÌNH - ĐIỀN KEY CỦA BẠN VÀO ĐÂY
// ==========================================
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY; // sk-ant-...
const PANCAKE_API_KEY = process.env.PANCAKE_API_KEY; // key từ Pancake
// Lưu lịch sử chat từng khách (trong RAM)
const conversations = {};

// ==========================================
// SYSTEM PROMPT - Nhân viên Ngọc Linh Store
// ==========================================
const SYSTEM_PROMPT = `Bạn là nhân viên tư vấn bán hàng của Ngọc Linh Store - shop thời trang và phụ kiện.

NHIỆM VỤ CỦA BẠN:
- Chào hỏi thân thiện, nhiệt tình
- Tư vấn sản phẩm thời trang, phụ kiện phù hợp với khách
- Hỏi size, màu sắc, sở thích của khách
- Chốt đơn hàng bằng cách hỏi: Tên, Số điện thoại, Địa chỉ giao hàng
- Xác nhận lại đơn hàng trước khi kết thúc
- Thông báo thời gian giao hàng 2-3 ngày

CÁCH TRẢ LỜI:
- Ngắn gọn, tự nhiên như nhắn tin thật
- Dùng emoji vừa phải 😊
- Không trả lời quá dài, tối đa 4-5 câu mỗi lần
- Nếu khách hỏi giá mà không có thông tin, nói "Em sẽ báo giá cụ thể ngay ạ"
- Luôn kết thúc bằng câu hỏi để duy trì hội thoại

KHI CHỐT ĐƠN: Hỏi lần lượt:
1. Tên khách
2. Số điện thoại  
3. Địa chỉ giao hàng
4. Xác nhận lại toàn bộ đơn

QUAN TRỌNG: Chỉ trả lời bằng tiếng Việt.`;

// ==========================================
// NHẬN WEBHOOK TỪ PANCAKE
// ==========================================
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Phản hồi Pancake ngay

  try {
    const { messages, customer } = req.body;
    if (!messages || messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.type !== "customer") return; // Chỉ xử lý tin từ khách

    const customerId = customer?.id || "unknown";
    const customerMessage = lastMsg.message;
    const conversationId = req.body.conversation_id;

    console.log(`[${customerId}] Khách nhắn: ${customerMessage}`);

    // Lấy lịch sử chat
    if (!conversations[customerId]) {
      conversations[customerId] = [];
    }

    // Thêm tin nhắn khách vào lịch sử
    conversations[customerId].push({
      role: "user",
      content: customerMessage,
    });

    // Giới hạn lịch sử 20 tin gần nhất
    if (conversations[customerId].length > 20) {
      conversations[customerId] = conversations[customerId].slice(-20);
    }

    // Gọi Claude API
    const claudeResponse = await axios.post(
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

    const botReply = claudeResponse.data.content[0].text;
    console.log(`[${customerId}] Bot trả lời: ${botReply}`);

    // Lưu reply vào lịch sử
    conversations[customerId].push({
      role: "assistant",
      content: botReply,
    });

    // Gửi trả lời về Pancake
    await axios.post(
      `https://pages.fm/api/v1/conversations/${conversationId}/messages`,
      { message: botReply },
      {
        headers: {
          "X-API-KEY": PANCAKE_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Lỗi:", err.response?.data || err.message);
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("Ngọc Linh Store Bot đang chạy ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server chạy tại port ${PORT}`);
});
