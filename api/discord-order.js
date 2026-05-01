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

    const itemsText = cartData.map(item => 
      `${item.quantity}x **${item.name}** - Rp ${(item.price * item.quantity).toLocaleString('id-ID')}`
    ).join('\n');

    const customerWaLink = `https://wa.me/${customerData.phone}`;

    const embed = {
      title: '🛒 PEMBELIAN BARU - WarpahExploits',
      color: 0x00ff88,
      fields: [
        {
          name: '👤 Data Customer',
          value: `**Nama:** ${customerData.name}\n**WhatsApp:** [${customerData.phone}](${customerWaLink}) 📱\n**Email:** ${customerData.email || '-'}`,
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

    const payload1 = {
      content: `🔔 **NEW ORDER ALERT!**\n💬 [Chat Customer di WhatsApp](${customerWaLink})`,
      embeds: [embed]
    };

    const response1 = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload1)
    });

    if (!response1.ok) {
      throw new Error(`Failed to send embed: ${response1.status}`);
    }

    console.log('✅ Embed sent');

    if (proofImage) {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));

        const base64Match = proofImage.match(/^data:image\/[a-z]+;base64,(.+)$/);
        const base64Data = base64Match ? base64Match[1] : proofImage;
        
        const buffer = Buffer.from(base64Data, 'base64');
        
        console.log(`Image buffer: ${buffer.length} bytes`);

        if (buffer.length < 100) {
          throw new Error('Buffer too small, invalid image');
        }

        const boundary = '----WebKitFormBoundary' + Math.random().toString(36);
        const formBody = 
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="content"\r\n\r\n` +
          `📸 **BUKTI TRANSFER:**\r\n` +
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="proof.jpg"\r\n` +
          `Content-Type: image/jpeg\r\n\r\n`;
        
        const formBodyEnd = `\r\n--${boundary}--`;
        
        const bodyBuffer = Buffer.concat([
          Buffer.from(formBody, 'utf8'),
          buffer,
          Buffer.from(formBodyEnd, 'utf8')
        ]);

        const response2 = await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`
          },
          body: bodyBuffer
        });

        if (!response2.ok) {
          const errorText = await response2.text();
          throw new Error(`Image upload failed: ${response2.status} - ${errorText}`);
        }

        console.log('✅ Image sent');

      } catch (err) {
        console.error('Image error:', err.message);
        
        // Fallback notification
        await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `⚠️ Bukti transfer gagal upload. Error: ${err.message}`
          })
        });
      }
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
