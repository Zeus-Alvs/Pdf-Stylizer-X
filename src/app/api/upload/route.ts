import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { 
        error: "A variável BLOB_READ_WRITE_TOKEN não está configurada na Vercel. Por favor, crie um Blob Store no painel da Vercel e adicione o Token nas variáveis de ambiente." 
      },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as HandleUploadBody;
    const jsonResponse = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB
          addRandomSuffix: false,
        };
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
