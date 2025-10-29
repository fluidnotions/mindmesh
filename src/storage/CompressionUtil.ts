/**
 * Compression Utilities
 * Handles compression and decompression of file content using gzip
 * Reduces storage costs by 60-80% for large markdown files
 */

import * as pako from 'pako';
import { COMPRESSION_CONFIG } from '../config/dynamodb.config';

/**
 * Compress a string using gzip
 * @param data String to compress
 * @returns Base64-encoded compressed data
 */
export function compress(data: string): string {
  try {
    // Convert string to Uint8Array
    const textEncoder = new TextEncoder();
    const uint8Array = textEncoder.encode(data);

    // Compress using gzip
    const compressed = pako.gzip(uint8Array, {
      level: COMPRESSION_CONFIG.LEVEL,
    });

    // Convert to base64 for storage in DynamoDB
    const base64 = btoa(String.fromCharCode(...Array.from(compressed)));
    return base64;
  } catch (error) {
    console.error('Compression error:', error);
    throw new Error('Failed to compress data');
  }
}

/**
 * Decompress a base64-encoded gzip string
 * @param base64Data Base64-encoded compressed data
 * @returns Original decompressed string
 */
export function decompress(base64Data: string): string {
  try {
    // Decode base64 to Uint8Array
    const binaryString = atob(base64Data);
    const uint8Array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }

    // Decompress using gunzip
    const decompressed = pako.ungzip(uint8Array);

    // Convert Uint8Array back to string
    const textDecoder = new TextDecoder();
    return textDecoder.decode(decompressed);
  } catch (error) {
    console.error('Decompression error:', error);
    throw new Error('Failed to decompress data');
  }
}

/**
 * Check if data should be compressed based on size threshold
 * @param data String to check
 * @returns True if data should be compressed
 */
export function shouldCompress(data: string): boolean {
  if (!COMPRESSION_CONFIG.ENABLED) {
    return false;
  }

  // Calculate size in bytes (UTF-8 encoding)
  const sizeBytes = new TextEncoder().encode(data).length;
  return sizeBytes >= COMPRESSION_CONFIG.MIN_SIZE_BYTES;
}

/**
 * Calculate size of a string in bytes (UTF-8 encoding)
 * @param data String to measure
 * @returns Size in bytes
 */
export function getByteSize(data: string): number {
  return new TextEncoder().encode(data).length;
}

/**
 * Calculate compression ratio
 * @param original Original data
 * @param compressed Compressed data (base64)
 * @returns Compression ratio (0-1, lower is better)
 */
export function getCompressionRatio(original: string, compressed: string): number {
  const originalSize = getByteSize(original);
  const compressedSize = getByteSize(compressed);
  return compressedSize / originalSize;
}

/**
 * Compress content if it meets size threshold, otherwise return original
 * Returns an object indicating whether compression was applied
 */
export interface CompressionResult {
  content: string;
  isCompressed: boolean;
  originalSize: number;
  finalSize: number;
  compressionRatio?: number;
}

/**
 * Smart compression that automatically decides whether to compress
 * @param data String to potentially compress
 * @returns Compression result with metadata
 */
export function smartCompress(data: string): CompressionResult {
  const originalSize = getByteSize(data);

  if (!shouldCompress(data)) {
    return {
      content: data,
      isCompressed: false,
      originalSize,
      finalSize: originalSize,
    };
  }

  try {
    const compressed = compress(data);
    const finalSize = getByteSize(compressed);
    const ratio = finalSize / originalSize;

    // Only use compression if it actually reduces size by at least 10%
    if (ratio < 0.9) {
      return {
        content: compressed,
        isCompressed: true,
        originalSize,
        finalSize,
        compressionRatio: ratio,
      };
    } else {
      // Compression didn't help much, use original
      return {
        content: data,
        isCompressed: false,
        originalSize,
        finalSize: originalSize,
      };
    }
  } catch (error) {
    // If compression fails, return original
    console.warn('Compression failed, using original data:', error);
    return {
      content: data,
      isCompressed: false,
      originalSize,
      finalSize: originalSize,
    };
  }
}

/**
 * Smart decompression that checks if data is compressed before decompressing
 * @param data String that may be compressed
 * @param isCompressed Flag indicating if data is compressed
 * @returns Original decompressed string
 */
export function smartDecompress(data: string, isCompressed: boolean): string {
  if (!isCompressed) {
    return data;
  }

  try {
    return decompress(data);
  } catch (error) {
    console.error('Decompression failed, returning raw data:', error);
    // If decompression fails, return raw data (better than nothing)
    return data;
  }
}

/**
 * Test compression on sample data to estimate effectiveness
 * Useful for deciding compression thresholds
 */
export function testCompression(sampleData: string): {
  originalSize: number;
  compressedSize: number;
  ratio: number;
  saved: number;
  savedPercent: number;
} {
  const originalSize = getByteSize(sampleData);
  const compressed = compress(sampleData);
  const compressedSize = getByteSize(compressed);
  const ratio = compressedSize / originalSize;
  const saved = originalSize - compressedSize;
  const savedPercent = (1 - ratio) * 100;

  return {
    originalSize,
    compressedSize,
    ratio,
    saved,
    savedPercent,
  };
}
