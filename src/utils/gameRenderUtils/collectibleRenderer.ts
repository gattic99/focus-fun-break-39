
import { Coin } from "@/types/gameTypes";
import { getExtensionURL } from "../chromeUtils";

// Create coin images array with your uploaded images
const coinImages: HTMLImageElement[] = [];

// Initialize all coin images with your exact uploaded images
const imageUrls = [
  '/lovable-uploads/d5931b60-291a-4967-acb2-049519d47f35.png',
  '/lovable-uploads/d693ce1c-58d1-408f-a910-ba27104f2c60.png',
  '/lovable-uploads/fc039335-e6e1-4cc5-b0ed-fd8592e45e65.png',
  '/lovable-uploads/edb454cb-c8f0-4c8f-8841-bcba6bd5fa15.png'
];

imageUrls.forEach((url, i) => {
  const img = new Image();
  img.onload = () => {
    console.log(`Coin image ${i + 1} loaded successfully`);
  };
  img.onerror = (err) => {
    console.error(`Error loading coin image ${i + 1}:`, err);
  };
  img.src = url;
  coinImages.push(img);
});

// Draw collectibles with variety
export const drawCollectibles = (
  ctx: CanvasRenderingContext2D,
  coins: Coin[],
  cameraOffsetX: number
) => {
  // Draw each coin
  coins.forEach((coin, i) => {
    if (!coin.collected) {
      const adjustedX = coin.x - cameraOffsetX;

      // Only render coins that are visible on screen or near it
      if (adjustedX < 700 && adjustedX + coin.width > -20) {
        // Increase the rendering size by 50%
        const scaleFactor = 1.5;
        const centerX = adjustedX + coin.width / 2;
        const centerY = coin.y + coin.height / 2;
        const renderWidth = coin.width * scaleFactor;
        const renderHeight = coin.height * scaleFactor;

        // Yellow coin with face (original style)
        // Draw yellow circle background
        ctx.fillStyle = "#FFD746";
        ctx.beginPath();
        ctx.arc(centerX, centerY, renderWidth / 2, 0, Math.PI * 2);
        ctx.fill();

        // Create circular clipping path
        ctx.save();
        
        // Improve image rendering quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, renderWidth / 2 - 1, 0, Math.PI * 2);
        ctx.clip();

        // Draw the image within the clipping path with higher quality
        const imageIndex = i % coinImages.length;
        if (coinImages[imageIndex] && coinImages[imageIndex].complete) {
          ctx.drawImage(
            coinImages[imageIndex],
            centerX - renderWidth / 2,
            centerY - renderHeight / 2,
            renderWidth,
            renderHeight
          );
        }

        // Restore the context
        ctx.restore();

        // Add a subtle border
        ctx.strokeStyle = "#FFD746";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, renderWidth / 2, 0, Math.PI * 2);
        ctx.stroke();

        i++;
      }
    }
  });
};
