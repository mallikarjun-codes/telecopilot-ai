'use strict';

class ToolRegistry {
  constructor(tools = []) {
    this.tools = new Map();
    tools.forEach((tool) => this.register(tool));
  }

  register(tool) {
    if (!tool || typeof tool.name !== 'string' || !tool.name || typeof tool.description !== 'string' || typeof tool.execute !== 'function') {
      throw new TypeError('A tool must implement name, description, and execute().');
    }
    if (this.tools.has(tool.name)) throw new Error(`Tool already registered: ${tool.name}.`);
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}.`);
    return tool;
  }

  execute(name, input) { return this.get(name).execute(input); }
  list() { return [...this.tools.values()].map(({ name, description }) => ({ name, description })); }
}

module.exports = ToolRegistry;
