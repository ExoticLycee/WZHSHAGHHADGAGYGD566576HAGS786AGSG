// api/discord.js
// Backend untuk kirim ke Discord - TOKEN AMAN DI SINI!

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Ambil webhook URL dari environment variable (AMAN!)
    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
    
    if (!DISCORD_WEBHOOK_URL) {
      console.error('Discord webhook URL not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Parse data dari frontend
    const { customerData, cartData, totalAmount, proofImage } = req.body;

    // Validasi data
    if (!customerData || !cartData || !totalAmount) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    // Sensor data sensitif
    const censorPhone = (phone) => {
      if (!phone) return '-';
      const length = phone.length;
      if (length <= 6) return phone;
      return phone.substring(0, 3) + '****' + phone.substring(length - 4);
    };

    const censorEmail = (email) => {
      if (!email) return '-';
      const parts = email.split('@');
      if (parts.length !== 2) return email;
      const username = parts[0];
      const domain = parts[1];
      if (username.length <= 2) return email;
      return username.substring(0, 2) + '**@' + domain;
    };

    // Buat embed Discord
    const embed = {
      title: "🛒 PEMBAYARAN BARU MASUK!",
      color: 0x00ff88,
      fields: [
        {
          name: "👤 Data Customer",
          value: `**Nama:** ${customerData.name}\n**WA:** ${censorPhone(customerData.phone)}\n**Email:** ${censorEmail(customerData.email)}`,
          inline: false
        },
        {
          name: "📦 Pesanan",
          value: cartData.map(item => 
            `${item.quantity}x ${item.name} - Rp ${(item.price * item.quantity).toLocaleString('id-ID')}`
          ).join('\n'),
          inline: false
        },
        {
          name: "💰 Total Pembayaran",
          value: `**Rp ${totalAmount.toLocaleString('id-ID')}**`,
          inline: true
        },
        {
          name: "⏰ Waktu",
          value: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
          inline: true
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "WarpahExploits Payment System",
        icon_url: "https://res.cloudinary.com/dsjctfzj1/image/upload/v1760351559/IMG-20251007-WA0626_dv8s8r.jpg"
      }
    };

    if (customerData.note) {
      embed.fields.push({
        name: "📝 Catatan",
        value: customerData.note,
        inline: false
      });
    }

    // Kirim ke Discord
    let discordPayload = {
      content: `@everyone **🔔 PEMBAYARAN BARU!**`,
      embeds: [embed]
    };

    // Jika ada bukti transfer (base64)
    if (proofImage) {
      // Convert base64 to buffer
      const base64Data = proofImage.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Kirim dengan file attachment
      const formData = new FormData();
      formData.append('file', new Blob([buffer]), 'bukti-transfer.jpg');
      formData.append('payload_json', JSON.stringify(discordPayload));
      
      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Discord API error: ${response.status}`);
      }
    } else {
      // Kirim tanpa file
      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordPayload)
      });

      if (!response.ok) {
        throw new Error(`Discord API error: ${response.status}`);
      }
    }

    return res.status(200).json({ 
      success: true,
      message: 'Data berhasil dikirim ke Discord'
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
