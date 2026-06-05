import { uploadMergedSurgeList, type GitHubUploadRequest } from "@/src/lib/github";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as GitHubUploadRequest;
    const result = await uploadMergedSurgeList(payload);
    await recordExport(`${payload.owner}/${payload.repo}/${payload.path}`, result.mergedRules);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected GitHub upload error" },
      { status: 400 },
    );
  }
}

async function recordExport(target: string, ruleCount: number) {
  try {
    const [{ getDb }, schema] = await Promise.all([import("@/db"), import("@/db/schema")]);
    const db = getDb();
    await db.insert(schema.ruleExports).values({ target, ruleCount });
  } catch {
    // Token-free export telemetry is best effort only.
  }
}
