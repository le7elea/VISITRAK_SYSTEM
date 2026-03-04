import { getAdmin } from "../server/firebaseAdmin.js";

const FIELDS_TO_REMOVE = [
  "credentialAlgo",
  "credentialIterations",
  "credentialKeyLength",
  "credentialUpdatedAt",
];

const hasAnyField = (data = {}) =>
  FIELDS_TO_REMOVE.some((field) =>
    Object.prototype.hasOwnProperty.call(data, field)
  );

const buildDeletePayload = (admin) =>
  FIELDS_TO_REMOVE.reduce((payload, field) => {
    payload[field] = admin.firestore.FieldValue.delete();
    return payload;
  }, {});

async function run() {
  const admin = await getAdmin();
  const db = admin.firestore();
  const officesSnapshot = await db.collection("offices").get();

  if (officesSnapshot.empty) {
    console.log("No office documents found.");
    return;
  }

  const deletePayload = buildDeletePayload(admin);
  const BATCH_LIMIT = 400;
  let batch = db.batch();
  let pendingOps = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const doc of officesSnapshot.docs) {
    const data = doc.data() || {};
    if (!hasAnyField(data)) {
      skippedCount += 1;
      continue;
    }

    batch.update(doc.ref, deletePayload);
    pendingOps += 1;
    updatedCount += 1;

    if (pendingOps >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      pendingOps = 0;
    }
  }

  if (pendingOps > 0) {
    await batch.commit();
  }

  console.log(
    `Cleanup complete. Updated: ${updatedCount}. Skipped (already clean): ${skippedCount}.`
  );
}

run().catch((error) => {
  console.error("Failed to clean office credential metadata fields:", error);
  process.exitCode = 1;
});
