/**
 * One-time script to create a MongoDB user for Prawn ERP (main app + super-admin).
 * Run from project root: mongosh mongodb://localhost:27017 scripts/mongo_create_erp_user.js
 *
 * If MongoDB already has auth enabled, connect as admin first, e.g.:
 *   mongosh "mongodb://admin:yourAdminPass@localhost:27017/admin" scripts/mongo_create_erp_user.js
 *
 * To use a custom password, edit the line below or use:
 *   mongosh ... --eval 'const P="myPass"; db.getSiblingDB("admin").createUser({user:"prawn_erp_user",pwd:P,roles:[{role:"readWrite",db:"prawn_erp"},{role:"readWrite",db:"prawn_erp_super_admin"}]})'
 *
 * Then set in backend/.env and super-admin-api/.env:
 *   MONGO_URL=mongodb://prawn_erp_user:YOUR_CHOSEN_PASSWORD@localhost:27017
 */

// Edit this to your desired password before running
const password = "prawn_erp_dev_password";

const db = db.getSiblingDB("admin");

try {
  db.createUser({
    user: "prawn_erp_user",
    pwd: password,
    roles: [
      { role: "readWrite", db: "prawn_erp" },
      { role: "readWrite", db: "prawn_erp_super_admin" },
    ],
  });
  print("✅ User 'prawn_erp_user' created successfully.");
  print("   Use MONGO_URL=mongodb://prawn_erp_user:<password>@localhost:27017 in .env");
} catch (e) {
  if (e.codeName === "DuplicateKey" || e.code === 51003) {
    print("⚠️  User 'prawn_erp_user' already exists. To reset password, drop and re-run:");
    print("   mongosh ... --eval \"db.getSiblingDB('admin').dropUser('prawn_erp_user')\"");
  } else {
    print("❌ Error: " + e.message);
    throw e;
  }
}
