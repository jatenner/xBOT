/**
 * 🧠 MEMORY OPTIMIZATION UTILITIES
 * 
 * Provides utilities for memory-efficient operations:
 * - Database pagination helpers
 * - Array clearing utilities
 * - Cache size management
 */

import { getSupabaseClient } from '../db';

/**
 * Process database queries in batches to prevent memory spikes
 */
export async function* processInBatches<T>(
  queryFn: (offset: number, limit: number) => Promise<{ data: T[] | null; error: any }>,
  batchSize: number = 20,
  maxBatches?: number
): AsyncGenerator<T[], void, unknown> {
  let offset = 0;
  let batchCount = 0;
  
  while (true) {
    if (maxBatches && batchCount >= maxBatches) {
      break;
    }
    
    const { data, error } = await queryFn(offset, batchSize);
    
    if (error) {
      console.error(`[MEMORY_OPT] Batch query error:`, error);
      break;
    }
    
    if (!data || data.length === 0) {
      break;
    }
    
    yield data;
    
    // Clear batch from memory immediately after yielding
    offset += batchSize;
    batchCount++;
    
    // Small delay to allow GC
    await new Promise(r => setTimeout(r, 10));
  }
}

/**
 * Clear arrays from memory (help GC)
 */
export function clearArray<T>(arr: T[]): void {
  arr.length = 0;
}

/**
 * Clear multiple arrays at once
 */
export function clearArrays(...arrays: any[][]): void {
  for (const arr of arrays) {
    if (Array.isArray(arr)) {
      arr.length = 0;
    }
  }
}

/**
 * LRU Cache with size limit
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;
  
  constructor(maxSize: number = 10) {
    this.maxSize = maxSize;
  }
  
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    
    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    
    return value;
  }
  
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove oldest (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
  
  getSize(): number {
    return this.cache.size;
  }
  
  getMaxSize(): number {
    return this.maxSize;
  }
}

/**
 * Check if memory is safe for operation
 */
export async function isMemorySafeForOperation(
  operationMemoryMB: number = 50,
  thresholdMB: number = 400
): Promise<{ safe: boolean; currentMB: number; availableMB: number }> {
  try {
    const { MemoryMonitor } = await import('./memoryMonitor');
    const memory = MemoryMonitor.checkMemory();
    
    const availableMB = 512 - memory.rssMB; // Railway limit is 512MB
    const safe = memory.rssMB + operationMemoryMB < thresholdMB;
    
    return {
      safe,
      currentMB: memory.rssMB,
      availableMB
    };
  } catch (error) {
    // If memory check fails, assume safe (don't block operations)
    console.warn('[MEMORY_OPT] Memory check failed, assuming safe:', error);
    return { safe: true, currentMB: 0, availableMB: 512 };
  }
}

/**
 * Paginated database query helper
 */
export async function paginatedQuery<T = any>(
  table: string,
  options: {
    select?: string;
    filters?: Record<string, any>;
    orderBy?: string;
    ascending?: boolean;
    batchSize?: number;
    maxBatches?: number;
  } = {}
): Promise<T[]> {
  const {
    select = '*',
    filters = {},
    orderBy,
    ascending = false,
    batchSize = 20,
    maxBatches
  } = options;
  
  const supabase = getSupabaseClient();
  const results: T[] = [];
  
  let offset = 0;
  let batchCount = 0;
  
  while (true) {
    if (maxBatches && batchCount >= maxBatches) {
      break;
    }
    
    let query = supabase
      .from(table)
      .select(select)
      .range(offset, offset + batchSize - 1);
    
    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    
    // Apply ordering
    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`[MEMORY_OPT] Paginated query error:`, error);
      break;
    }
    
    if (!data || data.length === 0) {
      break;
    }
    
    // Type assertion for data array
    results.push(...(data as T[]));
    
    // Clear batch from memory after processing
    offset += batchSize;
    batchCount++;
    
    // If we got fewer than batchSize, we're done
    if (data.length < batchSize) {
      break;
    }
    
    // Small delay for GC
    await new Promise(r => setTimeout(r, 10));
  }
  
  return results;
}

