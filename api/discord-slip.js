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

    // Base embed
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
        }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Transfer Slip - WarpahExploits' }
    };

    if (proofImage) {
      embed.image = {
        url: 'attachment://slip.jpg'
      };

      try {
        const FormData = require('form-data');
        const form = new FormData();

        // Parse base64
        const matches = proofImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Invalid base64 format');
        }

        const imageBuffer = Buffer.from(matches[2], 'base64');
        console.log(`📦 SLIP image buffer size: ${imageBuffer.length} bytes`);

        // Build payload
        const payload = {
          content: '✅ **TRANSAKSI DONE**',
          embeds: [embed]
        };

        // Append to form
        form.append('payload_json', JSON.stringify(payload));
        form.append('files[0]', imageBuffer, {
          filename: 'slip.jpg',
          contentType: 'image/jpeg'
        });

        // Send to Discord
        const response = await fetch(DISCORD_WEBHOOK_SLIP, {
          method: 'POST',
          body: form,
          headers: form.getHeaders()
        });

        const responseText = await response.text();
        console.log('Discord SLIP response:', response.status, responseText);

        if (!response.ok) {
          throw new Error(`Discord error: ${response.status} - ${responseText}`);
        }

        console.log('✅ SLIP sent with proof image!');
        return res.status(200).json({ success: true, message: 'Slip sent with image' });

      } catch (imageError) {
        console.error('❌ SLIP image upload failed:', imageError);
        
        // Fallback: Send without image
        delete embed.image;
        const fallbackPayload = {
          content: '✅ **TRANSAKSI DONE** ⚠️ *Bukti transfer gagal diupload*',
          embeds: [embed]
        };

        await fetch(DISCORD_WEBHOOK_SLIP, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackPayload)
        });

        console.log('⚠️ SLIP sent without image (fallback)');
      }
    } else {
      // No proof image
      const payload = {
        content: '✅ **TRANSAKSI DONE**',
        embeds: [embed]
      };

      await fetch(DISCORD_WEBHOOK_SLIP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('✅ SLIP sent without image');
    }

    return res.status(200).json({ success: true, message: 'Slip sent' });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
