import { sql } from "drizzle-orm";
import { analyzeUrl, type AnalyzeRequest, type AnalyzeResult } from "@/src/lib/probe";
import { buildSurgeList } from "@/src/lib/surge";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AnalyzeRequest;
    const result = await analyzeUrl(payload);
    const surgeList = buildSurgeList(result.hosts, {
      title: inferTitle(result),
      source: result.inputUrl,
      mode: payload.mode || "suffix",
    });

    await persistObservations(result);

    return Response.json({
      ...result,
      surgeList,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected analyze error" },
      { status: 400 },
    );
  }
}

function inferTitle(result: AnalyzeResult): string {
  try {
    return new URL(result.inputUrl).hostname.replace(/^www\./, "");
  } catch {
    return "SurgeRules";
  }
}

async function persistObservations(result: AnalyzeResult) {
  try {
    const [{ getDb }, schema] = await Promise.all([import("@/db"), import("@/db/schema")]);
    const db = getDb();
    for (const domain of result.hosts) {
      await db
        .insert(schema.domainObservations)
        .values({
          host: domain.host,
          category: domain.category,
          score: domain.score,
          observedCount: 1,
          selectedCount: domain.selected ? 1 : 0,
        })
        .onConflictDoUpdate({
          target: [schema.domainObservations.host, schema.domainObservations.category],
          set: {
            score: domain.score,
            observedCount: sql`${schema.domainObservations.observedCount} + 1`,
            selectedCount: domain.selected
              ? sql`${schema.domainObservations.selectedCount} + 1`
              : schema.domainObservations.selectedCount,
            lastObservedAt: sql`CURRENT_TIMESTAMP`,
          },
        });
    }
  } catch {
    // Local dev and test runs may not have a D1 binding. Analysis remains useful without persistence.
  }
}
