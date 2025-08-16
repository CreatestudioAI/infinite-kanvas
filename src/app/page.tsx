"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Stage, Layer, ContextMenu } from "react-konva";
import { useDropzone } from "react-dropzone";
import { toast } from "@/hooks/use-toast";
import { useFalClient } from "@/hooks/useFalClient";
import { CanvasImage } from "@/components/canvas/CanvasImage";
import { CanvasVideo } from "@/components/canvas/CanvasVideo";
import { CanvasGrid } from "@/components/canvas/CanvasGrid";
import { CanvasContextMenu } from "@/components/canvas/CanvasContextMenu";
import { CropOverlayWrapper } from "@/components/canvas/CropOverlayWrapper";
import { SelectionBoxComponent } from "@/components/canvas/SelectionBox";
import { StreamingImage } from "@/components/canvas/StreamingImage";
import { StreamingVideo } from "@/components/canvas/StreamingVideo";
import { VideoOverlays } from "@/components/canvas/VideoOverlays";
import { ZoomControls } from "@/components/canvas/ZoomControls";
import { MiniMap } from "@/components/canvas/MiniMap";
import { DimensionDisplay } from "@/components/canvas/DimensionDisplay";
import { MobileToolbar } from "@/components/canvas/MobileToolbar";
import { PoweredByFalBadge } from "@/components/canvas/PoweredByFalBadge";
import { GithubBadge } from "@/components/canvas/GithubBadge";
import { ImageToVideoDialog } from "@/components/canvas/ImageToVideoDialog";
import { VideoToVideoDialog } from "@/components/canvas/VideoToVideoDialog";
import { ExtendVideoDialog } from "@/components/canvas/ExtendVideoDialog";
import { RemoveVideoBackgroundDialog } from "@/components/canvas/VideoModelComponents";
import { GenerationsIndicator } from "@/components/generations-indicator";
import { useTRPC } from "@/trpc/client";
import { debounce } from "@/utils/performance";
import { canvasStorage } from "@/lib/storage";
import { handleRemoveBackground } from "@/lib/handlers/background-handler";
import { handleRun, uploadImageDirect } from "@/lib/handlers/generation-handler";
import { styleModels } from "@/lib/models";
import { placeGeneratedVideo, convertImageToVideo } from "@/utils/video-utils";
import type {
  PlacedImage,
  PlacedVideo,
  HistoryState,
  GenerationSettings,
  VideoGenerationSettings,
  ActiveGeneration,
  ActiveVideoGeneration,
  SelectionBox,
} from "@/types/canvas";
import Konva from "konva";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Upload,
  Wand2,
  Key,
  Sparkles,
  Plus,
} from "lucide-react";
import { SpinnerIcon } from "@/components/icons";

