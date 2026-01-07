import { getCloudflareContext } from "@opennextjs/cloudflare";
import { type NextRequest, NextResponse } from "next/server";

type LaunchType = "bonding_curve" | "fair_launch";

interface TokenMetadata {
  pool_address: string;
  chain_id: number;
  launch_type: LaunchType;
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  created_at: number;
}

export async function POST(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const formData = await request.formData();

    const poolAddress = formData.get("poolAddress") as string;
    const chainId = Number(formData.get("chainId"));
    const launchType =
      (formData.get("launchType") as LaunchType) || "bonding_curve";
    const name = formData.get("name") as string;
    const symbol = formData.get("symbol") as string;
    const description = formData.get("description") as string | null;
    const website = formData.get("website") as string | null;
    const twitter = formData.get("twitter") as string | null;
    const telegram = formData.get("telegram") as string | null;
    const image = formData.get("image") as File | null;

    if (!poolAddress || !chainId || !name || !symbol) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const normalizedAddress = poolAddress.toLowerCase();
    let imageUrl: string | null = null;

    if (image && image.size > 0) {
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (image.size > maxSize) {
        return NextResponse.json(
          { error: "Image too large (max 2MB)" },
          { status: 400 },
        );
      }

      const ext = image.name.split(".").pop()?.toLowerCase() || "png";
      const allowedExts = ["png", "jpg", "jpeg", "gif", "svg", "webp"];
      if (!allowedExts.includes(ext)) {
        return NextResponse.json(
          { error: "Invalid image format" },
          { status: 400 },
        );
      }

      const imageKey = `${launchType}/${chainId}/${normalizedAddress}.${ext}`;
      const imageBuffer = await image.arrayBuffer();

      await env.FORGE_IMAGES.put(imageKey, imageBuffer, {
        httpMetadata: {
          contentType: image.type,
        },
      });

      imageUrl = `/api/launches/images/${imageKey}`;
    }

    const normalizedTwitter = twitter?.startsWith("@")
      ? twitter.slice(1)
      : twitter;

    await env.FORGE_DB.prepare(
      `INSERT INTO token_metadata (pool_address, chain_id, launch_type, name, symbol, description, image_url, website, twitter, telegram, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(pool_address) DO UPDATE SET
         description = excluded.description,
         image_url = excluded.image_url,
         website = excluded.website,
         twitter = excluded.twitter,
         telegram = excluded.telegram`,
    )
      .bind(
        normalizedAddress,
        chainId,
        launchType,
        name,
        symbol,
        description || null,
        imageUrl,
        website || null,
        normalizedTwitter || null,
        telegram || null,
        Date.now(),
      )
      .run();

    const metadataUri = `${request.nextUrl.origin}/api/launches/metadata/${normalizedAddress}`;

    return NextResponse.json({
      success: true,
      metadataUri,
      imageUrl,
    });
  } catch (error) {
    console.error("Error creating metadata:", error);
    return NextResponse.json(
      { error: "Failed to create metadata" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const { searchParams } = request.nextUrl;

    const chainId = searchParams.get("chainId");
    const launchType = searchParams.get("launchType");

    if (!chainId) {
      return NextResponse.json(
        { error: "chainId is required" },
        { status: 400 },
      );
    }

    let query = "SELECT * FROM token_metadata WHERE chain_id = ?";
    const params: (string | number)[] = [Number(chainId)];

    if (launchType) {
      query += " AND launch_type = ?";
      params.push(launchType);
    }

    query += " ORDER BY created_at DESC";

    const result = await env.FORGE_DB.prepare(query)
      .bind(...params)
      .all<TokenMetadata>();

    const metadataByAddress: Record<string, TokenMetadata> = {};
    for (const row of result.results) {
      metadataByAddress[row.pool_address] = row;
    }

    return NextResponse.json({ metadata: metadataByAddress });
  } catch (error) {
    console.error("Error fetching metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch metadata" },
      { status: 500 },
    );
  }
}
