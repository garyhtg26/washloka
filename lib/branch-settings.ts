import "server-only";
import type {
  DocumentData,
  Firestore,
  Transaction,
} from "firebase-admin/firestore";
import { branchSettingsId, branchSettingsReadIds } from "./branches";

export function mergeBranchSettings(values: (DocumentData | undefined)[]) {
  const merged: DocumentData = {};
  // Values arrive in preference order. Merge from the least preferred source;
  // partial edits must not hide an existing catalog, payment account or banner.
  for (const value of [...values].reverse()) {
    if (!value) continue;
    const previousContent = merged.content;
    Object.assign(merged, value);
    if (value.content)
      merged.content = {
        ...previousContent,
        ...value.content,
        images: { ...previousContent?.images, ...value.content.images },
      };
  }
  return merged;
}

export async function readBranchSettings(
  database: Firestore,
  branch: unknown,
  tx?: Transaction,
) {
  const refs = branchSettingsReadIds(branch).map((id) =>
    database.doc(`settings/${id}`),
  );
  const snapshots = await Promise.all(
    refs.map((ref) => (tx ? tx.get(ref) : ref.get())),
  );
  const value = mergeBranchSettings(
    snapshots.map((snapshot) => snapshot.data()),
  );
  return {
    ref: database.doc(`settings/${branchSettingsId(branch)}`),
    exists: snapshots.some((snapshot) => snapshot.exists),
    data: () => value,
    get: (path: string): any =>
      path.split(".").reduce((part, key) => part?.[key], value),
  };
}
