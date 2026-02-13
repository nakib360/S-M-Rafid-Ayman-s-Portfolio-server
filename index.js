const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb"); // ObjectId add kora hoyeche

const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(cors());

const uri = "mongodb+srv://rafid-ayman:fNKD6OBnFf3g7u1y@cluster0.mvfiisx.mongodb.net/?appName=Cluster0";

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

    console.log("Connected to MongoDB!");

    // POST: Order Create
    app.post("/orders", async (req, res) => {
      try {
        const order = req.body;
        const result = await ordersCollection.insertOne({
          ...order,
          isReviewed: false, // Default false
          createdAt: new Date(),
        });
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to create order", error });
      }
    });

    // GET: All Orders
    app.get("/orders", async (req, res) => {
      try {
        const orders = await ordersCollection.find({}).sort({ createdAt: -1 }).toArray();
        res.send(orders);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch orders", error });
      }
    });

    // PATCH: Update Review Status
    app.patch("/orders/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updateData = req.body;

        // Validating ID
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

  } catch (err) {
    console.error(err);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => res.send("Server is running"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

