#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { cert, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const batchSize = 450;
const inQueryLimit = 30;

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const options = parseOptions(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (!options.planId) {
    throw new Error("Missing required option: --planId <planId>");
  }

  if (options.execute && options.dryRun) {
    throw new Error("Use either --dry-run or --execute, not both.");
  }

  const mode = options.execute ? "execute" : "dry-run";
  const db = getFirestoreClient();
  const planRef = db.collection("plans").doc(options.planId);

  const [planSnapshot, eventSnapshots, guestSnapshots, responseSnapshots] =
    await Promise.all([
      planRef.get(),
      getDocumentsByPlanId(db, "events", options.planId),
      getDocumentsByPlanId(db, "guests", options.planId),
      getDocumentsByPlanId(db, "responses", options.planId)
    ]);

  const planSnapshots = planSnapshot.exists ? [planSnapshot] : [];
  const targetIds = collectAuditTargetIds({
    planId: options.planId,
    planSnapshots,
    eventSnapshots,
    guestSnapshots,
    responseSnapshots
  });
  const auditLogSnapshots = await getAuditLogsByTargetIds(db, targetIds);
  const planData = planSnapshot.exists ? planSnapshot.data() : null;

  printSummary({
    mode,
    planId: options.planId,
    planData,
    planSnapshots,
    eventSnapshots,
    guestSnapshots,
    responseSnapshots,
    auditLogSnapshots,
    includeAuditLogs: options.includeAuditLogs
  });

  if (!options.execute) {
    console.log("");
    console.log("Dry-run only. No documents were deleted.");
    console.log("To delete, re-run with --execute.");
    return;
  }

  if (planData?.isActive !== false && !options.forceActive) {
    throw new Error(
      "The plan is active. Add --force-active if you intentionally want to delete active test data."
    );
  }

  await deleteSnapshots(db, "responses", responseSnapshots);
  await deleteSnapshots(db, "guests", guestSnapshots);
  await deleteSnapshots(db, "events", eventSnapshots);

  if (options.includeAuditLogs) {
    await deleteSnapshots(db, "auditLogs", auditLogSnapshots);
  }

  await deleteSnapshots(db, "plans", planSnapshots);

  console.log("");
  console.log("Delete completed.");
}

function loadEnvFile(fileName) {
  const envPath = resolve(process.cwd(), fileName);

  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = unquoteEnvValue(trimmed.slice(separatorIndex + 1).trim());

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseOptions(args) {
  const options = {
    planId: "",
    dryRun: false,
    execute: false,
    forceActive: false,
    includeAuditLogs: false,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--execute") {
      options.execute = true;
    } else if (arg === "--force-active") {
      options.forceActive = true;
    } else if (arg === "--include-audit-logs") {
      options.includeAuditLogs = true;
    } else if (arg === "--planId") {
      const value = args[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --planId.");
      }

      options.planId = value;
      index += 1;
    } else if (arg.startsWith("--planId=")) {
      options.planId = arg.slice("--planId=".length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function getFirestoreClient() {
  if (!getApps().length) {
    const projectId =
      process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Missing Firebase Admin SDK environment variables.");
    }

    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
  }

  return getFirestore();
}

async function getDocumentsByPlanId(db, collectionName, planId) {
  const snapshot = await db.collection(collectionName).where("planId", "==", planId).get();
  return snapshot.docs;
}

function collectAuditTargetIds({
  planId,
  planSnapshots,
  eventSnapshots,
  guestSnapshots,
  responseSnapshots
}) {
  const targetIds = new Set([planId]);

  for (const snapshot of [
    ...planSnapshots,
    ...eventSnapshots,
    ...guestSnapshots,
    ...responseSnapshots
  ]) {
    targetIds.add(snapshot.id);

    const data = snapshot.data();

    for (const fieldName of ["planId", "eventId", "guestId", "responseId"]) {
      if (typeof data[fieldName] === "string") {
        targetIds.add(data[fieldName]);
      }
    }
  }

  return [...targetIds].filter(Boolean);
}

async function getAuditLogsByTargetIds(db, targetIds) {
  if (targetIds.length === 0) {
    return [];
  }

  const auditLogsById = new Map();

  for (const chunk of chunkArray(targetIds, inQueryLimit)) {
    const snapshot = await db.collection("auditLogs").where("targetId", "in", chunk).get();

    for (const document of snapshot.docs) {
      auditLogsById.set(document.id, document);
    }
  }

  return [...auditLogsById.values()];
}

function printSummary({
  mode,
  planId,
  planData,
  planSnapshots,
  eventSnapshots,
  guestSnapshots,
  responseSnapshots,
  auditLogSnapshots,
  includeAuditLogs
}) {
  console.log("RSVP Hub maintenance: delete plan data");
  console.log("--------------------------------------");
  console.log(`Mode: ${mode}`);
  console.log(`Plan ID: ${planId}`);

  if (planData) {
    console.log(`Plan name: ${formatValue(planData.name)}`);
    console.log(`Year month: ${formatValue(planData.yearMonth)}`);
    console.log(`Owner UID: ${formatValue(planData.ownerUid)}`);
    console.log(`Active: ${String(planData.isActive !== false)}`);
  } else {
    console.log("Plan: not found");
  }

  console.log("");
  console.log("Matched documents:");
  console.log(`- plans: ${planSnapshots.length}`);
  console.log(`- events: ${eventSnapshots.length}`);
  console.log(`- guests: ${guestSnapshots.length}`);
  console.log(`- responses: ${responseSnapshots.length}`);
  console.log(
    `- auditLogs: ${auditLogSnapshots.length} (${includeAuditLogs ? "delete" : "keep"})`
  );

  const totalDeleteCount =
    planSnapshots.length +
    eventSnapshots.length +
    guestSnapshots.length +
    responseSnapshots.length +
    (includeAuditLogs ? auditLogSnapshots.length : 0);

  console.log(`Total documents to delete: ${totalDeleteCount}`);
}

function formatValue(value) {
  return value === undefined || value === null || value === "" ? "(empty)" : String(value);
}

async function deleteSnapshots(db, label, snapshots) {
  if (snapshots.length === 0) {
    console.log(`Deleted ${label}: 0`);
    return;
  }

  for (const chunk of chunkArray(snapshots, batchSize)) {
    const batch = db.batch();

    for (const snapshot of chunk) {
      batch.delete(snapshot.ref);
    }

    await batch.commit();
  }

  console.log(`Deleted ${label}: ${snapshots.length}`);
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function printHelp() {
  console.log(`Usage:
  npm run maintenance:delete-plan -- --planId <planId>
  npm run maintenance:delete-plan -- --planId <planId> --execute

Options:
  --planId <planId>       Target plan document ID.
  --dry-run               Preview only. This is the default.
  --execute               Delete matching documents.
  --force-active          Allow deleting an active plan.
  --include-audit-logs    Delete auditLogs whose targetId matches the plan data.
  --help                  Show this help.

Safety:
  The script deletes responses, guests, events, and then the plan.
  auditLogs are kept unless --include-audit-logs is specified.
  Active plans require --force-active when using --execute.`);
}

main()
  .catch((error) => {
    console.error("");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });
