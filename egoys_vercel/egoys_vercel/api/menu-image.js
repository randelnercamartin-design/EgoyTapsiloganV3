import { createClient } from '@supabase/supabase-js';

// Kunin ang iyong Supabase credentials mula sa Environment Variables ng Vercel
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Image, menuId } = req.body;

    if (!base64Image) {
      return res.status(400).json({ error: 'Walang larawang natanggap.' });
    }

    // 1. I-convert ang Base64 string pabalik sa Buffer para ma-upload sa Storage
    const buffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ""), 'base64');
    const fileType = base64Image.split(';')[0].split('/')[1] || 'png';
    const uniqueFileName = `menu_${Date.now()}.${fileType}`;

    // 2. I-upload ang buffer sa Supabase Storage bucket na 'product-images'
    const { data: storageData, error: storageError } = await supabase.storage
      .from('product-images') // Tiyakin na gumawa ka ng 'product-images' bucket na PUBLIC sa Supabase Dashboard mo
      .upload(uniqueFileName, buffer, {
        contentType: `image/${fileType}`,
        upsert: true
      });

    if (storageError) throw storageError;

    // 3. Kunin ang permanenteng Public URL ng larawan
    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(uniqueFileName);

    const permanentImageUrl = publicUrlData.publicUrl;

    // 4. I-update ang iyong database table gamit ang bagong cloud URL
    const { data: dbData, error: dbError } = await supabase
      .from('menus') // Palitan ng 'products' kung yan ang totoong pangalan ng table mo sa Supabase
      .update({ image_url: permanentImageUrl }) // Tiyakin na 'image_url' ang tawag sa column mo
      .eq('id', menuId); 

    if (dbError) throw dbError;

    return res.status(200).json({ success: true, imageUrl: permanentImageUrl });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
