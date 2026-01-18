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

    // Buat embed Discord - HANYA nama dan total
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
          content: '✅ **TRANSAKSI DONE**',
          embeds: [embed]
        };
        
        // Append payload dan file
        form.append('payload_json', JSON.stringify(payload));
        form.append('file', buffer, {
          filename: `slip_${Date.now()}.jpg`,
          contentType: 'image/jpeg'
        });

        // Kirim ke Discord
        const response = await fetch(DISCORD_WEBHOOK_SLIP, {
          method: 'POST',
          body: form
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Discord SLIP Error:', errorText);
          throw new Error(`Discord webhook SLIP failed: ${response.status}`);
        }

        console.log('✅ Berhasil kirim ke Discord SLIP (dengan bukti)');
      } catch (error) {
        console.error('❌ Error saat kirim SLIP dengan bukti:', error);
        
        // Fallback: Kirim tanpa bukti jika gagal
        const fallbackPayload = {
          content: '✅ **TRANSAKSI DONE** ⚠️ *Bukti transfer gagal diupload*',
          embeds: [embed]
        };

        await fetch(DISCORD_WEBHOOK_SLIP, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackPayload)
        });

        console.log('⚠️ Kirim SLIP tanpa bukti transfer (fallback)');
      }
    } else {
      // Tidak ada bukti transfer
      const payload = {
        content: '✅ **TRANSAKSI DONE**',
        embeds: [embed]
      };

      const response = await fetch(DISCORD_WEBHOOK_SLIP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Discord webhook SLIP failed: ${response.status}`);
      }

      console.log('✅ Berhasil kirim ke Discord SLIP (tanpa bukti)');
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
