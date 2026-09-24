"use client";

import { useState, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { upload } from "@vercel/blob/client";
import { uploadPdfAction } from "@/app/actions";

function createSlug(filename: string) {
  const nameWithoutExt = filename.replace(/\.pdf$/i, "");
  return nameWithoutExt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function UploadForm() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessLink, setUploadSuccessLink] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  const handleDownloadQR = () => {
    if (!qrWrapperRef.current) return;
    const canvas = qrWrapperRef.current.querySelector("canvas");
    if (!canvas) return;
    
    // Converte o canvas para uma imagem PNG (base64)
    const pngUrl = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = "qrcode-revista.png";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        setSelectedFile(file);
        setUploadSuccessLink(null); // reseta se tentar arrastar outro
      } else {
        alert("Por favor, envie apenas arquivos PDF.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === "application/pdf") {
        setSelectedFile(file);
        setUploadSuccessLink(null);
      } else {
        alert("Por favor, envie apenas arquivos PDF.");
      }
    }
  };

  const resetForm = () => {
    if (isUploading) return;
    setSelectedFile(null);
    setUploadSuccessLink(null);
    setIsCopied(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    let documentId = "";

    try {
      const slug = createSlug(selectedFile.name) || "documento";
      const shortUuid = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().split("-")[0]
        : Math.random().toString(36).substring(2, 10);
      documentId = `${slug}_${shortUuid}`;
      const targetFilename = `${documentId}.pdf`;

      try {
        // 1. Tenta upload direto pelo cliente via Vercel Blob (para Vercel / Produção)
        const blob = await upload(`pdfs/${targetFilename}`, selectedFile, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });

        if (!blob.url) {
          throw new Error("Falha ao obter URL do Blob");
        }
      } catch (clientErr: any) {
        console.warn("Client upload via Vercel Blob não disponível ou falhou, tentando Server Action...", clientErr);
        // 2. Fallback para Server Action (ambiente local de desenvolvimento)
        const formData = new FormData();
        formData.append("file", selectedFile);
        
        const response = await uploadPdfAction(formData);
        
        if (!response.success || !response.id) {
          throw new Error(response.error || "Erro ao realizar upload");
        }
        documentId = response.id;
      }
      
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://seudominio.com';
      const linkGerado = `${baseUrl}/doc/${documentId}`;
      
      setUploadSuccessLink(linkGerado);
    } catch (error: any) {
      console.error("Upload error:", error);
      alert(`Ocorreu um erro no upload: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyLink = async () => {
    if (uploadSuccessLink) {
      try {
        await navigator.clipboard.writeText(uploadSuccessLink);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000); // Reseta o estado de copiado após 3s
      } catch (err) {
        console.error("Falha ao copiar:", err);
      }
    }
  };

  // 1. Estado de Sucesso (Após Upload)
  if (uploadSuccessLink) {
    return (
      <div className="w-full h-auto min-h-[16rem] border border-zinc-700 rounded-xl bg-zinc-900/50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-300">
        
        <div className="flex items-center justify-center w-12 h-12 bg-green-500/20 text-green-400 rounded-full mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h3 className="text-zinc-100 font-bold text-xl mb-1">Upload Concluído!</h3>
        <p className="text-zinc-400 text-sm mb-6">O seu PDF está pronto para visualização.</p>

        {/* QR Code Container */}
        <div className="flex flex-col items-center mb-6">
          <div ref={qrWrapperRef} className="bg-zinc-200 p-4 rounded-xl border border-zinc-700 shadow-sm mb-3">
            <QRCodeCanvas value={uploadSuccessLink} size={140} fgColor="#18181b" bgColor="transparent" />
          </div>
          <button 
            onClick={handleDownloadQR}
            className="text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1 bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1.5 rounded-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Baixar QR Code (PNG)
          </button>
        </div>

        {/* Link & Copy Box */}
        <div className="flex items-center gap-2 w-full max-w-sm bg-zinc-900/80 border border-zinc-700 rounded-lg p-2 mb-6">
          <div className="flex-1 overflow-hidden">
            <p className="text-sm text-zinc-300 truncate px-2 select-all">
              {uploadSuccessLink}
            </p>
          </div>
          <button
            onClick={handleCopyLink}
            className="flex-shrink-0 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            {isCopied ? "Copiado!" : "Copiar"}
          </button>
        </div>

        <button
          onClick={resetForm}
          className="text-zinc-400 text-sm font-medium hover:text-zinc-200 transition-colors underline underline-offset-4"
        >
          Fazer upload de outro arquivo
        </button>
      </div>
    );
  }

  return (
    <>
      {/* 2. Área de Drag & Drop (Nenhum Arquivo) */}
      {!selectedFile ? (
        <div
          className={`
            relative flex flex-col items-center justify-center w-full h-64
            border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer
            ${isDragging ? "border-zinc-500 bg-zinc-800/80" : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50"}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          
          <svg
            className={`w-12 h-12 mb-4 transition-colors ${isDragging ? "text-zinc-200" : "text-zinc-500"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>

          <p className="text-zinc-300 font-medium mb-1">
            Clique ou arraste o seu PDF até aqui
          </p>
          <p className="text-sm text-zinc-500">Tamanho máximo: 50MB</p>
        </div>
      ) : (
        /* 3. Arquivo Selecionado & Carregamento */
        <div className="w-full h-64 border border-zinc-700 rounded-xl bg-zinc-900/50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          
          {isUploading ? (
            /* Loading Spinner */
            <div className="flex flex-col items-center animate-in fade-in duration-300">
              <svg className="animate-spin h-10 w-10 text-zinc-100 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-zinc-100 font-semibold text-lg">Fazendo Upload...</p>
              <p className="text-zinc-400 text-sm mt-1">Por favor, aguarde alguns segundos.</p>
            </div>
          ) : (
            /* Arquivo Pronto */
            <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
              <svg className="w-12 h-12 text-zinc-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              
              <p className="text-zinc-100 font-semibold text-lg truncate max-w-full px-4 mb-1">
                {selectedFile.name}
              </p>
              <p className="text-sm text-zinc-500 mb-6">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>

              <div className="flex gap-3">
                <button
                  onClick={resetForm}
                  className="px-5 py-2.5 rounded-lg border border-zinc-700 text-zinc-400 font-medium hover:bg-zinc-800 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  className="px-5 py-2.5 rounded-lg bg-zinc-100 text-zinc-900 font-medium hover:bg-white transition-colors shadow-sm flex items-center gap-2"
                >
                  Fazer Upload
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </>
  );
}
