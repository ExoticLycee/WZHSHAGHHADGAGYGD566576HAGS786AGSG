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

    // Format WhatsApp link customer dengan chat otomatis
    const customerWaLink = `https://wa.me/${customerData.phone}`;

    // Base embed dengan link WhatsApp customer
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

    // KIRIM EMBED DULU (tanpa gambar)
    const initialPayload = {
      content: `🔔 **NEW ORDER ALERT!**\n💬 [Chat Customer di WhatsApp](${customerWaLink})`,
      embeds: [embed]
    };

    const embedResponse = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initialPayload)
    });

    if (!embedResponse.ok) {
      const errorText = await embedResponse.text();
      console.error('❌ Embed failed:', errorText);
      throw new Error(`Embed failed: ${embedResponse.status}`);
    }

    console.log('✅ Embed ORDER sent successfully');

    // KIRIM GAMBAR TERPISAH (lebih reliable)
    if (proofImage) {
      try {
        console.log('📸 Processing proof image...');

        // Parse base64
        let base64Data = proofImage;
        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }

        // Convert to buffer
        const imageBuffer = Buffer.from(base64Data, 'base64');
        console.log(`📦 Image size: ${imageBuffer.length} bytes (${(imageBuffer.length / 1024).toFixed(2)} KB)`);

        if (imageBuffer.length === 0) {
          throw new Error('Image buffer is empty');
        }

        // Gunakan fetch dengan FormData yang kompatibel
        const FormData = require('form-data');
        const form = new FormData();
        
        form.append('content', '📸 **BUKTI TRANSFER:**');
        form.append('file', imageBuffer, {
          filename: `proof_${Date.now()}.jpg`,
          contentType: 'image/jpeg',
          knownLength: imageBuffer.length
        });

        console.log('📤 Uploading image to Discord...');

        const imageResponse = await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          body: form,
          headers: form.getHeaders()
        });

        const responseText = await imageResponse.text();
        
        if (!imageResponse.ok) {
          console.error('❌ Image upload failed:', responseText);
          throw new Error(`Image upload failed: ${imageResponse.status}`);
        }

        console.log('✅ Image uploaded successfully!');

      } catch (imageError) {
        console.error('❌ Error uploading image:', imageError.message);
        
        // Send error notification
        const errorPayload = {
          content: `⚠️ **PERINGATAN:** Bukti transfer gagal diupload!\n🔴 Error: ${imageError.message}\n💬 Silakan minta customer kirim ulang via [WhatsApp](${customerWaLink})`
        };

        await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorPayload)
        });
      }
    }

    return res.status(200).json({ success: true, message: 'Order sent successfully' });

  } catch (error) {
    console.error('❌ Critical error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
