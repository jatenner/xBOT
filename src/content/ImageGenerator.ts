/**
 * Simple Image Generator for Posts
 * Creates tasteful, minimal graphics for health/wellness content
 * Uses Canvas API for simple charts, text layouts, and visual elements
 */

import { createCanvas, CanvasRenderingContext2D } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

interface ImageConfig {
  width: number;
  height: number;
  background: string;
  textColor: string;
  accentColor: string;
  theme: 'light' | 'dark' | 'gradient';
}

interface TextElement {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color?: string;
  maxWidth?: number;
}

interface ChartData {
  labels: string[];
  values: number[];
  colors?: string[];
  title?: string;
}

export class ImageGenerator {
  private defaultConfig: ImageConfig = {
    width: 1200,
    height: 675, // 16:9 aspect ratio
    background: '#f8fafc',
    textColor: '#1e293b',
    accentColor: '#3b82f6',
    theme: 'light'
  };

  private themes = {
    light: {
      background: '#f8fafc',
      textColor: '#1e293b', 
      accentColor: '#3b82f6',
      secondary: '#64748b'
    },
    dark: {
      background: '#0f172a',
      textColor: '#f1f5f9',
      accentColor: '#60a5fa',
      secondary: '#94a3b8'
    },
    gradient: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      textColor: '#ffffff',
      accentColor: '#fbbf24',
      secondary: '#e5e7eb'
    }
  };

  /**
   * Generate a text-based quote/tip image
   */
  async generateQuoteImage(
    quote: string, 
    author?: string,
    options?: Partial<ImageConfig>
  ): Promise<Buffer> {
    const config = { ...this.defaultConfig, ...options };
    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');

    // Background
    this.drawBackground(ctx, config);

    // Main quote text
    const lines = this.wrapText(ctx, quote, config.width * 0.8, 48);
    const startY = config.height / 2 - (lines.length * 60) / 2;

    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = config.textColor;
    ctx.textAlign = 'center';

    lines.forEach((line, index) => {
      ctx.fillText(line, config.width / 2, startY + index * 60);
    });

    // Author
    if (author) {
      ctx.font = '32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
      ctx.fillStyle = config.accentColor;
      ctx.fillText(`— ${author}`, config.width / 2, startY + lines.length * 60 + 60);
    }

    // Subtle decorative elements
    this.drawDecorations(ctx, config);

    return canvas.toBuffer('image/png');
  }

  /**
   * Generate a simple progress/comparison chart
   */
  async generateProgressChart(
    data: ChartData,
    options?: Partial<ImageConfig>
  ): Promise<Buffer> {
    const config = { ...this.defaultConfig, ...options };
    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');

    // Background
    this.drawBackground(ctx, config);

    // Title
    if (data.title) {
      ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
      ctx.fillStyle = config.textColor;
      ctx.textAlign = 'center';
      ctx.fillText(data.title, config.width / 2, 80);
    }

    // Chart area
    const chartX = config.width * 0.15;
    const chartY = 150;
    const chartWidth = config.width * 0.7;
    const chartHeight = config.height - 250;

    this.drawBarChart(ctx, data, chartX, chartY, chartWidth, chartHeight, config);

    return canvas.toBuffer('image/png');
  }

  /**
   * Generate a checklist image
   */
  async generateChecklistImage(
    items: string[],
    title: string,
    options?: Partial<ImageConfig>
  ): Promise<Buffer> {
    const config = { ...this.defaultConfig, ...options };
    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');

    // Background
    this.drawBackground(ctx, config);

    // Title
    ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = config.textColor;
    ctx.textAlign = 'center';
    ctx.fillText(title, config.width / 2, 100);

    // Checklist items
    const startY = 180;
    const itemHeight = 60;
    const leftMargin = config.width * 0.2;

    ctx.font = '28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.textAlign = 'left';

    items.slice(0, 8).forEach((item, index) => {
      const y = startY + index * itemHeight;

      // Checkbox
      ctx.strokeStyle = config.accentColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(leftMargin, y - 20, 30, 30);

      // Checkmark
      ctx.strokeStyle = config.accentColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(leftMargin + 6, y - 5);
      ctx.lineTo(leftMargin + 12, y + 2);
      ctx.lineTo(leftMargin + 24, y - 10);
      ctx.stroke();

      // Item text
      ctx.fillStyle = config.textColor;
      const wrappedText = this.wrapText(ctx, item, config.width * 0.6, 28);
      wrappedText.forEach((line, lineIndex) => {
        ctx.fillText(line, leftMargin + 50, y + lineIndex * 32);
      });
    });

    return canvas.toBuffer('image/png');
  }

  /**
   * Generate a before/after comparison image
   */
  async generateBeforeAfterImage(
    beforeText: string,
    afterText: string,
    title: string,
    options?: Partial<ImageConfig>
  ): Promise<Buffer> {
    const config = { ...this.defaultConfig, ...options };
    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');

    // Background
    this.drawBackground(ctx, config);

    // Title
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = config.textColor;
    ctx.textAlign = 'center';
    ctx.fillText(title, config.width / 2, 80);

    // Divider line
    ctx.strokeStyle = config.accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(config.width / 2, 120);
    ctx.lineTo(config.width / 2, config.height - 80);
    ctx.stroke();

    // Before section
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = '#ef4444'; // Red for "before"
    ctx.textAlign = 'center';
    ctx.fillText('BEFORE', config.width / 4, 150);

    ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = config.textColor;
    const beforeLines = this.wrapText(ctx, beforeText, config.width * 0.4, 24);
    beforeLines.forEach((line, index) => {
      ctx.fillText(line, config.width / 4, 200 + index * 30);
    });

    // After section
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = '#22c55e'; // Green for "after"
    ctx.textAlign = 'center';
    ctx.fillText('AFTER', (config.width * 3) / 4, 150);

    ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillStyle = config.textColor;
    const afterLines = this.wrapText(ctx, afterText, config.width * 0.4, 24);
    afterLines.forEach((line, index) => {
      ctx.fillText(line, (config.width * 3) / 4, 200 + index * 30);
    });

    return canvas.toBuffer('image/png');
  }

  /**
   * Draw background with theme support
   */
  private drawBackground(ctx: CanvasRenderingContext2D, config: ImageConfig) {
    if (config.theme === 'gradient') {
      // Simple gradient approximation
      const gradient = ctx.createLinearGradient(0, 0, config.width, config.height);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = config.background;
    }
    
    ctx.fillRect(0, 0, config.width, config.height);
  }

  /**
   * Add subtle decorative elements
   */
  private drawDecorations(ctx: CanvasRenderingContext2D, config: ImageConfig) {
    // Subtle corner elements
    ctx.strokeStyle = config.accentColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.3;

    // Top left
    ctx.beginPath();
    ctx.moveTo(40, 40);
    ctx.lineTo(80, 40);
    ctx.moveTo(40, 40);
    ctx.lineTo(40, 80);
    ctx.stroke();

    // Bottom right
    ctx.beginPath();
    ctx.moveTo(config.width - 40, config.height - 40);
    ctx.lineTo(config.width - 80, config.height - 40);
    ctx.moveTo(config.width - 40, config.height - 40);
    ctx.lineTo(config.width - 40, config.height - 80);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  /**
   * Draw a simple bar chart
   */
  private drawBarChart(
    ctx: CanvasRenderingContext2D,
    data: ChartData,
    x: number,
    y: number,
    width: number,
    height: number,
    config: ImageConfig
  ) {
    const maxValue = Math.max(...data.values);
    const barWidth = width / data.values.length * 0.8;
    const barSpacing = width / data.values.length * 0.2;

    data.values.forEach((value, index) => {
      const barHeight = (value / maxValue) * height * 0.8;
      const barX = x + index * (barWidth + barSpacing);
      const barY = y + height - barHeight;

      // Bar
      ctx.fillStyle = data.colors?.[index] || config.accentColor;
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Value label
      ctx.font = '20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
      ctx.fillStyle = config.textColor;
      ctx.textAlign = 'center';
      ctx.fillText(value.toString(), barX + barWidth / 2, barY - 10);

      // Category label
      ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
      const labelLines = this.wrapText(ctx, data.labels[index], barWidth, 18);
      labelLines.forEach((line, lineIndex) => {
        ctx.fillText(line, barX + barWidth / 2, y + height + 30 + lineIndex * 22);
      });
    });
  }

  /**
   * Wrap text to fit within specified width
   */
  private wrapText(
    ctx: CanvasRenderingContext2D, 
    text: string, 
    maxWidth: number,
    fontSize: number
  ): string[] {
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`;
    
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Save image to file system
   */
  async saveImage(buffer: Buffer, filename: string, directory: string = 'images'): Promise<string> {
    const outputDir = path.join(process.cwd(), directory);
    
    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, buffer);
    
    return filepath;
  }

  /**
   * Generate image based on post content type
   */
  async generateImageForPost(
    content: string,
    type: 'quote' | 'checklist' | 'before_after' | 'tip' | 'stats',
    options?: {
      theme?: 'light' | 'dark' | 'gradient';
      data?: any;
    }
  ): Promise<Buffer> {
    const config = { 
      ...this.defaultConfig, 
      ...(options?.theme ? this.themes[options.theme] : {})
    };

    switch (type) {
      case 'quote':
      case 'tip':
        return this.generateQuoteImage(content, undefined, config);
      
      case 'checklist':
        const items = content.split('\n').filter(line => 
          line.trim().startsWith('-') || line.trim().startsWith('•') || /^\d+\./.test(line.trim())
        );
        return this.generateChecklistImage(items, 'Health Checklist', config);
      
      case 'before_after':
        // Extract before/after from content
        const parts = content.split(/before:|after:/i);
        if (parts.length >= 3) {
          return this.generateBeforeAfterImage(
            parts[1].trim(),
            parts[2].trim(), 
            'Transformation',
            config
          );
        }
        return this.generateQuoteImage(content, undefined, config);
      
      case 'stats':
        if (options?.data) {
          return this.generateProgressChart(options.data, config);
        }
        return this.generateQuoteImage(content, undefined, config);
      
      default:
        return this.generateQuoteImage(content, undefined, config);
    }
  }
}

export const imageGenerator = new ImageGenerator();
