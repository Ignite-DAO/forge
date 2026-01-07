import { getCloudflareContext } from "@opennextjs/cloudflare";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface TokenMetadata {
  pool_address: string;
  chain_id: number;
  launch_type: string;
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  created_at: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { env } = getCloudflareContext();
    const { address } = await params;
    const normalizedAddress = address.toLowerCase();

    const result = await env.FORGE_DB.prepare(
      "SELECT * FROM token_metadata WHERE pool_address = ?",
    )
      .bind(normalizedAddress)
      .first<TokenMetadata>();

    if (!result) {
      return NextResponse.json(
        { error: "Metadata not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch metadata" },
      { status: 500 },
    );
  }
}
