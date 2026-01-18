export default async function handler(req, res) {
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
      return res.status(500).json({ success: false, error: 'Webhook not configured' });
    }

    console.log('📤 Sending to ORDER webhook...');

    // Format items
    const itemsText = cartData.map(item => 
      `${item.quantity}x **${item.name}** - Rp ${(item.price * item.quantity).toLocaleString('id-ID')}`
    ).join('\n');

    // Base embed
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
      footer: { text: 'WarpahExploits Order System' }
    };

    if (customerData.note) {
      embed.fields.push({
        name: '📝 Catatan',
        value: customerData.note,
        inline: false
      });
    }

    // Jika ada bukti, upload ke cloudinary dulu atau embed sebagai attachment
    if (proofImage) {
      // Method 1: Embed image di Discord embed (inline)
      embed.image = {
        url: 'attachment://proof.jpg'
      };

      try {
        // Menggunakan node-fetch dengan form-data
        const FormData = require('form-data');
        const form = new FormData();

        // Parse base64
        const matches = proofImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Invalid base64 format');
        }

        const imageBuffer = Buffer.from(matches[2], 'base64');
        console.log(`📦 Image buffer size: ${imageBuffer.length} bytes`);

        // Build payload
        const payload = {
          content: '🔔 **NEW ORDER ALERT!**',
          embeds: [embed]
        };

        // Append to form
        form.append('payload_json', JSON.stringify(payload));
        form.append('files[0]', imageBuffer, {
          filename: 'proof.jpg',
          contentType: 'image/jpeg'
        });

        // Send to Discord
        const response = await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          body: form,
          headers: form.getHeaders()
        });

        const responseText = await response.text();
        console.log('Discord response:', response.status, responseText);

        if (!response.ok) {
          throw new Error(`Discord error: ${response.status} - ${responseText}`);
        }

        console.log('✅ ORDER sent with proof image!');
        return res.status(200).json({ success: true, message: 'Order sent with image' });

      } catch (imageError) {
        console.error('❌ Image upload failed:', imageError);
        
        // Fallback: Send without image
        delete embed.image;
        const fallbackPayload = {
          content: '🔔 **NEW ORDER ALERT!** ⚠️ *Bukti transfer gagal diupload - lihat WhatsApp*',
          embeds: [embed]
        };

        await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackPayload)
        });

        console.log('⚠️ Sent without image (fallback)');
      }
    } else {
      // No proof image
      const payload = {
        content: '🔔 **NEW ORDER ALERT!**',
        embeds: [embed]
      };

      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('✅ ORDER sent without image');
    }

    return res.status(200).json({ success: true, message: 'Order sent' });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
