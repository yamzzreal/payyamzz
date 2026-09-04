// Vercel Serverless Function
// Environment variables required:
// TELEGRAM_BOT_TOKEN = token from @BotFather
// TELEGRAM_CHAT_ID   = admin/group/channel chat ID

export const config = {
  api: { bodyParser: false }
};

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      try {
        const buffer = Buffer.concat(chunks);
        const type = req.headers["content-type"] || "";
        const m = type.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        if (!m) return reject(new Error("Multipart boundary tidak ditemukan"));
        const boundary = Buffer.from("--" + (m[1] || m[2]));
        const parts = [];
        let start = 0;
        while (true) {
          const i = buffer.indexOf(boundary, start);
          if (i === -1) break;
          if (start !== 0) {
            const part = buffer.subarray(start, i);
            if (part.length > 4) parts.push(part.subarray(2)); // remove CRLF
          }
          start = i + boundary.length;
        }
        const fields = {};
        let file = null;
        for (const part of parts) {
          const sep = part.indexOf(Buffer.from("\r\n\r\n"));
          if (sep < 0) continue;
          const headers = part.subarray(0, sep).toString("utf8");
          let body = part.subarray(sep + 4);
          if (body.subarray(-2).toString() === "\r\n") body = body.subarray(0, -2);
          const nm = headers.match(/name="([^"]+)"/i);
          if (!nm) continue;
          const name = nm[1];
          const fm = headers.match(/filename="([^"]*)"/i);
          if (fm) {
            const cm = headers.match(/Content-Type:\s*([^\r\n]+)/i);
            file = { filename: fm[1], contentType: (cm?.[1] || "application/octet-stream").trim(), buffer: body };
          } else {
            fields[name] = body.toString("utf8");
          }
        }
        resolve({ fields, file });
      } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function escapeHtml(s="") {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method tidak diizinkan" });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(500).json({ error: "Telegram belum dikonfigurasi di Vercel." });

  try {
    const { fields, file } = await parseMultipart(req);
    const { name, whatsapp, amount, payment, orderDetail } = fields;
    if (!name || !whatsapp || !amount || !payment || !orderDetail || !file) {
      return res.status(400).json({ error: "Data pembayaran belum lengkap." });
    }
    if (!["qris","dana","seabank"].includes(payment)) return res.status(400).json({ error: "Metode pembayaran tidak valid." });
    if (!["image/jpeg","image/png","image/jpg"].includes(file.contentType)) return res.status(400).json({ error: "Bukti harus JPG/PNG." });
    if (file.buffer.length > 5 * 1024 * 1024) return res.status(400).json({ error: "Bukti maksimal 5MB." });

    const id = "YMZ-" + Date.now().toString().slice(-8);
    const method = {qris:"QRIS",dana:"DANA",seabank:"SeaBank"}[payment];
    const rupiah = Number(amount).toLocaleString("id-ID");
    const caption = `🧾 <b>PEMBAYARAN BARU — YAMZZ MARKET</b>\n\n`+
      `🆔 <b>ID:</b> <code>${id}</code>\n`+
      `👤 <b>Nama:</b> ${escapeHtml(name)}\n`+
      `📱 <b>WhatsApp:</b> ${escapeHtml(whatsapp)}\n`+
      `💰 <b>Nominal:</b> Rp ${escapeHtml(rupiah)}\n`+
      `💳 <b>Metode:</b> ${method}\n`+
      `🛒 <b>Pesanan:</b> ${escapeHtml(orderDetail)}\n`+
      `🟡 <b>Status:</b> PENDING`;

    const tgUrl = `https://api.telegram.org/bot${token}/sendPhoto`;
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("photo", new Blob([file.buffer], {type:file.contentType}), file.filename || "bukti.jpg");
    form.append("reply_markup", JSON.stringify({
      inline_keyboard: [[
        {text:"✅ TERIMA", callback_data:`approve:${id}`},
        {text:"❌ TOLAK", callback_data:`reject:${id}`}
      ]]
    }));

    const tg = await fetch(tgUrl, {method:"POST", body:form});
    const result = await tg.json();
    if (!tg.ok || !result.ok) {
      console.error(result);
      return res.status(502).json({ error: "Gagal mengirim ke Telegram." });
    }

    return res.status(200).json({ ok:true, transactionId:id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error:"Terjadi kesalahan server." });
  }
}