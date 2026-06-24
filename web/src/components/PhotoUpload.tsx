import { useRef } from "react";

interface Props {
  onUpload: (dataUri: string) => void;
}

const MAX_DIMENSION = 800;
const JPEG_QUALITY = 0.85;

async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const maxSide = Math.max(width, height);
  if (maxSide > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / maxSide;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export function PhotoUpload({ onUpload }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    try {
      const dataUri = await compressImage(file);
      onUpload(dataUri);
    } catch {
      const reader = new FileReader();
      reader.onload = () => onUpload(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div
      className="border-2 border-dashed border-slate-300 rounded-lg p-5 sm:p-4 text-center cursor-pointer hover:border-brand active:bg-slate-50 min-h-[72px] flex items-center justify-center touch-manipulation"
      onClick={() => ref.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
      }}
    >
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <p className="text-sm text-slate-500">Drop a dish photo or click to upload</p>
    </div>
  );
}
