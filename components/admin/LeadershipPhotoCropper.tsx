"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  file: File;
  onApply: (file: File) => void;
  onCancel: () => void;
};

export default function LeadershipPhotoCropper({ file, onApply, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(50);
  const [vertical, setVertical] = useState(50);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const photo = new Image();
    photo.onload = () => setImage(photo);
    photo.onerror = () => setError("This image could not be opened. Choose a JPEG, PNG, or WebP photo.");
    photo.src = url;
    return () => {
      photo.onload = null;
      photo.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !image) return;
    // Use the same 4:5 frame for the preview, saved image, and public cards.
    const width = Math.min(image.naturalWidth, image.naturalHeight * 4 / 5) / zoom;
    const height = width * 5 / 4;
    const left = (image.naturalWidth - width) * horizontal / 100;
    const top = (image.naturalHeight - height) * vertical / 100;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, left, top, width, height, 0, 0, canvas.width, canvas.height);
  }, [image, zoom, horizontal, vertical]);

  function applyCrop() {
    if (!image || !canvasRef.current) return;
    setApplying(true);
    setError("");
    canvasRef.current.toBlob((blob) => {
      setApplying(false);
      if (!blob) {
        setError("Unable to crop this photo. Please try another image.");
        return;
      }
      onApply(new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-cropped.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  }

  return (
    <div className="rounded-sm border border-forest/15 bg-paper p-4 sm:col-span-2">
      <h4 className="font-display text-lg text-forest">Crop leadership photo</h4>
      <p className="mt-1 text-sm text-graphite/65">Adjust the zoom and position to keep the face inside the frame. This is how the photo will appear on the leadership page.</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,240px)_1fr]">
        <canvas ref={canvasRef} width={800} height={1000} aria-label="Leadership photo crop preview" className="aspect-[4/5] w-full max-w-60 rounded-sm bg-forest/5" />
        <fieldset disabled={!image || applying} className="space-y-4 disabled:opacity-50">
          <label className="block text-sm text-forest">Zoom
            <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="mt-2 block w-full accent-forest" />
          </label>
          <label className="block text-sm text-forest">Horizontal position
            <input type="range" min="0" max="100" value={horizontal} onChange={(event) => setHorizontal(Number(event.target.value))} className="mt-2 block w-full accent-forest" />
          </label>
          <label className="block text-sm text-forest">Vertical position
            <input type="range" min="0" max="100" value={vertical} onChange={(event) => setVertical(Number(event.target.value))} className="mt-2 block w-full accent-forest" />
          </label>
          <button type="button" onClick={() => { setZoom(1); setHorizontal(50); setVertical(50); }} className="min-h-11 text-sm text-forest underline">Reset crop</button>
        </fieldset>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={!image || applying} onClick={applyCrop} className="min-h-11 rounded-sm bg-forest px-4 text-sm text-gold disabled:opacity-50">{applying ? "Applying…" : "Use crop"}</button>
        <button type="button" disabled={applying} onClick={onCancel} className="min-h-11 rounded-sm border border-forest/15 px-4 text-sm text-forest">Cancel</button>
      </div>
    </div>
  );
}
