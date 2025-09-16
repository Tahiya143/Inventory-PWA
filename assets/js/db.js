// Database setup using Dexie.js
// Empty for now
const db = new Dexie("InventoryDB");

db.version(1).stores({
  products: `
    ++id,
    sku,
    title,
    size,
    color,
    notes,
    photos,
    purchasePrice,
    shippingCost,
    sellingPrice,
    profit,
    status,
    createdAt,
    updatedAt
  `
});

async function addProduct(product){
    const now = new Date();
    const profit = (Number(product.sellingPrice)|| 0) -
     (Number(product.puschasePrice) || 0) + (Number(product.shippingCost));

    return await db.products.add({
        sku:product.sku,
        title:product.title || "",
        size:product.size || "",
        color:product.color || "",
        notes:product.notes || "",
        photos:product.photos || null,
        puschasePrice:Number(product.puschasePrice) || 0,
        sellingPrice:Number(product.sellingPrice) || 0,
        profit:profit,
        status:product.status || "available",
        createdAt:now.toISOString(),
        updatedAt:now.toISOString(),
        

    }

    );
}
async function updateProduct(id,updates) {
    const now = new Date();
    let product = await db.products.get(id);
    if(!product) throw new Error("product not found");
    const newSellPrice = updates.sellingPrice ?? product.sellingPrice;
    const newPurches = updates.puschasePrice ?? product.puschasePrice;
    const newShipping = updates.shippingCost ?? product.shippingCost;
    const profit = newPurches - (newPurches + newShipping);

    await db.products.update(id,{
        ...updates,
        profit:profit,
        updatedAt:now.toISOString()
    });
    
    
}

async function getProductBySku(sku) {
    return await db.products.where("sku").equals(sku).first();
}
async function getAllProducts() {
    return await db.products.toArray();
    
}