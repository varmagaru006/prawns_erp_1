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
    // readWriteAnyDatabase allows the app user to create and write to per-tenant
    // databases (e.g. prawn_erp_<tenant_id>) when ENABLE_MULTI_DB_ROUTING=true.
    { role: "readWriteAnyDatabase", db: "admin" },
  ],
});

print("✅ Docker init: user '" + appUser + "' created. Use MONGO_URL with this user in .env");
