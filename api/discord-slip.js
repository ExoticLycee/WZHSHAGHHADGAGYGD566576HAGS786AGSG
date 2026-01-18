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

    // Ambil webhook dari environment variable
    const DISCORD_WEBHOOK_SLIP = process.env.DISCORD_WEBHOOK_SLIP;

    if (!DISCORD_WEBHOOK_SLIP) {
      throw new Error('Webhook URL tidak ditemukan');
    }

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

    // Kirim dengan bukti transfer
    if (proofImage) {
      const base64Data = proofImage.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      
      const FormData = require('form-data');
      const form = new FormData();
      form.append('payload_json', JSON.stringify({
        content: '✅ **TRANSAKSI DONE**',
        embeds: [embed]
      }));
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
    console.error('Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
