/**
 * 🔗 DEPENDENCY GRAPH FRAMEWORK
 * 
 * Tracks dependencies between system components to prevent circular dependencies
 * and ensure proper initialization order.
 */

export interface DependencyNode {
  id: string;
  name: string;
  dependencies: string[];
  dependents: string[];
  status: 'pending' | 'ready' | 'failed';
  metadata?: Record<string, any>;
}

export class DependencyGraph {
  private static instance: DependencyGraph;
  private nodes: Map<string, DependencyNode> = new Map();
  private initializationOrder: string[] = [];
  
  private constructor() {
    console.log('[DEPENDENCY_GRAPH] Initialized');
  }
  
  public static getInstance(): DependencyGraph {
    if (!DependencyGraph.instance) {
      DependencyGraph.instance = new DependencyGraph();
    }
    return DependencyGraph.instance;
  }
  
  /**
   * Register a component with its dependencies
   */
  register(id: string, name: string, dependencies: string[] = []): void {
    const node: DependencyNode = {
      id,
      name,
      dependencies: [...dependencies],
      dependents: [],
      status: 'pending',
      metadata: {}
    };
    
    this.nodes.set(id, node);
    
    // Update dependents for each dependency
    for (const depId of dependencies) {
      if (!this.nodes.has(depId)) {
        // Create placeholder for unknown dependency
        this.nodes.set(depId, {
          id: depId,
          name: depId,
          dependencies: [],
          dependents: [id],
          status: 'pending'
        });
      } else {
        const depNode = this.nodes.get(depId)!;
        if (!depNode.dependents.includes(id)) {
          depNode.dependents.push(id);
        }
      }
    }
    
    console.log(`[DEPENDENCY_GRAPH] Registered: ${name} (${id}) - depends on: [${dependencies.join(', ')}]`);
  }
  
  /**
   * Mark a component as ready
   */
  markReady(id: string): void {
    const node = this.nodes.get(id);
    if (node) {
      node.status = 'ready';
      console.log(`[DEPENDENCY_GRAPH] ✅ ${node.name} (${id}) is ready`);
    }
  }
  
  /**
   * Mark a component as failed
   */
  markFailed(id: string, error?: string): void {
    const node = this.nodes.get(id);
    if (node) {
      node.status = 'failed';
      if (error) {
        node.metadata = { ...node.metadata, error };
      }
      console.error(`[DEPENDENCY_GRAPH] ❌ ${node.name} (${id}) failed: ${error || 'Unknown error'}`);
    }
  }
  
  /**
   * Get initialization order (topological sort)
   */
  getInitializationOrder(): string[] {
    if (this.initializationOrder.length > 0) {
      return [...this.initializationOrder];
    }
    
    const visited = new Set<string>();
    const tempMark = new Set<string>();
    const order: string[] = [];
    
    const visit = (nodeId: string): void => {
      if (tempMark.has(nodeId)) {
        throw new Error(`Circular dependency detected involving: ${nodeId}`);
      }
      
      if (visited.has(nodeId)) {
        return;
      }
      
      tempMark.add(nodeId);
      const node = this.nodes.get(nodeId);
      
      if (node) {
        for (const depId of node.dependencies) {
          visit(depId);
        }
      }
      
      tempMark.delete(nodeId);
      visited.add(nodeId);
      order.push(nodeId);
    };
    
    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    }
    
    this.initializationOrder = order;
    return [...order];
  }
  
  /**
   * Check if all dependencies are ready
   */
  canInitialize(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) {
      return false;
    }
    
    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (!depNode || depNode.status !== 'ready') {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get blocking dependencies (not ready)
   */
  getBlockingDependencies(id: string): string[] {
    const node = this.nodes.get(id);
    if (!node) {
      return [];
    }
    
    const blocking: string[] = [];
    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (!depNode || depNode.status !== 'ready') {
        blocking.push(depId);
      }
    }
    
    return blocking;
  }
  
  /**
   * Get health status
   */
  getHealthStatus(): {
    total: number;
    ready: number;
    pending: number;
    failed: number;
    circularDependencies: boolean;
  } {
    let ready = 0;
    let pending = 0;
    let failed = 0;
    let circularDependencies = false;
    
    try {
      this.getInitializationOrder();
    } catch (error) {
      circularDependencies = true;
    }
    
    for (const node of this.nodes.values()) {
      if (node.status === 'ready') ready++;
      else if (node.status === 'failed') failed++;
      else pending++;
    }
    
    return {
      total: this.nodes.size,
      ready,
      pending,
      failed,
      circularDependencies
    };
  }
  
  /**
   * Get visualization (for debugging)
   */
  visualize(): string {
    const lines: string[] = ['Dependency Graph:'];
    
    for (const node of this.nodes.values()) {
      const statusIcon = node.status === 'ready' ? '✅' : node.status === 'failed' ? '❌' : '⏳';
      lines.push(`${statusIcon} ${node.name} (${node.id})`);
      
      if (node.dependencies.length > 0) {
        lines.push(`   └─ depends on: ${node.dependencies.join(', ')}`);
      }
      
      if (node.dependents.length > 0) {
        lines.push(`   └─ used by: ${node.dependents.join(', ')}`);
      }
    }
    
    return lines.join('\n');
  }
}

// Export singleton
export const dependencyGraph = DependencyGraph.getInstance();

