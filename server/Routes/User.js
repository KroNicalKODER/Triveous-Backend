/**
 * User routes.
 *
 * GET /products - Get all products.
 * PUT /addToCart/:product_id - Add product to cart.
 * GET /cart - Get cart items.
 * DELETE /deleteFromCart/:product_id - Delete product from cart.
 * DELETE /delete - Delete user.
 * GET /logout - Logout user.
 * GET /product/:product_id - Get product by ID.
 * PUT /buy/:product_id - Buy product.
 * GET /itemsBought - Get items bought by user.
 * GET /order/:order_id - Get order details.
 */
/**
 * User routes.
 *
 * Handles user account management, authentication, and cart operations.
 * Exports Express router with routes for:
 *
 * - Getting all products
 * - Adding product to cart
 * - Getting cart items
 * - Deleting product from cart
 * - Deleting user account
 * - Logging out user
 * - Getting product by ID
 * - Buying product
 * - Getting bought products
 * - Getting order details
 */
import express from "express";
import * as db from "../db/index.js";
import getToken from "../getToken.js";

const router = express.Router();

//Get all the products
router.get("/products", async (req, res) => {
  try {
    const products = await db.query(
      'SELECT * FROM public."Products" WHERE availability = true ORDER BY id ASC'
    );
    res.json(products.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Something went wrong" });
  }
});

//Add to Cart
router.put("/addToCart/:product_id", getToken, async (req, res) => {
  try {
    const { product_id } = req.params;
    const user_id = req.user.id;

    const updateQuery = `
        UPDATE public."Customers"
        SET productincart = array_append(productincart, $1)
        WHERE id = $2
      `;
    const updateValues = [product_id, user_id];

    await db.query(updateQuery, updateValues);

    res
      .status(200)
      .json({ message: "Product added to the cart successfully." });
  } catch (error) {
    console.error("Error adding product to cart:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Items in Cart
router.get("/cart", getToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    const query = `
        SELECT *
        FROM public."Products"
        WHERE id = ANY(
          SELECT unnest(productincart)
          FROM public."Customers"
          WHERE id = $1
        )
      `;
    const values = [user_id];

    const products = await db.query(query, values);

    res.status(200).json(products.rows);
  } catch (error) {
    console.error("Error getting products in cart:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Delete from cart
router.delete("/deleteFromCart/:product_id", getToken, async (req, res) => {
  const product_id = req.params.product_id;
  const user_id = req.user.id;

  //Check if the product is already in the cart or not
  let checkIfInTheCart = `SELECT EXISTS (
    SELECT *
    FROM public."Customers"
    WHERE id = $1
    AND productincart @> ARRAY[$2]::integer[]
  )`;
  let checkValues = [user_id, product_id];

  let result = await db.query(checkIfInTheCart, checkValues);

  if (!result.rows[0].exists) {
    return res.status(400).json({ message: "Product is not in the cart." });
  }

  try {
    const updateQuery = `
      UPDATE public."Customers"
      SET productincart = array_remove(productincart, $1)
      WHERE id = $2
    `;
    const updateValues = [product_id, user_id];

    await db.query(updateQuery, updateValues);

    res
      .status(204)
      .json({ message: "Product deleted from the cart successfully." });
  } catch (err) {
    console.error("Error deleting product from cart:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Delete the user
router.delete("/delete", getToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const deleteQuery = `DELETE FROM public."Customers" WHERE id = $1`;
    const values = [user_id];
    await db.query(deleteQuery, values);
    res.clearCookie("access_token");
    res.status(200).json({ message: "Logged out successfully." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Something went wrong" });
  }
});

//Logout the user
router.get("/logout", getToken, async (req, res) => {
  res.clearCookie("access_token");
  res.status(200).json({ message: "Logged out successfully." });
});

//Get the product by id
router.get("/product/:product_id", async (req, res) => {
  let product_id = req.params.product_id;
  if (!Number(product_id))
    return res
      .status(400)
      .send({ message: "Please enter a valid product id." });

  let query = `SELECT * FROM public."Products" WHERE id = $1`;
  let results = await db.query(query, [product_id]);
  if (results.rows.length === 0)
    return res.status(404).send({ message: "Product not found." });
  res.status(200).send(results.rows[0]);
});

//Buy the Product
router.put("/buy/:product_id", getToken, async (req, res) => {
  try {
    const { product_id } = req.params;
    const user_id = req.user.id;

    // Check if the product exists
    const productQuery = 'SELECT * FROM public."Products" WHERE id = $1';
    const productResult = await db.query(productQuery, [product_id]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: "Product not found." });
    }

    const product = productResult.rows[0];

    // Check if the product is available
    if (!product.availability) {
      return res
        .status(400)
        .json({ error: "Product is not available for purchase." });
    }

    // Update the Orders table
    const buyProductQuery = `
        INSERT INTO public."Orders" (customerid, productid, status, timestamp)
        VALUES ($1, $2, true, CURRENT_DATE)
        RETURNING id
      `;

    const buyProductValues = [user_id, product_id];

    const orderResult = await db.query(buyProductQuery, buyProductValues);
    const orderId = orderResult.rows[0].id;

    // Mark the product as unavailable in the Products table
    const markUnavailableQuery = `
        UPDATE public."Products"
        SET availability = false
        WHERE id = $1
      `;

    await db.query(markUnavailableQuery, [product_id]);

    // Add the product id to the productBought array in the Customers table
    const updateCustomerQuery = `
        UPDATE public."Customers"
        SET productBought = array_append(productBought, $1)
        WHERE id = $2
      `;

    await db.query(updateCustomerQuery, [product_id, user_id]);

    res.status(200).json({ message: "Product bought successfully", orderId });
  } catch (error) {
    console.error("Error buying product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get the itemsBought
router.get("/itemsBought", getToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    if (!user_id) {
      return res.status(404).json({ message: "User not found" });
    }

    // Retrieve the product IDs and timestamps bought by the user
    const ordersQuery =
      'SELECT productid, timestamp FROM public."Orders" WHERE customerid = $1';
    const ordersResult = await db.query(ordersQuery, [user_id]);

    if (ordersResult.rows.length === 0) {
      return res.status(200).json({ message: "No items bought yet." });
    }

    // Extract product IDs and timestamps from the result
    const productsData = ordersResult.rows.map((order) => ({
      productId: order.productid,
      timestamp: order.timestamp,
    }));

    // Extract product IDs from the result
    const productIds = ordersResult.rows.map((order) => order.productid);

    // Fetch details of the bought products
    const productsQuery = 'SELECT * FROM public."Products" WHERE id = ANY($1)';
    const productsResult = await db.query(productsQuery, [productIds]);

    // Combine product details with timestamps
    const productsWithTimestamps = productsData.map((productData) => {
      const productDetails = productsResult.rows.find(
        (product) => product.id === productData.productId
      );
      return {
        ...productDetails,
        timestamp: productData.timestamp,
      };
    });

    res.status(200).json(productsWithTimestamps);
  } catch (err) {
    console.error("Error getting items bought:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//get order detail of an item
router.get("/order/:order_id", getToken, async (req, res) => {
  try {
    const { order_id } = req.params;
    const user_id = req.user.id;

    const orderQuery = 'SELECT * FROM public."Orders" WHERE id = $1';
    const orderResult = await db.query(orderQuery, [order_id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: "Order not found." });
    }

    const order = orderResult.rows[0];

    // Check if the order belongs to the user
    if (order.customerid !== user_id) {
      return res
        .status(400)
        .json({ error: "Order does not belong to the user." });
    }

    // Check if the order is already delivered
    if (order.status) {
      return res
        .status(400)
        .json({ error: "Order already delivered.", orderDetails: order });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error("Error getting order:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
