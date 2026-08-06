import { Pool } from 'pg';

async function seed() {
  const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    database: 'f2h_fresh',
    user: 'appuser',
    password: 'apppassword',
  });

  try {
    console.log('Seeding Categories with Images...');

    const categories = [
      {
        category_id: 'CAT_MILK',
        name: 'Fresh Farm Milk',
        slug: 'fresh-farm-milk',
        description: 'Pure, unprocessed cow & buffalo milk delivered fresh before 7 AM.',
        image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
        sort_order: 1,
      },
      {
        category_id: 'CAT_CURD',
        name: 'Curd & Yogurt',
        slug: 'curd-yogurt',
        description: 'Thick, creamy set curd and delicious probiotic fruit yogurts.',
        image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80',
        sort_order: 2,
      },
      {
        category_id: 'CAT_SWEETS',
        name: 'Kova & Traditional Sweets',
        slug: 'kova-sweets',
        description: 'Handcrafted traditional Indian sweets made from 100% pure milk mawa.',
        image_url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80',
        sort_order: 3,
      },
      {
        category_id: 'CAT_ALMONDS',
        name: 'Almonds & Dry Fruits',
        slug: 'almonds-dry-fruits',
        description: 'Premium California & Mamra almonds, rich in protein and nutrients.',
        image_url: 'https://images.unsplash.com/photo-1508061252966-dfd30f67ea55?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1508061252966-dfd30f67ea55?auto=format&fit=crop&w=600&q=80',
        sort_order: 4,
      },
      {
        category_id: 'CAT_GHEE',
        name: 'Butter & Desi Ghee',
        slug: 'butter-ghee',
        description: 'A2 Vedic Bilona Ghee and fresh cultured farm butter.',
        image_url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80',
        sort_order: 5,
      },
      {
        category_id: 'CAT_PANEER',
        name: 'Paneer & Cottage Cheese',
        slug: 'paneer-cottage-cheese',
        description: 'Soft, melt-in-the-mouth fresh cottage cheese made daily.',
        image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80',
        sort_order: 6,
      },
    ];

    for (const c of categories) {
      await pool.query(
        `INSERT INTO categories (category_id, name, slug, description, image_path, sort_order, is_active, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
         ON CONFLICT (category_id) DO UPDATE SET name = $2, image_path = $5, description = $4;`,
        [c.category_id, c.name, c.slug, c.description, c.image_path, c.sort_order]
      );
    }

    console.log('Seeding Products with Images...');

    const products = [
      {
        product_id: 'PROD_COW_MILK',
        name: 'Pure Farm Cow Milk',
        slug: 'pure-farm-cow-milk',
        category_id: 'CAT_MILK',
        description: 'Fresh A2 Cow Milk sourced directly from unadulterated free-range cows.',
        highlights: '100% Unpasteurized, No Preservatives, Delivered by 7 AM',
        image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
        is_subscribable: true,
        is_one_time: true,
        unit_type: 'ltr',
      },
      {
        product_id: 'PROD_BUFFALO_MILK',
        name: 'Rich Buffalo Milk',
        slug: 'rich-buffalo-milk',
        category_id: 'CAT_MILK',
        description: 'High-fat thick buffalo milk perfect for tea, coffee, and home curd.',
        highlights: 'Thick Cream, High Fat 7%+, Nutrient Dense',
        image_url: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80',
        is_subscribable: true,
        is_one_time: true,
        unit_type: 'ltr',
      },
      {
        product_id: 'PROD_FARM_CURD',
        name: 'Creamy Whole Milk Curd',
        slug: 'creamy-whole-milk-curd',
        category_id: 'CAT_CURD',
        description: 'Traditional earthen-pot set curd with thick natural cream layer.',
        highlights: 'Probiotic Rich, Natural Fermentation, Mild Acidic Taste',
        image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80',
        is_subscribable: true,
        is_one_time: true,
        unit_type: 'gm',
      },
      {
        product_id: 'PROD_GREEK_YOGURT',
        name: 'Flavored Greek Yogurt',
        slug: 'flavored-greek-yogurt',
        category_id: 'CAT_CURD',
        description: 'High protein strained yogurt infused with real Alphanso Mango bits.',
        highlights: '2x Protein, Real Fruit Bits, Zero Refined Sugar',
        image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80',
        is_subscribable: false,
        is_one_time: true,
        unit_type: 'gm',
      },
      {
        product_id: 'PROD_MAWA_KOVA',
        name: 'Fresh Traditional Mawa Kova',
        slug: 'fresh-traditional-mawa-kova',
        category_id: 'CAT_SWEETS',
        description: 'Slow-cooked milk solid kova made using whole fresh milk.',
        highlights: 'Pure Milk Solid, No Flour Added, Authentic Taste',
        image_url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80',
        is_subscribable: false,
        is_one_time: true,
        unit_type: 'gm',
      },
      {
        product_id: 'PROD_MALAI_PEDA',
        name: 'Kesar Malai Peda',
        slug: 'kesar-malai-peda',
        category_id: 'CAT_SWEETS',
        description: 'Traditional Mathura style malai peda garnished with Kashmiri Kesar.',
        highlights: 'Real Saffron, Melt-in-mouth Texture, Festive Delight',
        image_url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80',
        is_subscribable: false,
        is_one_time: true,
        unit_type: 'gm',
      },
      {
        product_id: 'PROD_CALIF_ALMONDS',
        name: 'Premium California Almonds',
        slug: 'premium-california-almonds',
        category_id: 'CAT_ALMONDS',
        description: 'Handpicked crisp Badam kernels packed with vitamin E and healthy fats.',
        highlights: 'Crunchy Quality, Zero Cholesterol, Heart Healthy',
        image_url: 'https://images.unsplash.com/photo-1508061252966-dfd30f67ea55?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1508061252966-dfd30f67ea55?auto=format&fit=crop&w=600&q=80',
        is_subscribable: false,
        is_one_time: true,
        unit_type: 'gm',
      },
      {
        product_id: 'PROD_SPICED_ALMONDS',
        name: 'Roasted Masala Almonds',
        slug: 'roasted-masala-almonds',
        category_id: 'CAT_ALMONDS',
        description: 'Slow roasted almonds coated with Himalayan pink salt and Indian spices.',
        highlights: 'Oil-Free Roasted, Spicy & Tangy, Healthy Evening Snack',
        image_url: 'https://images.unsplash.com/photo-1508061252966-dfd30f67ea55?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1508061252966-dfd30f67ea55?auto=format&fit=crop&w=600&q=80',
        is_subscribable: false,
        is_one_time: true,
        unit_type: 'gm',
      },
      {
        product_id: 'PROD_DESI_GHEE',
        name: 'A2 Vedic Bilona Cow Ghee',
        slug: 'a2-vedic-bilona-cow-ghee',
        category_id: 'CAT_GHEE',
        description: 'Crafted using the ancient two-way hand churning Bilona method.',
        highlights: 'Granular Texture, Golden Aromatic Flavor, A2 Goodness',
        image_url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80',
        is_subscribable: true,
        is_one_time: true,
        unit_type: 'ml',
      },
      {
        product_id: 'PROD_FARM_BUTTER',
        name: 'Fresh Cultured White Butter',
        slug: 'fresh-cultured-white-butter',
        category_id: 'CAT_GHEE',
        description: 'Homemade unsalted white butter (Makhan) churned from fresh curd cream.',
        highlights: 'Zero Preservatives, Low Salt, Perfect for Parathas',
        image_url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80',
        is_subscribable: true,
        is_one_time: true,
        unit_type: 'gm',
      },
      {
        product_id: 'PROD_FRESH_PANEER',
        name: 'Fresh Soft Malai Paneer',
        slug: 'fresh-soft-malai-paneer',
        category_id: 'CAT_PANEER',
        description: 'Freshly curdled cottage cheese block, extra soft and spongy.',
        highlights: 'High Protein 18g/100g, Made Fresh Daily, Chemical Free',
        image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80',
        is_subscribable: true,
        is_one_time: true,
        unit_type: 'gm',
      },
      {
        product_id: 'PROD_BUTTERMILK',
        name: 'Spiced Masala Buttermilk',
        slug: 'spiced-masala-buttermilk',
        category_id: 'CAT_CURD',
        description: 'Cooling traditional Chaas with roasted cumin, curry leaves, and ginger.',
        highlights: 'Digestive Comfort, Low Fat, Refreshing Summer Drink',
        image_url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80',
        image_path: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80',
        is_subscribable: true,
        is_one_time: true,
        unit_type: 'ml',
      },
    ];

    for (const p of products) {
      await pool.query(
        `INSERT INTO products (product_id, name, slug, category_id, description, highlights, image_url, image_path, images, is_subscribable, is_one_time, unit_type, is_active, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW())
         ON CONFLICT (product_id) DO UPDATE SET name = $2, category_id = $4, description = $5, image_url = $7, image_path = $8, images = $9;`,
        [p.product_id, p.name, p.slug, p.category_id, p.description, p.highlights, p.image_url, p.image_path, JSON.stringify([p.image_url]), p.is_subscribable, p.is_one_time, p.unit_type]
      );
    }

    console.log('Seeding Product Variants with Images...');

    const variants = [
      // Cow Milk Variants
      { variant_id: 'VAR_MILK_COW_500ML', product_id: 'PROD_COW_MILK', name: '500 ml Pouch', sku: 'SKU-COW-500ML', price: 34.00, subscription_price: 32.00, unit_value: 500, unit_type: 'ml', image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80' },
      { variant_id: 'VAR_MILK_COW_1LTR', product_id: 'PROD_COW_MILK', name: '1 Liter Pouch', sku: 'SKU-COW-1L', price: 65.00, subscription_price: 60.00, unit_value: 1000, unit_type: 'ml', image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80' },
      { variant_id: 'VAR_MILK_COW_2LTR', product_id: 'PROD_COW_MILK', name: '2 Liter Glass Bottle', sku: 'SKU-COW-2L', price: 135.00, subscription_price: 125.00, unit_value: 2000, unit_type: 'ml', image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80' },

      // Buffalo Milk Variants
      { variant_id: 'VAR_MILK_BUF_500ML', product_id: 'PROD_BUFFALO_MILK', name: '500 ml Pouch', sku: 'SKU-BUF-500ML', price: 42.00, subscription_price: 40.00, unit_value: 500, unit_type: 'ml', image_url: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80' },
      { variant_id: 'VAR_MILK_BUF_1LTR', product_id: 'PROD_BUFFALO_MILK', name: '1 Liter Pouch', sku: 'SKU-BUF-1L', price: 80.00, subscription_price: 75.00, unit_value: 1000, unit_type: 'ml', image_url: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80' },

      // Curd Variants
      { variant_id: 'VAR_CURD_250G', product_id: 'PROD_FARM_CURD', name: '250g Clay Pot', sku: 'SKU-CURD-250G', price: 30.00, subscription_price: 28.00, unit_value: 250, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80' },
      { variant_id: 'VAR_CURD_500G', product_id: 'PROD_FARM_CURD', name: '500g Tub', sku: 'SKU-CURD-500G', price: 55.00, subscription_price: 50.00, unit_value: 500, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80' },
      { variant_id: 'VAR_CURD_1KG', product_id: 'PROD_FARM_CURD', name: '1 kg Bucket', sku: 'SKU-CURD-1KG', price: 100.00, subscription_price: 95.00, unit_value: 1000, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80' },

      // Greek Yogurt Variants
      { variant_id: 'VAR_YOG_150G', product_id: 'PROD_GREEK_YOGURT', name: '150g Single Cup', sku: 'SKU-YOG-150G', price: 60.00, subscription_price: 55.00, unit_value: 150, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80' },
      { variant_id: 'VAR_YOG_300G', product_id: 'PROD_GREEK_YOGURT', name: '300g Twin Pack', sku: 'SKU-YOG-300G', price: 110.00, subscription_price: 100.00, unit_value: 300, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80' },

      // Mawa Kova Variants
      { variant_id: 'VAR_KOVA_250G', product_id: 'PROD_MAWA_KOVA', name: '250g Sweet Box', sku: 'SKU-KOVA-250G', price: 160.00, subscription_price: 150.00, unit_value: 250, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80' },
      { variant_id: 'VAR_KOVA_500G', product_id: 'PROD_MAWA_KOVA', name: '500g Festive Pack', sku: 'SKU-KOVA-500G', price: 310.00, subscription_price: 290.00, unit_value: 500, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80' },

      // Malai Peda Variants
      { variant_id: 'VAR_PEDA_250G', product_id: 'PROD_MALAI_PEDA', name: '250g Gift Box', sku: 'SKU-PEDA-250G', price: 180.00, subscription_price: 170.00, unit_value: 250, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80' },
      { variant_id: 'VAR_PEDA_500G', product_id: 'PROD_MALAI_PEDA', name: '500g Gift Box', sku: 'SKU-PEDA-500G', price: 350.00, subscription_price: 330.00, unit_value: 500, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80' },

      // Almonds Variants
      { variant_id: 'VAR_ALM_200G', product_id: 'PROD_CALIF_ALMONDS', name: '200g Zip Pouch', sku: 'SKU-ALM-200G', price: 220.00, subscription_price: 210.00, unit_value: 200, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1508061252966-dfd30f67ea55?auto=format&fit=crop&w=600&q=80' },
      { variant_id: 'VAR_ALM_500G', product_id: 'PROD_CALIF_ALMONDS', name: '500g Saver Pack', sku: 'SKU-ALM-500G', price: 520.00, subscription_price: 490.00, unit_value: 500, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1508061252966-dfd30f67ea55?auto=format&fit=crop&w=600&q=80' },
      { variant_id: 'VAR_ALM_1KG', product_id: 'PROD_CALIF_ALMONDS', name: '1 kg Vacuum Jar', sku: 'SKU-ALM-1KG', price: 990.00, subscription_price: 950.00, unit_value: 1000, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1508061252966-dfd30f67ea55?auto=format&fit=crop&w=600&q=80' },

      // Spiced Almonds Variants
      { variant_id: 'VAR_SP_ALM_150G', product_id: 'PROD_SPICED_ALMONDS', name: '150g Snack Pack', sku: 'SKU-SPALM-150G', price: 190.00, subscription_price: 180.00, unit_value: 150, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1508061252966-dfd30f67ea55?auto=format&fit=crop&w=600&q=80' },
      { variant_id: 'VAR_SP_ALM_300G', product_id: 'PROD_SPICED_ALMONDS', name: '300g Party Can', sku: 'SKU-SPALM-300G', price: 360.00, subscription_price: 340.00, unit_value: 300, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1508061252966-dfd30f67ea55?auto=format&fit=crop&w=600&q=80' },

      // Desi Ghee Variants
      { variant_id: 'VAR_GHEE_250ML', product_id: 'PROD_DESI_GHEE', name: '250 ml Glass Jar', sku: 'SKU-GHEE-250ML', price: 380.00, subscription_price: 360.00, unit_value: 250, unit_type: 'ml', image_url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80' },
      { variant_id: 'VAR_GHEE_500ML', product_id: 'PROD_DESI_GHEE', name: '500 ml Glass Jar', sku: 'SKU-GHEE-500ML', price: 720.00, subscription_price: 680.00, unit_value: 500, unit_type: 'ml', image_url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80' },
      { variant_id: 'VAR_GHEE_1LTR', product_id: 'PROD_DESI_GHEE', name: '1 Liter Tin', sku: 'SKU-GHEE-1L', price: 1390.00, subscription_price: 1320.00, unit_value: 1000, unit_type: 'ml', image_url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80' },

      // White Butter Variant
      { variant_id: 'VAR_BUTTER_200G', product_id: 'PROD_FARM_BUTTER', name: '200g Fresh Pack', sku: 'SKU-BUTTER-200G', price: 140.00, subscription_price: 130.00, unit_value: 200, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80' },

      // Fresh Paneer Variants
      { variant_id: 'VAR_PAN_200G', product_id: 'PROD_FRESH_PANEER', name: '200g Vacuum Pack', sku: 'SKU-PAN-200G', price: 95.00, subscription_price: 88.00, unit_value: 200, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80' },
      { variant_id: 'VAR_PAN_500G', product_id: 'PROD_FRESH_PANEER', name: '500g Block Pack', sku: 'SKU-PAN-500G', price: 220.00, subscription_price: 205.00, unit_value: 500, unit_type: 'gm', image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80' },

      // Buttermilk Variants
      { variant_id: 'VAR_BM_500ML', product_id: 'PROD_BUTTERMILK', name: '500 ml Bottle', sku: 'SKU-BM-500ML', price: 25.00, subscription_price: 22.00, unit_value: 500, unit_type: 'ml', image_url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80' },
    ];

    for (const v of variants) {
      await pool.query(
        `INSERT INTO product_variants (variant_id, product_id, name, sku, price, subscription_price, unit_value, unit_type, image_url, image_path, status, is_out_of_stock, manageable_qty, sort_order, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, 'active', false, 100, 1, NOW())
         ON CONFLICT (variant_id) DO UPDATE SET price = $5, subscription_price = $6, name = $3, image_url = $9, image_path = $9;`,
        [v.variant_id, v.product_id, v.name, v.sku, v.price, v.subscription_price, v.unit_value, v.unit_type, v.image_url]
      );
    }

    console.log('🎉 SEEDING SUCCESSFUL WITH HIGH RESOLUTION PRODUCT IMAGES!');
    console.log(`Inserted ${categories.length} Categories, ${products.length} Products, and ${variants.length} Variants.`);

  } catch (err) {
    console.error('Seeding Error:', err);
  } finally {
    await pool.end();
  }
}

seed();
