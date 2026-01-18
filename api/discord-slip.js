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

    // Base embed (TANPA nomor HP dan email - sesuai permintaan)
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

    // KIRIM EMBED DULU
    const initialPayload = {
      content: '✅ **TRANSAKSI DONE**',
      embeds: [embed]
    };

    const embedResponse = await fetch(DISCORD_WEBHOOK_SLIP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initialPayload)
    });

    if (!embedResponse.ok) {
      const errorText = await embedResponse.text();
      console.error('❌ SLIP Embed failed:', errorText);
      throw new Error(`Embed failed: ${embedResponse.status}`);
    }

    console.log('✅ Embed SLIP sent successfully');

    // KIRIM GAMBAR TERPISAH
    if (proofImage) {
      try {
        console.log('📸 Processing SLIP proof image...');

        // Parse base64
        let base64Data = proofImage;
        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }

        // Convert to buffer
        const imageBuffer = Buffer.from(base64Data, 'base64');
        console.log(`📦 SLIP Image size: ${imageBuffer.length} bytes (${(imageBuffer.length / 1024).toFixed(2)} KB)`);

        if (imageBuffer.length === 0) {
          throw new Error('Image buffer is empty');
        }

        // Build form
        const FormData = require('form-data');
        const form = new FormData();
        
        form.append('content', '📸 **BUKTI TRANSFER:**');
        form.append('file', imageBuffer, {
          filename: `slip_${Date.now()}.jpg`,
          contentType: 'image/jpeg',
          knownLength: imageBuffer.length
        });

        console.log('📤 Uploading SLIP image to Discord...');

        const imageResponse = await fetch(DISCORD_WEBHOOK_SLIP, {
          method: 'POST',
          body: form,
          headers: form.getHeaders()
        });

        const responseText = await imageResponse.text();
        
        if (!imageResponse.ok) {
          console.error('❌ SLIP Image upload failed:', responseText);
          throw new Error(`Image upload failed: ${imageResponse.status}`);
        }

        console.log('✅ SLIP Image uploaded successfully!');

      } catch (imageError) {
        console.error('❌ Error uploading SLIP image:', imageError.message);
        
        // Send error notification
        const errorPayload = {
          content: `⚠️ **PERINGATAN:** Bukti transfer SLIP gagal diupload!\n🔴 Error: ${imageError.message}`
        };

        await fetch(DISCORD_WEBHOOK_SLIP, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorPayload)
        });
      }
    }

    return res.status(200).json({ success: true, message: 'Slip sent successfully' });

  } catch (error) {
    console.error('❌ Critical error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
