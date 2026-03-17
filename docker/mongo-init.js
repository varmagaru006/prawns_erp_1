/**
 * Runs inside MongoDB container on first start (docker-entrypoint-initdb.d).
 * Must match: MONGO_INITDB_ROOT_USERNAME and MONGO_INITDB_ROOT_PASSWORD in docker-compose.yml.
 */
const rootUser = "admin";
const rootPassword = "mongo_admin_local";

const appUser = "prawn_erp_user";
const appPassword = "prawn_erp_dev_password";

const admin = db.getSiblingDB("admin");
admin.auth(rootUser, rootPassword);

admin.createUser({
  user: appUser,
  pwd: appPassword,
  roles: [
    { role: "readWrite", db: "prawn_erp" },
    { role: "readWrite", db: "prawn_erp_super_admin" },
  ],
});

print("✅ Docker init: user '" + appUser + "' created. Use MONGO_URL with this user in .env");
