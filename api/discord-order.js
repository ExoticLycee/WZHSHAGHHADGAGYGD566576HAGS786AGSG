export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { customerData, cartData, totalAmount, proofImage } = req.body;

    // GANTI NAMA VARIABLE INI! 👇
    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL; // Bukan DISCORD_WEBHOOK_ORDER!

    if (!DISCORD_WEBHOOK_URL) {
      console.error('Webhook URL tidak ditemukan di environment variables');
      return res.status(500).json({ 
        success: false, 
        error: 'Webhook URL tidak dikonfigurasi' 
      });
    }

    console.log('Mengirim ke webhook ORDER...');

    // Format items untuk embed
    const itemsText = cartData.map(item => 
      `${item.quantity}x **${item.name}** - Rp ${(item.price * item.quantity).toLocaleString('id-ID')}`
    ).join('\n');

    // Buat embed Discord
    const embed = {
      title: '🛒 PEMBELIAN BARU - WarpahExploits',
      color: 0x00ff88,
      fields: [
        {
          name: '👤 Data Customer',
          value: `**Nama:** ${customerData.name}\n**WhatsApp:** ${customerData.phone}\n**Email:** ${customerData.email || '-'}`,
          inline: false
        },
        {
          name: '📦 Detail Pesanan',
          value: itemsText,
          inline: false
        },
        {
          name: '💰 Total Pembayaran',
          value: `**Rp ${totalAmount.toLocaleString('id-ID')}**`,
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'WarpahExploits Order System'
      }
    };

    if (customerData.note) {
      embed.fields.push({
        name: '📝 Catatan',
        value: customerData.note,
        inline: false
      });
    }

    const discordPayload = {
      content: '🔔 **NEW ORDER ALERT!**',
      embeds: [embed]
    };

    // Kirim tanpa file dulu (simplified version)
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Discord API Error:', errorText);
      throw new Error(`Discord webhook gagal: ${response.status}`);
    }

    console.log('✅ Berhasil kirim ke Discord ORDER');

    // Jika ada bukti transfer, kirim sebagai message terpisah
    if (proofImage) {
      const base64Data = proofImage.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Create FormData for file upload
      const FormData = require('form-data');
      const form = new FormData();
      
      form.append('content', '📸 **Bukti Transfer:**');
      form.append('file', buffer, {
        filename: `bukti_${Date.now()}.jpg`,
        contentType: 'image/jpeg'
      });

      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Order berhasil dikirim ke Discord' 
    });

  } catch (error) {
    console.error('Error di discord-order.js:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
