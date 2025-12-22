import type { NodeDefinition } from '../types';

// Import JSON definitions
import mathNodes from '../node-definitions/math.json';
import vectorNodes from '../node-definitions/vector.json';
import inputNodes from '../node-definitions/input.json';
import colorNodes from '../node-definitions/color.json';
import outputNodes from '../node-definitions/output.json';
import patternNodes from '../node-definitions/pattern.json';

export class NodeDefinitionLoader {
  private definitions: Map<string, NodeDefinition> = new Map();
  private categories: Map<string, NodeDefinition[]> = new Map();

  constructor() {
    this.loadDefinitions();
  }

  private loadDefinitions(): void {
    const allNodes: NodeDefinition[] = [
      ...(mathNodes as NodeDefinition[]),
      ...(vectorNodes as NodeDefinition[]),
      ...(inputNodes as NodeDefinition[]),
      ...(colorNodes as NodeDefinition[]),
      ...(outputNodes as NodeDefinition[]),
      ...(patternNodes as NodeDefinition[]),
    ];

    for (const def of allNodes) {
      this.definitions.set(def.id, def);
      
      const categoryList = this.categories.get(def.category) || [];
      categoryList.push(def);
      this.categories.set(def.category, categoryList);
    }
  }

  getDefinition(id: string): NodeDefinition | undefined {
    return this.definitions.get(id);
  }

  getAllDefinitions(): NodeDefinition[] {
    return Array.from(this.definitions.values());
  }

  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  getDefinitionsByCategory(category: string): NodeDefinition[] {
    return this.categories.get(category) || [];
  }

  searchDefinitions(query: string): NodeDefinition[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllDefinitions().filter(def => 
      def.name.toLowerCase().includes(lowerQuery) ||
      def.description.toLowerCase().includes(lowerQuery) ||
      def.category.toLowerCase().includes(lowerQuery)
    );
  }
}

// Singleton instance
export const nodeDefinitionLoader = new NodeDefinitionLoader();

