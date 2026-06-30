'use strict';

const ToolRegistry = require('../services/tool-registry.service');

describe('ToolRegistry', () => {
  it('registers and executes tools through the stable interface', async () => {
    const tool = { name: 'echo', description: 'Echoes input', execute: jest.fn(async (value) => value) };
    const registry = new ToolRegistry([tool]);
    await expect(registry.execute('echo', { value: 1 })).resolves.toEqual({ value: 1 });
    expect(registry.list()).toEqual([{ name: 'echo', description: 'Echoes input' }]);
  });

  it('rejects invalid and duplicate tools', () => {
    expect(() => new ToolRegistry([{}])).toThrow(/must implement/);
    const registry = new ToolRegistry([{ name: 'x', description: 'x', execute() {} }]);
    expect(() => registry.register({ name: 'x', description: 'x', execute() {} })).toThrow(/already registered/);
  });
});
