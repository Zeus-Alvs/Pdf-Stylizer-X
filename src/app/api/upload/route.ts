import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (/* pathname, clientPayload */) => {
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB limit
          tokenPayload: JSON.stringify({}),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("Vercel Blob client upload finalizado com sucesso:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    console.error("Erro no handler de upload Vercel Blob:", error);
    return NextResponse.json(
      { error: error.message || "Falha na geração de token para upload." },
      { status: 400 }
    );
  }
}
