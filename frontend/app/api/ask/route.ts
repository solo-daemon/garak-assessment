import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const CHAT_END_POINT=process.env.CHAT_END_POINT!
  try {
    // Parse JSON body from client
    const body = await req.json();

    // Forward the request to your external API
    const apiRes = await fetch(CHAT_END_POINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // You can forward auth tokens here if needed
        // "Authorization": req.headers.get("authorization") || "",
      },
      body: JSON.stringify(body),
    });

    // Get data from external API
    const data = await apiRes.json();

    // Send it back to the client
    return NextResponse.json(data, { status: apiRes.status });
  } catch (err) {
    console.error("Proxy error:", err);
    return NextResponse.json({ error: "Proxy request failed" }, { status: 500 });
  }
}