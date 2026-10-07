const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = 3000;

// Allow JSON data
app.use(express.json());

// SQLite database
const db = new sqlite3.Database("./shop.db", (err) => {
    if (err) {
        console.error("Database connection error:", err.message);
    } else {
        console.log("Connected to SQLite database");
    }
});


// =====================================================
// CREATE TABLES
// =====================================================

db.serialize(() => {

    // Products table
    db.run(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            brand TEXT NOT NULL,
            specifications TEXT NOT NULL,
            price REAL NOT NULL CHECK(price >= 0),
            stock INTEGER NOT NULL CHECK(stock >= 0),
            warranty TEXT NOT NULL
        )
    `);

    // Orders table
    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL CHECK(quantity > 0),
            price REAL NOT NULL,
            total_amount REAL NOT NULL,
            order_status TEXT NOT NULL DEFAULT 'Placed',
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    `);
});


// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
    res.json({
        message: "Laptop & Accessories Shop API is running",
        status: "success"
    });
});


// =====================================================
// PRODUCTS
// =====================================================

// CREATE PRODUCT
app.post("/products", (req, res) => {

    const {
        name,
        category,
        brand,
        specifications,
        price,
        stock,
        warranty
    } = req.body;

    if (!name || !category || !brand ||
        !specifications || price === undefined ||
        stock === undefined || !warranty) {

        return res.status(400).json({
            error: "All product fields are required"
        });
    }

    if (Number(price) < 0) {
        return res.status(400).json({
            error: "Price cannot be negative"
        });
    }

    if (!Number.isInteger(Number(stock)) || Number(stock) < 0) {
        return res.status(400).json({
            error: "Stock must be a non-negative integer"
        });
    }

    const sql = `
        INSERT INTO products
        (name, category, brand, specifications, price, stock, warranty)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
        sql,
        [
            name,
            category,
            brand,
            specifications,
            Number(price),
            Number(stock),
            warranty
        ],
        function (err) {

            if (err) {
                return res.status(500).json({
                    error: "Failed to add product",
                    details: err.message
                });
            }

            res.status(201).json({
                message: "Product added successfully",
                product_id: this.lastID
            });
        }
    );
});


// READ ALL PRODUCTS
app.get("/products", (req, res) => {

    db.all(
        `SELECT * FROM products ORDER BY id DESC`,
        [],
        (err, rows) => {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            res.json(rows);
        }
    );
});


// READ SINGLE PRODUCT
app.get("/products/:id", (req, res) => {

    const id = req.params.id;

    db.get(
        `SELECT * FROM products WHERE id = ?`,
        [id],
        (err, row) => {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            if (!row) {
                return res.status(404).json({
                    error: "Product not found"
                });
            }

            res.json(row);
        }
    );
});


// UPDATE PRODUCT
app.put("/products/:id", (req, res) => {

    const id = req.params.id;

    const {
        name,
        category,
        brand,
        specifications,
        price,
        stock,
        warranty
    } = req.body;

    if (!name || !category || !brand ||
        !specifications || price === undefined ||
        stock === undefined || !warranty) {

        return res.status(400).json({
            error: "All product fields are required"
        });
    }

    if (Number(price) < 0) {
        return res.status(400).json({
            error: "Price cannot be negative"
        });
    }

    if (!Number.isInteger(Number(stock)) || Number(stock) < 0) {
        return res.status(400).json({
            error: "Stock must be a non-negative integer"
        });
    }

    const sql = `
        UPDATE products
        SET
            name = ?,
            category = ?,
            brand = ?,
            specifications = ?,
            price = ?,
            stock = ?,
            warranty = ?
        WHERE id = ?
    `;

    db.run(
        sql,
        [
            name,
            category,
            brand,
            specifications,
            Number(price),
            Number(stock),
            warranty,
            id
        ],
        function (err) {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    error: "Product not found"
                });
            }

            res.json({
                message: "Product updated successfully"
            });
        }
    );
});


// DELETE PRODUCT
app.delete("/products/:id", (req, res) => {

    const id = req.params.id;

    // First check whether orders exist
    db.get(
        `SELECT COUNT(*) AS count FROM orders WHERE product_id = ?`,
        [id],
        (err, result) => {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            if (result.count > 0) {
                return res.status(400).json({
                    error: "Cannot delete product because orders exist"
                });
            }

            db.run(
                `DELETE FROM products WHERE id = ?`,
                [id],
                function (err) {

                    if (err) {
                        return res.status(500).json({
                            error: err.message
                        });
                    }

                    if (this.changes === 0) {
                        return res.status(404).json({
                            error: "Product not found"
                        });
                    }

                    res.json({
                        message: "Product deleted successfully"
                    });
                }
            );
        }
    );
});


// =====================================================
// ORDERS
// =====================================================

// CREATE ORDER
app.post("/orders", (req, res) => {

    const {
        product_id,
        quantity
    } = req.body;

    if (product_id === undefined || quantity === undefined) {
        return res.status(400).json({
            error: "product_id and quantity are required"
        });
    }

    const productId = Number(product_id);
    const orderQuantity = Number(quantity);

    if (!Number.isInteger(productId)) {
        return res.status(400).json({
            error: "product_id must be an integer"
        });
    }

    if (!Number.isInteger(orderQuantity) || orderQuantity <= 0) {
        return res.status(400).json({
            error: "Quantity must be greater than 0"
        });
    }

    // Find product
    db.get(
        `SELECT * FROM products WHERE id = ?`,
        [productId],
        (err, product) => {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            if (!product) {
                return res.status(404).json({
                    error: "Product not found"
                });
            }

            // Check stock
            if (product.stock < orderQuantity) {
                return res.status(400).json({
                    error: "Not enough stock",
                    available_stock: product.stock
                });
            }

            const totalAmount =
                product.price * orderQuantity;

            // Insert order
            const orderSql = `
                INSERT INTO orders
                (product_id, quantity, price, total_amount, order_status)
                VALUES (?, ?, ?, ?, ?)
            `;

            db.run(
                orderSql,
                [
                    productId,
                    orderQuantity,
                    product.price,
                    totalAmount,
                    "Placed"
                ],
                function (err) {

                    if (err) {
                        return res.status(500).json({
                            error: err.message
                        });
                    }

                    const orderId = this.lastID;

                    // Reduce stock
                    db.run(
                        `UPDATE products
                         SET stock = stock - ?
                         WHERE id = ?`,
                        [orderQuantity, productId],
                        (err) => {

                            if (err) {
                                return res.status(500).json({
                                    error: err.message
                                });
                            }

                            res.status(201).json({
                                message: "Order placed successfully",
                                order_id: orderId,
                                product: product.name,
                                quantity: orderQuantity,
                                price: product.price,
                                total_amount: totalAmount,
                                order_status: "Placed"
                            });
                        }
                    );
                }
            );
        }
    );
});


// READ ALL ORDERS
app.get("/orders", (req, res) => {

    const sql = `
        SELECT
            orders.id,
            orders.product_id,
            products.name AS product_name,
            products.category,
            orders.quantity,
            orders.price,
            orders.total_amount,
            orders.order_status
        FROM orders
        JOIN products
        ON orders.product_id = products.id
        ORDER BY orders.id DESC
    `;

    db.all(sql, [], (err, rows) => {

        if (err) {
            return res.status(500).json({
                error: err.message
            });
        }

        res.json(rows);
    });
});


// READ SINGLE ORDER
app.get("/orders/:id", (req, res) => {

    const id = req.params.id;

    const sql = `
        SELECT
            orders.id,
            orders.product_id,
            products.name AS product_name,
            products.category,
            orders.quantity,
            orders.price,
            orders.total_amount,
            orders.order_status
        FROM orders
        JOIN products
        ON orders.product_id = products.id
        WHERE orders.id = ?
    `;

    db.get(sql, [id], (err, row) => {

        if (err) {
            return res.status(500).json({
                error: err.message
            });
        }

        if (!row) {
            return res.status(404).json({
                error: "Order not found"
            });
        }

        res.json(row);
    });
});


// UPDATE ORDER STATUS
app.put("/orders/:id", (req, res) => {

    const id = req.params.id;
    const { order_status } = req.body;

    const allowedStatuses = [
        "Placed",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled"
    ];

    if (!order_status) {
        return res.status(400).json({
            error: "order_status is required"
        });
    }

    if (!allowedStatuses.includes(order_status)) {
        return res.status(400).json({
            error: "Invalid order status",
            allowed_statuses: allowedStatuses
        });
    }

    // Find order
    db.get(
        `SELECT * FROM orders WHERE id = ?`,
        [id],
        (err, order) => {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            if (!order) {
                return res.status(404).json({
                    error: "Order not found"
                });
            }

            // Already cancelled
            if (order.order_status === "Cancelled") {
                return res.status(400).json({
                    error: "Cancelled order cannot be updated"
                });
            }

            // If cancelling, restore stock
            if (order_status === "Cancelled") {

                db.run(
                    `UPDATE products
                     SET stock = stock + ?
                     WHERE id = ?`,
                    [
                        order.quantity,
                        order.product_id
                    ],
                    (err) => {

                        if (err) {
                            return res.status(500).json({
                                error: err.message
                            });
                        }

                        updateStatus();
                    }
                );

            } else {
                updateStatus();
            }

            function updateStatus() {

                db.run(
                    `UPDATE orders
                     SET order_status = ?
                     WHERE id = ?`,
                    [
                        order_status,
                        id
                    ],
                    (err) => {

                        if (err) {
                            return res.status(500).json({
                                error: err.message
                            });
                        }

                        res.json({
                            message: "Order status updated successfully",
                            order_id: Number(id),
                            order_status: order_status
                        });
                    }
                );
            }
        }
    );
});


// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {

    console.log(
        `Server running at http://localhost:${PORT}`
    );

});