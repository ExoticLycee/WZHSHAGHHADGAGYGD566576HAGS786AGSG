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
    const { customerName, totalAmount, proofImage } = req.body;

    const DISCORD_WEBHOOK_SLIP = process.env.DISCORD_WEBHOOK_SLIP;

    if (!DISCORD_WEBHOOK_SLIP) {
      console.error('Webhook SLIP tidak ditemukan');
      return res.status(500).json({ 
        success: false, 
        error: 'Webhook SLIP tidak dikonfigurasi' 
      });
    }

    console.log('📤 Mengirim ke webhook SLIP...');

    // Buat embed Discord
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
      footer: {
        text: 'Transfer Slip - WarpahExploits'
      }
    };

    // STEP 1: Kirim embed dulu
    const embedPayload = {
      content: '✅ **TRANSAKSI DONE**',
      embeds: [embed]
    };

    const embedResponse = await fetch(DISCORD_WEBHOOK_SLIP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embedPayload)
    });

    if (!embedResponse.ok) {
      const errorText = await embedResponse.text();
      console.error('❌ Discord SLIP Embed Error:', errorText);
      throw new Error(`Discord SLIP embed failed: ${embedResponse.status}`);
    }

    console.log('✅ Embed SLIP berhasil dikirim');

    // STEP 2: Kirim bukti transfer sebagai message terpisah
    if (proofImage) {
      try {
        console.log('📸 Memproses bukti transfer SLIP...');
        
        const FormData = require('form-data');
        const form = new FormData();
        
        // Extract base64 data
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
        
        console.log(`🖼️ SLIP Image type: ${mimeType}`);
        
        // Convert to buffer
        const buffer = Buffer.from(base64Data, 'base64');
        console.log(`📦 SLIP Buffer size: ${buffer.length} bytes`);
        
        // Validasi buffer
        if (buffer.length === 0) {
          throw new Error('Buffer kosong - base64 tidak valid');
        }
        
        // Append file
        form.append('content', '📸 **Bukti Transfer:**');
        form.append('file', buffer, {
          filename: `slip_${Date.now()}.${extension}`,
          contentType: mimeType
        });

        console.log('📤 Mengirim bukti transfer SLIP ke Discord...');

        // Kirim ke Discord
        const imageResponse = await fetch(DISCORD_WEBHOOK_SLIP, {
          method: 'POST',
          body: form
        });

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text();
          console.error('❌ Discord SLIP Image Error:', errorText);
          throw new Error(`SLIP upload image failed: ${imageResponse.status}`);
        }

        console.log('✅ Bukti transfer SLIP berhasil dikirim!');

      } catch (imageError) {
        console.error('❌ Error upload bukti SLIP:', imageError.message);
        
        // Kirim notifikasi error
        const errorNotif = {
          content: '⚠️ **PERINGATAN:** Bukti transfer gagal diupload.'
        };

        await fetch(DISCORD_WEBHOOK_SLIP, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorNotif)
        });
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Transfer slip berhasil dikirim ke Discord' 
    });

  } catch (error) {
    console.error('❌ Error di discord-slip.js:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
