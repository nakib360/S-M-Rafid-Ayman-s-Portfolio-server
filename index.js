const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb"); 
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
require('dotenv').config();

const PORT = process.env.PORT || 4000;
const allowedCategories = new Set([
  "cover",
  "logo",
  "manipulation",
  "print",
  "social",
  "thumbnail",
  "brands"
]);

app.use(express.json());
app.use(cors());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return callback(new Error("Only image files are allowed"));
    }
    callback(null, true);
  },
});

function uploadBufferToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      return resolve(result);
    });
    stream.end(buffer);
  });
}

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let dbCollections;
let connectPromise;

async function getCollections() {
  if (dbCollections) return dbCollections;

  if (!connectPromise) {
    connectPromise = client
      .connect()
      .then(() => {
        const db = client.db("portfolioDB");
        dbCollections = {
          ordersCollection: db.collection("orders"),
          uploadsCollection: db.collection("uploads"),
          reviewsCollection: db.collection("reviews"),
        };
        console.log("Connected to MongoDB!");
        return dbCollections;
      })
      .catch((error) => {
        connectPromise = null;
        throw error;
      });
  }

  return connectPromise;
}

app.post("/orders", async (req, res) => {
  try {
    const { ordersCollection } = await getCollections();
    const order = req.body;
    const result = await ordersCollection.insertOne({
      ...order,
      isReviewed: false,
      createdAt: new Date(),
    });
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to create order", error: error.message });
  }
});

app.get("/orders", async (req, res) => {
  try {
    const { ordersCollection } = await getCollections();
    const orders = await ordersCollection.find({}).sort({ createdAt: -1 }).toArray();
    res.send(orders);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch orders", error: error.message });
  }
});

app.patch("/orders/:id", async (req, res) => {
  try {
    const { ordersCollection } = await getCollections();
    const id = req.params.id;
    const updateData = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid order ID" });
    }

    const result = await ordersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "Order not found" });
    }

    res.send({ success: true, message: "Order updated successfully" });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

app.post("/uploads", upload.single("file"), async (req, res) => {
  try {
    const { uploadsCollection } = await getCollections();
    const { category, title } = req.body;

    if (!req.file) {
      return res.status(400).send({ message: "Image file is required" });
    }

    if (!category || !allowedCategories.has(category)) {
      return res.status(400).send({ message: "Invalid or missing category" });
    }

    const folderRoot = process.env.CLOUDINARY_FOLDER || "portfolio";
    const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
      folder: `${folderRoot}/${category}`,
      resource_type: "image",
    });

    const imageUrl = uploadResult.secure_url;
    const document = {
      category,
      title: title || req.file.originalname,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      imageUrl,
      publicId: uploadResult.public_id,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      createdAt: new Date(),
    };

    const result = await uploadsCollection.insertOne(document);

    res.status(201).send({
      _id: result.insertedId,
      id: result.insertedId,
      title: document.title,
      category: document.category,
      imageUrl: document.imageUrl,
      url: document.imageUrl,
    });
  } catch (error) {
    res.status(500).send({ message: "Failed to upload image", error: error.message });
  }
});

// GET: Uploaded images (optional category filter)
app.get("/uploads", async (req, res) => {
  try {
    const { uploadsCollection } = await getCollections();
    const query = {};
    if (req.query.category) {
      query.category = req.query.category;
    }

    const uploads = await uploadsCollection.find(query).sort({ createdAt: -1 }).toArray();
    res.send(uploads);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch uploads", error: error.message });
  }
});

// DELETE: Remove uploaded image by id
app.delete("/uploads/:id", async (req, res) => {
  try {
    const { uploadsCollection } = await getCollections();
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid upload ID" });
    }

    const filter = { _id: new ObjectId(id) };
    const existingUpload = await uploadsCollection.findOne(filter);

    if (!existingUpload) {
      return res.status(404).send({ message: "Upload not found" });
    }

    const result = await uploadsCollection.deleteOne(filter);
    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "Upload not found" });
    }

    if (existingUpload.publicId) {
      await cloudinary.uploader.destroy(existingUpload.publicId, { resource_type: "image" });
    }

    return res.send({ success: true, message: "Upload deleted successfully" });
  } catch (error) {
    return res.status(500).send({ message: "Failed to delete upload", error: error.message });
  }
});

// Reviews
app.get("/reviews", async (_req, res) => {
  try {
    const { reviewsCollection } = await getCollections();
    const reviews = await reviewsCollection.find({}).sort({ createdAt: -1 }).toArray();
    return res.send(reviews);
  } catch (error) {
    return res.status(500).send({ message: "Failed to load reviews", error: error.message });
  }
});

app.post("/reviews", async (req, res) => {
  try {
    const { reviewsCollection } = await getCollections();
    const name = (req.body?.name || "").trim();
    const role = (req.body?.role || "").trim();
    const quote = (req.body?.quote || "").trim();

    if (!name || !role || !quote) {
      return res.status(400).send({ message: "Name, role and quote are required" });
    }

    const document = { name, role, quote, createdAt: new Date() };
    const result = await reviewsCollection.insertOne(document);

    return res.status(201).send({
      ...document,
      _id: result.insertedId,
      id: result.insertedId,
    });
  } catch (error) {
    return res.status(500).send({ message: "Failed to save review", error: error.message });
  }
});

app.patch("/reviews/:id", async (req, res) => {
  try {
    const { reviewsCollection } = await getCollections();
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid review ID" });
    }

    const updates = {};
    if (typeof req.body?.name === "string") updates.name = req.body.name.trim();
    if (typeof req.body?.role === "string") updates.role = req.body.role.trim();
    if (typeof req.body?.quote === "string") updates.quote = req.body.quote.trim();

    if (!Object.keys(updates).length) {
      return res.status(400).send({ message: "No valid fields provided to update" });
    }

    const result = await reviewsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "Review not found" });
    }

    return res.send({ success: true, message: "Review updated successfully" });
  } catch (error) {
    return res.status(500).send({ message: "Failed to update review", error: error.message });
  }
});

app.delete("/reviews/:id", async (req, res) => {
  try {
    const { reviewsCollection } = await getCollections();
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid review ID" });
    }

    const result = await reviewsCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "Review not found" });
    }

    return res.send({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    return res.status(500).send({ message: "Failed to delete review", error: error.message });
  }
});

app.get("/", (req, res) => res.send("Server is running"));

if (require.main === module) {
  app.listen(PORT, () => console.log(`http://localhost:${PORT}/`));
}

module.exports = app;
