// Simple in-memory storage (untuk demo)
// Untuk production, gunakan Redis atau database
const recentOrders = new Map();

// Cleanup old orders setiap 30 menit
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentOrders.entries()) {
    if (now - timestamp > 30 * 60 * 1000) { // 30 menit
      recentOrders.delete(key);
    }
  }
}, 10 * 60 * 1000); // Check setiap 10 menit

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
    const { phone, amount } = req.body;
    const orderKey = `${phone}-${amount}`;
    const now = Date.now();
    
    // Check jika order ini sudah ada dalam 30 menit terakhir
    if (recentOrders.has(orderKey)) {
      const lastOrderTime = recentOrders.get(orderKey);
      const timeDiff = (now - lastOrderTime) / 1000 / 60; // dalam menit
      
      if (timeDiff < 30) {
        return res.status(429).json({ 
          isDuplicate: true, 
          message: `Order duplikat! Anda sudah order ${Math.floor(timeDiff)} menit yang lalu. Mohon tunggu konfirmasi admin.`,
          waitTime: Math.ceil(30 - timeDiff)
        });
      }
    }
    
    // Simpan order baru
    recentOrders.set(orderKey, now);
    
    return res.status(200).json({ 
      isDuplicate: false, 
      message: 'OK' 
    });

  } catch (error) {
    console.error('Check duplicate error:', error);
    return res.status(500).json({ error: error.message });
  }
}
