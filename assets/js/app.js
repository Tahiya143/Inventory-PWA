// Main app logic (starter)
console.log("App loaded");
addProduct({
  sku: "ABC123",
  title: "Red T-Shirt",
  size: "M",
  color: "Red",
  notes: "Cotton fabric",
  purchasePrice: 200,
  shippingCost: 50,
  sellingPrice: 400
}).then(id => {
  console.log("Product added with ID:", id);
});