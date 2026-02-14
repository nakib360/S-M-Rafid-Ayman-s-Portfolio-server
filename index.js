const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb"); // ObjectId add kora hoyeche
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 4000;
const uploadsDir = path.join(__dirname, "uploads");
const allowedCategories = new Set([
  "cover",
  "logo",
  "manipulation",
  "print",
  "social",
  "thumbnail",
]);

app.use(express.json());
app.use(cors());
app.use("/uploads/files", express.static(uploadsDir));

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsDir);
  },
  filename: (_req, file, callback) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ext || ".jpg";
    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt}`;
    callback(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return callback(new Error("Only image files are allowed"));
    }
    callback(null, true);
  },
});

const uri =
  process.env.MONGODB_URI ||
  "mongodb+srv://rafid-ayman:fNKD6OBnFf3g7u1y@cluster0.mvfiisx.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("portfolioDB");
    const ordersCollection = db.collection("orders");
    const uploadsCollection = db.collection("uploads");

    console.log("Connected to MongoDB!");

    // POST: Order Create
    app.post("/orders", async (req, res) => {
      try {
        const order = req.body;
        const result = await ordersCollection.insertOne({
          ...order,
          isReviewed: false,
          createdAt: new Date(),
        });
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to create order", error });
      }
    });

    app.get("/orders", async (req, res) => {
      try {
        const orders = await ordersCollection.find({}).sort({ createdAt: -1 }).toArray();
        res.send(orders);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch orders", error });
      }
    });

    app.patch("/orders/:id", async (req, res) => {
      try {
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

    // POST: Upload single image (multipart/form-data)
    app.post("/uploads", upload.single("file"), async (req, res) => {
      try {
        const { category, title } = req.body;

        if (!req.file) {
          return res.status(400).send({ message: "Image file is required" });
        }

        if (!category || !allowedCategories.has(category)) {
          fs.unlink(req.file.path, () => {});
          return res.status(400).send({ message: "Invalid or missing category" });
        }

        const imageUrl = `${req.protocol}://${req.get("host")}/uploads/files/${req.file.filename}`;
        const document = {
          category,
          title: title || req.file.originalname,
          originalName: req.file.originalname,
          fileName: req.file.filename,
          mimeType: req.file.mimetype,
          size: req.file.size,
          imageUrl,
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

        const fileName = existingUpload.fileName
          ? existingUpload.fileName
          : path.basename(existingUpload.imageUrl || "");
        const filePath = path.join(uploadsDir, fileName);

        fs.unlink(filePath, () => {});

        return res.send({ success: true, message: "Upload deleted successfully" });
      } catch (error) {
        return res.status(500).send({ message: "Failed to delete upload", error: error.message });
      }
    });

  } catch (err) {
    console.error(err);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => res.send("Server is running"));

app.listen(PORT, () => console.log(`http://localhost:${PORT}/`));
