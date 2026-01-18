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
    const { customerName, totalAmount, proofImage } = req.body;
    const DISCORD_WEBHOOK_SLIP = process.env.DISCORD_WEBHOOK_SLIP;

    if (!DISCORD_WEBHOOK_SLIP) {
      return res.status(500).json({ success: false, error: 'Webhook not configured' });
    }

    console.log('📤 Sending to SLIP webhook...');

    // Link WhatsApp Admin
    const adminWaLink = 'https://wa.me/6288223055352';

    // STEP 1: Kirim Embed (TANPA gambar dulu)
    const embed = {
      title: '💳 TRANSAKSI SELESAI',
      description: '✅ Pembayaran telah dikonfirmasi',
      color: 0x00ff88,
      fields: [
        {
          name: '👤 Nama Customer',
          value: customerName,
          inline: true
        },
        {
          name: '💰 Total',
          value: `Rp ${totalAmount.toLocaleString('id-ID')}`,
          inline: true
        },
        {
          name: '📞 Butuh Bantuan?',
          value: `[💬 Hubungi Admin WarpahExploits](${adminWaLink})`,
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Transfer Slip - WarpahExploits' }
    };

    const payload1 = {
      content: '✅ **TRANSAKSI DONE**',
      embeds: [embed]
    };

    const response1 = await fetch(DISCORD_WEBHOOK_SLIP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload1)
    });

    if (!response1.ok) {
      throw new Error(`Failed to send embed: ${response1.status}`);
    }

    console.log('✅ SLIP Embed sent');

    // STEP 2: Kirim Gambar (jika ada)
    if (proofImage) {
      try {
        // Delay sedikit
        await new Promise(resolve => setTimeout(resolve, 500));

        // Parse base64
        const base64Match = proofImage.match(/^data:image\/[a-z]+;base64,(.+)$/);
        const base64Data = base64Match ? base64Match[1] : proofImage;
        
        const buffer = Buffer.from(base64Data, 'base64');
        
        console.log(`SLIP Image buffer: ${buffer.length} bytes`);

        if (buffer.length < 100) {
          throw new Error('Buffer too small, invalid image');
        }

        // Simple fetch dengan binary body
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36);
        const formBody = 
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="content"\r\n\r\n` +
          `📸 **BUKTI TRANSFER:**\r\n` +
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="slip.jpg"\r\n` +
          `Content-Type: image/jpeg\r\n\r\n`;
        
        const formBodyEnd = `\r\n--${boundary}--`;
        
        const bodyBuffer = Buffer.concat([
          Buffer.from(formBody, 'utf8'),
          buffer,
          Buffer.from(formBodyEnd, 'utf8')
        ]);

        const response2 = await fetch(DISCORD_WEBHOOK_SLIP, {
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

        console.log('✅ SLIP Image sent');

      } catch (err) {
        console.error('SLIP Image error:', err.message);
        
        // Fallback notification
        await fetch(DISCORD_WEBHOOK_SLIP, {
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
    console.error('SLIP Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
