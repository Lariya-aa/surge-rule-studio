import { batchCheckConnectivity } from "@/src/lib/connectivity";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { hosts?: string[] };
    const hosts = body.hosts || [];
    if (!Array.isArray(hosts) || hosts.length === 0) {
      return Response.json({ results: [] });
    }
    const results = await batchCheckConnectivity(hosts.slice(0, 50));
    return Response.json({ results });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Connectivity check failed" },
      { status: 500 },
    );
  }
}
