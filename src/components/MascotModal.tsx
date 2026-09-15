import React from 'react';
import { X, Shield, BookOpen, Sparkles, CheckCircle2 } from 'lucide-react';

interface MascotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MascotModal: React.FC<MascotModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      id="vua-mascot-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="vua-mascot-modal-container"
        className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          id="btn-close-mascot-modal"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-zinc-400 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 rounded-full transition border border-zinc-700"
          aria-label="Fechar modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left: O'Reilly Book Aesthetic Poster */}
          <div className="bg-[#f8f5ee] text-zinc-900 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-zinc-800 relative overflow-hidden select-none">
            {/* O'Reilly Classic Top Banner */}
            <div className="border-b-4 border-amber-900 pb-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black tracking-widest uppercase text-amber-900 font-serif">
                  O&apos;REILLY STYLE CLASSIC
                </span>
                <span className="text-[9px] font-mono bg-amber-900/10 text-amber-950 px-1.5 py-0.5 rounded font-semibold">
                  EST. 2026
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight font-serif text-zinc-950 mt-1">
                VUA in a Nutshell
              </h2>
              <p className="text-xs font-serif italic text-zinc-700">
                The Definitive Guide to Governed Execution
              </p>
            </div>

            {/* Mascot Engraving Image */}
            <div className="my-2 flex flex-col items-center justify-center bg-white p-3 rounded-lg border border-amber-900/20 shadow-inner">
              <img
                id="img-vua-mascot-cover"
                src="/vua-mascot.jpg"
                alt="Mascote VUA - O Pangolim de Governança no clássico estilo de xilogravura O'Reilly"
                className="w-48 h-48 object-contain mix-blend-multiply filter contrast-125"
                onError={(e) => {
                  // Fallback to source asset path if static public is warming up
                  (e.currentTarget as HTMLImageElement).src = '/src/assets/images/vua_mascot_1788905946097.jpg';
                }}
              />
              <span className="text-[10px] font-serif italic text-zinc-600 mt-2">
                Manis crassicaudata • O Pangolim de Governança Criptográfica
              </span>
            </div>

            {/* O'Reilly Classic Bottom Bar */}
            <div className="border-t-2 border-amber-900/30 pt-2 flex items-center justify-between text-[11px] font-serif">
              <span className="font-bold text-amber-950">Vortex Foundation Press</span>
              <span className="text-zinc-600">RFC 8785 • Ed25519</span>
            </div>
          </div>

          {/* Right: Mascot Story & Specifications */}
          <div className="p-6 flex flex-col justify-between space-y-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-xs font-mono mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                Mascote Oficial do VUA
              </div>

              <h3 className="text-xl font-bold tracking-tight text-white mb-2 flex items-center gap-2">
                O Pangolim Blindado
              </h3>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Inspirado na icônica tradição das capas de manuais técnicos da <strong>O&apos;Reilly</strong>, o mascote oficial do <strong>VUA</strong> é o <strong>Pangolim</strong>: o único mamífero do planeta recoberto por uma armadura viva de escamas sobrepostas.
              </p>
            </div>

            {/* Metaphor Traits */}
            <div className="space-y-2.5 my-2">
              <div className="bg-zinc-900/90 border border-zinc-800 p-3 rounded-lg flex items-start gap-3">
                <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200">Escamas de Criptografia Ed25519</h4>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    Cada ação executada emite uma prova criptográfica inviolável, tornando o sistema imune a adulterações e fraudes.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-900/90 border border-zinc-800 p-3 rounded-lg flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200">Canonicalização RFC 8785 JCS</h4>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    Determinismo rigoroso. Nenhum byte fora do lugar, garantindo a mesma assinatura em qualquer arquitetura (x64 ou ARM64).
                  </p>
                </div>
              </div>

              <div className="bg-zinc-900/90 border border-zinc-800 p-3 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200">Sobrevivência em Qualquer Ambiente</h4>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    O pangolim opera nativamente em nuvem (GitHub), desktops (Linux, Windows) e ambientes restritos móveis (Termux / Android).
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
              <span className="font-mono text-[11px]">vua-mascot • ed25519-armored</span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-lg transition text-xs"
              >
                Concluir Leitura
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
