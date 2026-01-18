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

    // STEP 1: Kirim embed dulu
    const embedPayload = {
      content: '🔔 **NEW ORDER ALERT!**',
      embeds: [embed]
    };

    const embedResponse = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embedPayload)
    });

    if (!embedResponse.ok) {
      const errorText = await embedResponse.text();
      console.error('❌ Discord Embed Error:', errorText);
      throw new Error(`Discord embed failed: ${embedResponse.status}`);
    }

    console.log('✅ Embed ORDER berhasil dikirim');

    // STEP 2: Kirim bukti transfer sebagai message terpisah
    if (proofImage) {
      try {
        console.log('📸 Memproses bukti transfer...');
        
        const FormData = require('form-data');
        const form = new FormData();
        
        // Extract base64 data - support berbagai format
        let base64Data = proofImage;
        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }
        
        // Detect image type
        let mimeType = 'image/jpeg';
        let extension = 'jpg';
        if (proofImage.includes('data:image/png')) {
          mimeType = 'image/png';
          extension = 'png';
        } else if (proofImage.includes('data:image/jpg')) {
          mimeType = 'image/jpeg';
          extension = 'jpg';
        } else if (proofImage.includes('data:image/jpeg')) {
          mimeType = 'image/jpeg';
          extension = 'jpg';
        }
        
        console.log(`🖼️ Image type detected: ${mimeType}`);
        
        // Convert to buffer
        const buffer = Buffer.from(base64Data, 'base64');
        console.log(`📦 Buffer size: ${buffer.length} bytes`);
        
        // Validasi buffer tidak kosong
        if (buffer.length === 0) {
          throw new Error('Buffer kosong - base64 tidak valid');
        }
        
        // Append file dengan content message
        form.append('content', '📸 **Bukti Transfer:**');
        form.append('file', buffer, {
          filename: `order_${Date.now()}.${extension}`,
          contentType: mimeType
        });

        console.log('📤 Mengirim bukti transfer ke Discord...');

        // Kirim ke Discord
        const imageResponse = await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          body: form
        });

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text();
          console.error('❌ Discord Image Error:', errorText);
          throw new Error(`Upload image failed: ${imageResponse.status}`);
        }

        console.log('✅ Bukti transfer ORDER berhasil dikirim!');

      } catch (imageError) {
        console.error('❌ Error upload bukti transfer:', imageError.message);
        
        // Kirim notifikasi bahwa bukti gagal
        const errorNotif = {
          content: '⚠️ **PERINGATAN:** Bukti transfer gagal diupload. Mohon minta customer kirim ulang bukti via WhatsApp.'
        };

        await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorNotif)
        });
      }
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
