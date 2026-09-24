"use client";

import React, { useState, forwardRef, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import HTMLFlipBook from "react-pageflip";

// Worker do PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FlipbookViewerProps {
  blobUrl: string;
}

// O componente de página precisa do forwardRef para o react-pageflip manipular no DOM
const PageWrapper = forwardRef<HTMLDivElement, { pageNumber: number; pageWidth?: number }>(
  ({ pageNumber, pageWidth = 450 }, ref) => {
    return (
      <div 
        ref={ref} 
        className="page bg-white shadow-[inset_0_0_10px_rgba(0,0,0,0.1)] flex flex-col"
        data-density="soft"
      >
        <Page 
          pageNumber={pageNumber} 
          renderTextLayer={false} 
          renderAnnotationLayer={false}
          width={pageWidth}
          className="pointer-events-none" 
        />
      </div>
    );
  }
);
PageWrapper.displayName = "PageWrapper";

export default function FlipbookViewer({ blobUrl }: FlipbookViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [windowWidth, setWindowWidth] = useState<number>(1024);
  const [windowHeight, setWindowHeight] = useState<number>(800);
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);
  
  // Ref para guardar as dimensões iniciais no mobile (não mudam com a barra do Chrome)
  const lockedDims = useRef<{ w: number; h: number } | null>(null);

  useEffect(() => {
    // Detecta se é um dispositivo touch REAL (celular/tablet) vs desktop
    const isTouch = navigator.maxTouchPoints > 0 && window.screen.width < 1200;
    setIsTouchDevice(isTouch);

    const measure = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const portrait = h > w;
      
      if (isTouch) {
        // MOBILE: Trava as dimensões na primeira medição de cada orientação.
        // Isso impede que a barra do Chrome cause recálculos ao sumir/aparecer.
        const currentOrientation = portrait ? 'portrait' : 'landscape';
        const prevOrientation = lockedDims.current 
          ? (lockedDims.current.h > lockedDims.current.w ? 'portrait' : 'landscape') 
          : null;
        
        if (!lockedDims.current || currentOrientation !== prevOrientation) {
          // Orientação mudou (ou primeira vez): captura novas dimensões
          lockedDims.current = { w, h };
        }
        // Sempre usa as dimensões travadas
        setWindowWidth(lockedDims.current.w);
        setWindowHeight(lockedDims.current.h);
        setIsPortrait(lockedDims.current.h > lockedDims.current.w);
      } else {
        // DESKTOP: Comportamento normal, responde a qualquer resize
        setWindowWidth(w);
        setWindowHeight(h);
        setIsPortrait(portrait);
      }
    };
    
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // --- MATEMÁTICA PARA MÁXIMA OCUPAÇÃO DE TELA ---
  const A4_RATIO = 1.414;
  let pageWidth = 450;
  let pageHeight = 636;

  // "Modo cinema" = celular deitado (touch + paisagem)
  const isCinemaMode = isTouchDevice && !isPortrait;

  if (windowWidth > 0 && windowHeight > 0) {
    if (isPortrait) {
      // === MODO RETRATO (1 página) ===
      const marginHeight = 220;
      const marginWidth = 40;
      const availableHeight = windowHeight - marginHeight;
      const availableWidth = windowWidth - marginWidth;

      pageWidth = availableWidth;
      pageHeight = pageWidth * A4_RATIO;
      
      if (pageHeight > availableHeight) {
        pageHeight = availableHeight;
        pageWidth = pageHeight / A4_RATIO;
      }
    } else if (isCinemaMode) {
      // === MODO CINEMA (celular/tablet deitado) - Fullscreen máximo ===
      // Margem mínima absoluta (2px) para o PDF praticamente encostar nas bordas
      const availableHeight = windowHeight - 4;
      const availableWidth = windowWidth - 4;

      pageHeight = availableHeight;
      pageWidth = pageHeight / A4_RATIO;

      if ((pageWidth * 2) > availableWidth) {
        pageWidth = availableWidth / 2;
        pageHeight = pageWidth * A4_RATIO;
      }
    } else {
      // === DESKTOP (paisagem em tela grande) ===
      const marginHeight = 100;
      const marginWidth = 100;
      const availableHeight = windowHeight - marginHeight;
      const availableWidth = windowWidth - marginWidth;

      pageHeight = availableHeight;
      pageWidth = pageHeight / A4_RATIO;

      if ((pageWidth * 2) > availableWidth) {
        pageWidth = availableWidth / 2;
        pageHeight = pageWidth * A4_RATIO;
      }
    }
  }

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("Erro ao carregar PDF:", error);
    setErrorMsg(error.message);
    setIsLoading(false);
  };

  return (
    <div className={`w-full h-full flex flex-col items-center overflow-hidden ${
      isPortrait ? 'justify-start pt-4' : 'justify-center'
    }`}>
      {isLoading && !errorMsg && (
        <div className="flex flex-col items-center justify-center animate-pulse mt-20">
          <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-800 rounded-full animate-spin mb-4"></div>
          <p className="text-zinc-600 font-medium">Preparando o Flipbook...</p>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200 mt-20">
          <p className="font-bold">Falha ao carregar o documento.</p>
          <p className="text-sm">{errorMsg}</p>
        </div>
      )}

      {/* O componente Document processa o arquivo em background */}
      <div className={`transition-opacity duration-700 ease-in-out w-full flex justify-center ${isLoading || errorMsg ? 'opacity-0 absolute -z-10' : 'opacity-100 flex items-center justify-center z-10'}`}>
        <Document
          file={blobUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
        >
          {numPages > 0 && (
            // @ts-ignore
            <HTMLFlipBook
              key={isPortrait ? "portrait" : "landscape"}
              width={pageWidth} 
              height={pageHeight} 
              size="fixed"
              usePortrait={isPortrait}
              showCover={true}
              mobileScrollSupport={false}
              swipeDistance={30}
              flippingTime={800}
              maxShadowOpacity={0.5}
              className="shadow-2xl mx-auto"
              style={{ margin: "0 auto" }}
            >
              {Array.from(new Array(numPages), (el, index) => index + 1).map(pageNum => (
                <PageWrapper 
                  key={`page_${pageNum}`} 
                  pageNumber={pageNum} 
                  pageWidth={pageWidth}
                />
              ))}
            </HTMLFlipBook>
          )}
        </Document>
      </div>
      
      {/* Rodapé: Instrução + Modal (apenas no modo retrato / em pé) */}
      {!isLoading && numPages > 0 && isPortrait && (
        <div className="mt-6 flex flex-col items-center justify-center z-10 w-full px-4">
          <p className="text-zinc-400 text-sm text-center mb-4">
            Arraste pelas pontas ou clique nas bordas para virar a página.
          </p>

          <div className="flex flex-col items-center justify-center bg-zinc-900/80 p-4 rounded-xl backdrop-blur-md shadow-lg border border-zinc-800 w-full max-w-sm">
            <div className="bg-white rounded-lg mb-2 w-full flex justify-center items-center overflow-hidden" style={{ height: '70px' }}>
              <img src="/belasartes.png" alt="Belas Artes" className="h-full object-contain scale-[2.2]" />
            </div>
            <p className="text-zinc-300 text-xs text-center font-medium">Elaborado por: Ludmyla Azevedo Rocha</p>
          </div>
        </div>
      )}

      {/* === DESKTOP: Instrução no rodapé (SEMPRE aparece no desktop) === */}
      {!isLoading && numPages > 0 && !isPortrait && !isTouchDevice && (
        <div className="mt-4 text-center z-10">
          <p className="text-zinc-400 text-sm">
            Arraste pelas pontas ou clique nas bordas para virar a página.
          </p>
        </div>
      )}

      {/* === DESKTOP: Modal / Assinatura (Canto Esquerdo, SEMPRE aparece no desktop) === */}
      {!isLoading && numPages > 0 && !isPortrait && !isTouchDevice && (() => {
        const bookTotalWidth = pageWidth * 2;
        const gapLeft = (windowWidth - bookTotalWidth) / 2;
        const modalScale = Math.min(1, Math.max(0.5, (gapLeft - 20) / 280));
        if (gapLeft < 80) return null;
        return (
          <div
            className="absolute bottom-8 left-4 flex flex-col items-center z-50 pointer-events-none bg-zinc-900/80 p-5 rounded-2xl backdrop-blur-md shadow-2xl border border-zinc-700/50"
            style={{
              transformOrigin: 'bottom left',
              transform: `scale(${modalScale})`,
              maxWidth: `${gapLeft - 30}px`,
            }}
          >
            <div className="bg-white rounded-xl mb-3 flex justify-center items-center overflow-hidden" style={{ width: '260px', height: '100px' }}>
              <img src="/belasartes.png" alt="Belas Artes" className="h-full object-contain scale-[2.5]" />
            </div>
            <p className="text-zinc-300 text-sm font-medium">
              Elaborado por: Ludmyla Azevedo Rocha
            </p>
          </div>
        );
      })()}

      {/* === CELULAR DEITADO (Cinema Mode): Tela 100% limpa, nada aparece === */}
    </div>
  );
}
