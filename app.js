const express = require("express");
const fs = require("fs");

const app = express();
const PORT = 3000;

const FILE = "products.json";

app.use(express.json());

// Create products.json if it does not exist
if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, "[]");
}

// Read products
function readProducts() {
    const data = fs.readFileSync(FILE, "utf8");
    return JSON.parse(data);
}

// Save products
function saveProducts(products) {
    fs.writeFileSync(
        FILE,
        JSON.stringify(products, null, 4)
    );
}


// CREATE
app.post("/products", (req, res) => {

    const products = readProducts();

    const product = {
        id: products.length + 1,
        name: req.body.name,
        category: req.body.category,
        brand: req.body.brand,
        specifications: req.body.specifications,
        price: req.body.price,
        stock: req.body.stock,
        warranty: req.body.warranty
    };

    products.push(product);

    saveProducts(products);

    res.json({
        message: "Product added successfully",
        product: product
    });
});


// READ - All products
app.get("/products", (req, res) => {

    const products = readProducts();

    res.json(products);
});


// READ - One product
app.get("/products/:id", (req, res) => {

    const products = readProducts();

    const id = Number(req.params.id);

    const product = products.find(
        product => product.id === id
    );

    if (!product) {
        return res.status(404).json({
            message: "Product not found"
        });
    }

    res.json(product);
});


// UPDATE
app.put("/products/:id", (req, res) => {

    const products = readProducts();

    const id = Number(req.params.id);

    const product = products.find(
        product => product.id === id
    );

    if (!product) {
        return res.status(404).json({
            message: "Product not found"
        });
    }

    product.name = req.body.name;
    product.category = req.body.category;
    product.brand = req.body.brand;
    product.specifications = req.body.specifications;
    product.price = req.body.price;
    product.stock = req.body.stock;
    product.warranty = req.body.warranty;

    saveProducts(products);

    res.json({
        message: "Product updated successfully",
        product: product
    });
});


// DELETE
app.delete("/products/:id", (req, res) => {

    const products = readProducts();

    const id = Number(req.params.id);

    const newProducts = products.filter(
        product => product.id !== id
    );

    if (products.length === newProducts.length) {
        return res.status(404).json({
            message: "Product not found"
        });
    }

    saveProducts(newProducts);

    res.json({
        message: "Product deleted successfully"
    });
});


// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});