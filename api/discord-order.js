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

    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

    if (!DISCORD_WEBHOOK_URL) {
      console.error('Webhook URL tidak ditemukan');
      return res.status(500).json({ 
        success: false, 
        error: 'Webhook URL tidak dikonfigurasi' 
      });
    }

    console.log('📤 Mengirim ke webhook ORDER...');

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

    // KIRIM EMBED + BUKTI TRANSFER
    if (proofImage) {
      try {
        const FormData = require('form-data');
        const form = new FormData();
        
        // Convert base64 to buffer
        const base64Data = proofImage.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Payload JSON untuk embed
        const payload = {
          content: '🔔 **NEW ORDER ALERT!**',
          embeds: [embed]
        };
        
        // Append payload dan file
        form.append('payload_json', JSON.stringify(payload));
        form.append('file', buffer, {
          filename: `order_${Date.now()}.jpg`,
          contentType: 'image/jpeg'
        });

        // Kirim ke Discord
        const response = await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          body: form
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Discord Error:', errorText);
          throw new Error(`Discord webhook failed: ${response.status}`);
        }

        console.log('✅ Berhasil kirim ke Discord ORDER (dengan bukti)');
      } catch (error) {
        console.error('❌ Error saat kirim dengan bukti:', error);
        
        // Fallback: Kirim tanpa bukti jika gagal
        const fallbackPayload = {
          content: '🔔 **NEW ORDER ALERT!** ⚠️ *Bukti transfer gagal diupload*',
          embeds: [embed]
        };

        await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackPayload)
        });

        console.log('⚠️ Kirim tanpa bukti transfer (fallback)');
      }
    } else {
      // Tidak ada bukti transfer
      const payload = {
        content: '🔔 **NEW ORDER ALERT!**',
        embeds: [embed]
      };

      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.status}`);
      }

      console.log('✅ Berhasil kirim ke Discord ORDER (tanpa bukti)');
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Order berhasil dikirim ke Discord' 
    });

  } catch (error) {
    console.error('❌ Error di discord-order.js:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
