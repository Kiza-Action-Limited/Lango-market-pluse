const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

const uri = process.env.MONGODB_URI;

async function insertAdmin() {
  console.log("ENV CHECK:", uri); // DEBUG (IMPORTANT)

  if (!uri) {
    console.log("❌ MONGODB_URI is missing. Check your .env file");
    return;
  }

  const client = new MongoClient(uri);

  try {
    console.log("🔄 Connecting to MongoDB Atlas...");
    await client.connect();
    console.log("✅ Connected!");

    const db = client.db("Marketpluse");
    const users = db.collection("users");

    const existing = await users.findOne({
      email: "admin@langomarket.com"
    });

    if (existing) {
      console.log("⚠️ Admin already exists");
      return;
    }

    const hashedPassword = await bcrypt.hash("Admin123!", 12);

    const result = await users.insertOne({
      firstName: "System",
      lastName: "Admin",
      email: "admin@langomarket.com",
      phone: "+254700000000",
      password: hashedPassword,
      role: "admin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log("🎉 Admin created successfully!");
    console.log("ID:", result.insertedId);

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await client.close();
    console.log("🔌 Disconnected");
  }
}

insertAdmin();