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
      console.error('Webhook SLIP tidak ditemukan di environment variables');
      return res.status(500).json({ 
        success: false, 
        error: 'Webhook SLIP tidak dikonfigurasi' 
      });
    }

    console.log('Mengirim ke webhook SLIP...');

    // Buat embed Discord - HANYA bukti transfer dan nickname
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

    const discordPayload = {
      content: '✅ **TRANSAKSI DONE**',
      embeds: [embed]
    };

    // Kirim embed dulu
    const response = await fetch(DISCORD_WEBHOOK_SLIP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Discord API Error (SLIP):', errorText);
      throw new Error(`Discord webhook SLIP gagal: ${response.status}`);
    }

    console.log('✅ Berhasil kirim ke Discord SLIP');

    // Kirim bukti transfer jika ada
    if (proofImage) {
      const base64Data = proofImage.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      
      const FormData = require('form-data');
      const form = new FormData();
      
      form.append('content', '📸 **Bukti Transfer:**');
      form.append('file', buffer, {
        filename: `slip_${Date.now()}.jpg`,
        contentType: 'image/jpeg'
      });

      await fetch(DISCORD_WEBHOOK_SLIP, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Transfer slip berhasil dikirim ke Discord' 
    });

  } catch (error) {
    console.error('Error di discord-slip.js:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