export default function HomePage() {
  // Canvas state
  const [images, setImages] = useState<PlacedImage[]>([]);
  const [videos, setVideos] = useState<PlacedVideo[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [canvasSize] = useState({ width: 1200, height: 800 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStartPositions, setDragStartPositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());

  // Generation state
  const [generationSettings, setGenerationSettings] =
    useState<GenerationSettings>({
      prompt: "",
      loraUrl: "",
      styleId: "",
    });
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeGenerations, setActiveGenerations] = useState<
    Map<string, ActiveGeneration>
  >(new Map());
  const [activeVideoGenerations, setActiveVideoGenerations] = useState<
    Map<string, ActiveVideoGeneration>
  >(new Map());

  // UI state
  const [croppingImageId, setCroppingImageId] = useState<string | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    visible: false,
  });
  const [isolateInputValue, setIsolateInputValue] = useState("");
  const [isolateTarget, setIsolateTarget] = useState<string | null>(null);
  const [isIsolating, setIsIsolating] = useState(false);
  const [customApiKey, setCustomApiKey] = useState<string>("");
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);

  // History state
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Refs
  const stageRef = useRef<Konva.Stage>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // tRPC hooks
  const removeBackgroundMutation = useTRPC().removeBackground.useMutation();
  const isolateObjectMutation = useTRPC().isolateObject.useMutation();
  const generateTextToImageMutation =
    useTRPC().generateTextToImage.useMutation();

  // FAL client
  const falClient = useFalClient(customApiKey);

  // Load saved state on mount
  useEffect(() => {
    const loadSavedState = async () => {
      try {
        const savedState = canvasStorage.getCanvasState();
        if (savedState) {
          // Load images and videos from saved state
          const loadedImages: PlacedImage[] = [];
          const loadedVideos: PlacedVideo[] = [];

          for (const element of savedState.elements) {
            if (element.type === "image" && element.imageId) {
              const imageData = await canvasStorage.getImage(element.imageId);
              if (imageData) {
                loadedImages.push({
                  id: element.id,
                  src: imageData.originalDataUrl,
                  x: element.transform.x,
                  y: element.transform.y,
                  width: element.width || 300,
                  height: element.height || 300,
                  rotation: element.transform.rotation,
                  ...(element.transform.cropBox && {
                    cropX: element.transform.cropBox.x,
                    cropY: element.transform.cropBox.y,
                    cropWidth: element.transform.cropBox.width,
                    cropHeight: element.transform.cropBox.height,
                  }),
                });
              }
            } else if (element.type === "video" && element.videoId) {
              const videoData = await canvasStorage.getVideo(element.videoId);
              if (videoData) {
                loadedVideos.push({
                  id: element.id,
                  src: videoData.originalDataUrl,
                  x: element.transform.x,
                  y: element.transform.y,
                  width: element.width || 300,
                  height: element.height || 300,
                  rotation: element.transform.rotation,
                  isVideo: true,
                  duration: element.duration || videoData.duration,
                  currentTime: element.currentTime || 0,
                  isPlaying: element.isPlaying || false,
                  volume: element.volume || 1,
                  muted: element.muted || false,
                  isLoaded: false,
                  ...(element.transform.cropBox && {
                    cropX: element.transform.cropBox.x,
                    cropY: element.transform.cropBox.y,
                    cropWidth: element.transform.cropBox.width,
                    cropHeight: element.transform.cropBox.height,
                  }),
                });
              }
            }
          }

          setImages(loadedImages);
          setVideos(loadedVideos);

          if (savedState.viewport) {
            setViewport(savedState.viewport);
          }
        }
      } catch (error) {
        console.error("Failed to load saved state:", error);
      }
    };

    loadSavedState();
  }, []);

  // Auto-save state
  const saveState = useCallback(
    debounce(async () => {
      try {
        // Convert current state to storage format
        const elements = [
          ...images.map((img) => ({
            id: img.id,
            type: "image" as const,
            imageId: img.id,
            transform: {
              x: img.x,
              y: img.y,
              scale: 1,
              rotation: img.rotation,
              ...(img.cropX !== undefined && {
                cropBox: {
                  x: img.cropX,
                  y: img.cropY || 0,
                  width: img.cropWidth || 1,
                  height: img.cropHeight || 1,
                },
              }),
            },
            zIndex: 0,
            width: img.width,
            height: img.height,
          })),
          ...videos.map((vid) => ({
            id: vid.id,
            type: "video" as const,
            videoId: vid.id,
            transform: {
              x: vid.x,
              y: vid.y,
              scale: 1,
              rotation: vid.rotation,
              ...(vid.cropX !== undefined && {
                cropBox: {
                  x: vid.cropX,
                  y: vid.cropY || 0,
                  width: vid.cropWidth || 1,
                  height: vid.cropHeight || 1,
                },
              }),
            },
            zIndex: 0,
            width: vid.width,
            height: vid.height,
            duration: vid.duration,
            currentTime: vid.currentTime,
            isPlaying: vid.isPlaying,
            volume: vid.volume,
            muted: vid.muted,
          })),
        ];

        const state = {
          elements,
          lastModified: Date.now(),
          viewport,
        };

        canvasStorage.saveCanvasState(state);

        // Save image data to IndexedDB
        for (const img of images) {
          if (img.src.startsWith("data:")) {
            await canvasStorage.saveImage(img.src, img.id);
          }
        }

        // Save video data to IndexedDB
        for (const vid of videos) {
          if (vid.src.startsWith("data:")) {
            await canvasStorage.saveVideo(vid.src, vid.duration, vid.id);
          }
        }
      } catch (error) {
        console.error("Failed to save state:", error);
      }
    }, 1000),
    [images, videos, viewport],
  );

  useEffect(() => {
    saveState();
  }, [saveState]);

  // File upload handling
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            if (result) {
              const img = new window.Image();
              img.onload = () => {
                const id = `image-${Date.now()}-${Math.random()}`;
                const aspectRatio = img.width / img.height;
                const maxSize = 300;
                let width = maxSize;
                let height = maxSize / aspectRatio;

                if (height > maxSize) {
                  height = maxSize;
                  width = maxSize * aspectRatio;
                }

                const viewportCenterX =
                  (canvasSize.width / 2 - viewport.x) / viewport.scale;
                const viewportCenterY =
                  (canvasSize.height / 2 - viewport.y) / viewport.scale;

                const newImage: PlacedImage = {
                  id,
                  src: result,
                  x: viewportCenterX - width / 2,
                  y: viewportCenterY - height / 2,
                  width,
                  height,
                  rotation: 0,
                };

                setImages((prev) => [...prev, newImage]);
                setSelectedIds([id]);
              };
              img.src = result;
            }
          };
          reader.readAsDataURL(file);
        } else if (file.type.startsWith("video/")) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            if (result) {
              const video = document.createElement("video");
              video.onloadedmetadata = () => {
                const id = `video-${Date.now()}-${Math.random()}`;
                const aspectRatio = video.videoWidth / video.videoHeight;
                const maxSize = 300;
                let width = maxSize;
                let height = maxSize / aspectRatio;

                if (height > maxSize) {
                  height = maxSize;
                  width = maxSize * aspectRatio;
                }

                const viewportCenterX =
                  (canvasSize.width / 2 - viewport.x) / viewport.scale;
                const viewportCenterY =
                  (canvasSize.height / 2 - viewport.y) / viewport.scale;

                const newVideo: PlacedVideo = {
                  id,
                  src: result,
                  x: viewportCenterX - width / 2,
                  y: viewportCenterY - height / 2,
                  width,
                  height,
                  rotation: 0,
                  isVideo: true,
                  duration: video.duration,
                  currentTime: 0,
                  isPlaying: false,
                  volume: 1,
                  muted: false,
                  isLoaded: true,
                };

                setVideos((prev) => [...prev, newVideo]);
                setSelectedIds([id]);
              };
              video.src = result;
            }
          };
          reader.readAsDataURL(file);
        }
      }
    },
    [canvasSize, viewport],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "video/*": [".mp4", ".webm", ".mov"],
    },
    noClick: true,
  });

  // History management
  const saveToHistory = useCallback(() => {
    const newState: HistoryState = {
      images: [...images],
      videos: [...videos],
      selectedIds: [...selectedIds],
    };

    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newState);
      return newHistory.slice(-50); // Keep last 50 states
    });

    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [images, videos, selectedIds, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setImages(prevState.images);
      setVideos(prevState.videos || []);
      setSelectedIds(prevState.selectedIds);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setImages(nextState.images);
      setVideos(nextState.videos || []);
      setSelectedIds(nextState.selectedIds);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  // Canvas event handlers
  const handleStageClick = (e: any) => {
    if (e.target === e.target.getStage()) {
      setSelectedIds([]);
    }
  };

  const handleImageSelect = (imageId: string) => {
    setSelectedIds([imageId]);
  };

  const handleVideoSelect = (videoId: string) => {
    setSelectedIds([videoId]);
  };

  // Generation handlers
  const handleRunGeneration = () => {
    handleRun({
      images,
      selectedIds,
      generationSettings,
      customApiKey,
      canvasSize,
      viewport,
      falClient,
      setImages,
      setSelectedIds,
      setActiveGenerations,
      setIsGenerating,
      setIsApiKeyDialogOpen,
      toast,
      generateTextToImage: generateTextToImageMutation.mutateAsync,
    });
  };

  const handleRemoveBackgroundAction = () => {
    handleRemoveBackground({
      images,
      selectedIds,
      setImages,
      toast,
      saveToHistory,
      removeBackground: removeBackgroundMutation.mutateAsync,
      customApiKey,
      falClient,
      setIsApiKeyDialogOpen,
    });
  };

  // Style selection
  const handleStyleSelect = (styleId: string) => {
    const style = styleModels.find((s) => s.id === styleId);
    if (style) {
      setGenerationSettings({
        prompt: style.prompt,
        loraUrl: style.loraUrl || "",
        styleId: style.id,
      });
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-950 text-white">
      {/* Main canvas area */}
      <div
        {...getRootProps()}
        className="relative h-full w-full"
        style={{ cursor: isDraggingCanvas ? "grabbing" : "default" }}
      >
        <input {...getInputProps()} />

        {/* Konva Stage */}
        <Stage
          ref={stageRef}
          width={canvasSize.width}
          height={canvasSize.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          onClick={handleStageClick}
          onTap={handleStageClick}
          draggable={!isDraggingImage}
          onDragStart={() => setIsDraggingCanvas(true)}
          onDragEnd={(e) => {
            setIsDraggingCanvas(false);
            setViewport({
              x: e.target.x(),
              y: e.target.y(),
              scale: viewport.scale,
            });
          }}
        >
          <Layer>
            <CanvasGrid
              viewport={viewport}
              canvasSize={canvasSize}
              gridSize={50}
            />

            {/* Render images */}
            {images.map((image) => (
              <CanvasImage
                key={image.id}
                image={image}
                isSelected={selectedIds.includes(image.id)}
                onSelect={() => handleImageSelect(image.id)}
                onChange={(newAttrs) => {
                  setImages((prev) =>
                    prev.map((img) =>
                      img.id === image.id ? { ...img, ...newAttrs } : img,
                    ),
                  );
                }}
                onDragStart={() => setIsDraggingImage(true)}
                onDragEnd={() => setIsDraggingImage(false)}
                selectedIds={selectedIds}
                images={images}
                setImages={setImages}
                isDraggingImage={isDraggingImage}
                isCroppingImage={croppingImageId === image.id}
                dragStartPositions={dragStartPositions}
              />
            ))}

            {/* Render videos */}
            {videos.map((video) => (
              <CanvasVideo
                key={video.id}
                video={video}
                isSelected={selectedIds.includes(video.id)}
                onSelect={() => handleVideoSelect(video.id)}
                onChange={(newAttrs) => {
                  setVideos((prev) =>
                    prev.map((vid) =>
                      vid.id === video.id ? { ...vid, ...newAttrs } : vid,
                    ),
                  );
                }}
                onDragStart={() => setIsDraggingImage(true)}
                onDragEnd={() => setIsDraggingImage(false)}
                selectedIds={selectedIds}
                videos={videos}
                setVideos={setVideos}
                isDraggingVideo={isDraggingImage}
                isCroppingVideo={false}
                dragStartPositions={dragStartPositions}
              />
            ))}

            {/* Selection box */}
            <SelectionBoxComponent selectionBox={selectionBox} />

            {/* Crop overlay */}
            {croppingImageId && (
              <CropOverlayWrapper
                image={images.find((img) => img.id === croppingImageId)!}
                onCropChange={(crop) => {
                  setImages((prev) =>
                    prev.map((img) =>
                      img.id === croppingImageId ? { ...img, ...crop } : img,
                    ),
                  );
                }}
                onCropEnd={() => setCroppingImageId(null)}
                viewportScale={viewport.scale}
              />
            )}
          </Layer>
        </Stage>

        {/* Video overlays */}
        <VideoOverlays
          videos={videos}
          selectedIds={selectedIds}
          viewport={viewport}
          hiddenVideoControlsIds={new Set()}
          setVideos={setVideos}
        />

        {/* UI overlays */}
        <PoweredByFalBadge />
        <GithubBadge />
        <ZoomControls
          viewport={viewport}
          setViewport={setViewport}
          canvasSize={canvasSize}
        />
        <MiniMap
          images={images}
          videos={videos}
            />
        {/* Top toolbar */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 bg-zinc-900/90 backdrop-blur-sm rounded-full px-4 py-2 border border-zinc-800">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-white hover:bg-zinc-800 rounded-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
            <div className="w-px h-6 bg-zinc-700" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRunGeneration}
              disabled={isGenerating || !generationSettings.prompt.trim()}
              className="text-white hover:bg-zinc-800 rounded-full"
            >
              {isGenerating ? (
                <SpinnerIcon className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Generate
            </Button>
            <div className="w-px h-6 bg-zinc-700" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsApiKeyDialogOpen(true)}
              className="text-white hover:bg-zinc-800 rounded-full"
            >
              <Key className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Bottom control panel */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-zinc-900/90 backdrop-blur-sm rounded-2xl p-6 border border-zinc-800 max-w-2xl w-full mx-4">
            <div className="space-y-4">
              {/* Prompt input */}
              <div>
                <Textarea
                  placeholder="Describe what you want to generate or transform..."
                  value={generationSettings.prompt}
                  onChange={(e) =>
                    setGenerationSettings((prev) => ({
                      ...prev,
                      prompt: e.target.value,
                    }))
                  }
                  className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-400 resize-none"
                  rows={2}
                />
              </div>

              {/* Style grid */}
              <div className="grid grid-cols-6 gap-2">
                {styleModels.slice(0, 12).map((style) => (
                  <button
                    key={style.id}
                    onClick={() => handleStyleSelect(style.id)}
                    className={cn(
                      "relative aspect-square rounded-xl overflow-hidden border-2 transition-all",
                      generationSettings.styleId === style.id
                        ? "border-blue-500 ring-2 ring-blue-500/20"
                        : "border-zinc-700 hover:border-zinc-600"
                    )}
                  >
                    <img
                      src={style.imageSrc}
                      alt={style.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-1 left-1 right-1">
                      <p className="text-xs text-white font-medium truncate">
                        {style.name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            onDrop(files);
            e.target.value = "";
          }}
          className="hidden"
        />

        {/* Drag overlay */}
        {isDragActive && (
          <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 z-50 flex items-center justify-center">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-blue-500 mb-4" />
              <p className="text-lg font-medium text-blue-500">
                Drop files here to upload
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Context menu */}
      <ContextMenu>
        <CanvasContextMenu
          selectedIds={selectedIds}
          images={images}
          videos={videos}
          isGenerating={isGenerating}
          generationSettings={generationSettings}
          isolateInputValue={isolateInputValue}
          isIsolating={isIsolating}
          handleRun={handleRunGeneration}
          handleDuplicate={() => {
            const newImages = images
              .filter((img) => selectedIds.includes(img.id))
              .map((img) => ({
                ...img,
                id: `${img.id}-copy-${Date.now()}`,
                x: img.x + 20,
                y: img.y + 20,
              }));
            setImages((prev) => [...prev, ...newImages]);
          }}
          handleRemoveBackground={handleRemoveBackgroundAction}
          handleCombineImages={() => {
            toast({
              title: "Feature coming soon",
              description: "Image combination will be available soon",
            });
          }}
          handleDelete={() => {
            setImages((prev) =>
              prev.filter((img) => !selectedIds.includes(img.id)),
            );
            setVideos((prev) =>
              prev.filter((vid) => !selectedIds.includes(vid.id)),
            );
            setSelectedIds([]);
          }}
          handleIsolate={() => {
            if (isolateTarget && isolateInputValue.trim()) {
              setIsIsolating(true);
              const image = images.find((img) => img.id === isolateTarget);
              if (image) {
                isolateObjectMutation
                  .mutateAsync({
                    imageUrl: image.src,
                    textInput: isolateInputValue,
                    apiKey: customApiKey || undefined,
                  })
                  .then((result) => {
                    setImages((prev) =>
                      prev.map((img) =>
                        img.id === isolateTarget
                          ? { ...img, src: result.url }
                          : img,
                      ),
                    );
                    toast({
                      title: "Success",
                      description: "Object isolated successfully",
                    });
                  })
                  .catch((error) => {
                    toast({
                      title: "Failed to isolate object",
                      description: error.message,
                      variant: "destructive",
                    });
                  })
                  .finally(() => {
                    setIsIsolating(false);
                    setIsolateInputValue("");
                    setIsolateTarget(null);
                  });
              }
            }
          }}
          setCroppingImageId={setCroppingImageId}
          setIsolateInputValue={setIsolateInputValue}
          setIsolateTarget={setIsolateTarget}
          sendToFront={() => {}}
          sendToBack={() => {}}
          bringForward={() => {}}
          sendBackward={() => {}}
        />
      </ContextMenu>

      {/* API Key Dialog */}
      <Dialog open={isApiKeyDialogOpen} onOpenChange={setIsApiKeyDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>FAL API Key</DialogTitle>
            <DialogDescription>
              Add your FAL API key to bypass rate limits and use your own quota.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="fal_..."
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                className="mt-1 bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsApiKeyDialogOpen(false)}
              className="text-white hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => setIsApiKeyDialogOpen(false)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Streaming components */}
      {Array.from(activeGenerations.entries()).map(([imageId, generation]) => (
        <StreamingImage
          key={imageId}
          imageId={imageId}
          generation={generation}
          onComplete={(id, finalUrl) => {
            setImages((prev) =>
              prev.map((img) => (img.id === id ? { ...img, src: finalUrl } : img)),
            );
            setActiveGenerations((prev) => {
              const newMap = new Map(prev);
              newMap.delete(id);
              return newMap;
            });
          }}
          onError={(id, error) => {
            toast({
              title: "Generation failed",
              description: error,
              variant: "destructive",
            });
            setImages((prev) => prev.filter((img) => img.id !== id));
            setActiveGenerations((prev) => {
              const newMap = new Map(prev);
              newMap.delete(id);
              return newMap;
            });
          }}
          onStreamingUpdate={(id, url) => {
            setImages((prev) =>
              prev.map((img) => (img.id === id ? { ...img, src: url } : img)),
            );
          }}
          apiKey={customApiKey}
        />
      ))}

      {Array.from(activeVideoGenerations.entries()).map(
        ([videoId, generation]) => (
          <StreamingVideo
            key={videoId}
            videoId={videoId}
            generation={generation}
            onComplete={(id, videoUrl, duration) => {
              setVideos((prev) =>
                prev.map((vid) =>
                  vid.id === id
                    ? { ...vid, src: videoUrl, duration, isGenerating: false }
                    : vid,
                ),
              );
              setActiveVideoGenerations((prev) => {
                const newMap = new Map(prev);
                newMap.delete(id);
                return newMap;
              });
            }}
            onError={(id, error) => {
              toast({
                title: "Video generation failed",
                description: error,
                variant: "destructive",
              });
              setVideos((prev) => prev.filter((vid) => vid.id !== id));
              setActiveVideoGenerations((prev) => {
                const newMap = new Map(prev);
                newMap.delete(id);
                return newMap;
              });
            }}
            onProgress={(id, progress, status) => {
              // Update progress if needed
            }}
            apiKey={customApiKey}
          />
        ),
      )}
    </div>
  );
}