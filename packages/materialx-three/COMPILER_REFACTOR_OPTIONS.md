# Compiler Refactor Options

This document outlines four ways to refactor `packages/materialx-three/src/compiler.ts` into a more maintainable structure while intentionally avoiding unnecessary complexity.

Current pain points in the file:

- Many responsibilities in one module: value parsing/coercion, node graph traversal, category dispatch, texture helpers, matrix math, and material assembly.
- Large `switch` over node categories that is hard to scan and grows over time.
- Repeated category handler patterns (`resolveInputNode` + call TSL op) that are hard to reuse and test in isolation.
- High risk when editing because unrelated logic is physically coupled.

## Option 1: Extract Utility Modules + Keep Central Switch

### Pattern

Keep the current `compileNode` `switch`, but move supporting logic into focused modules.

Possible split:

- `compiler/value-coercion.ts` (`toNodeValue`, scalar/vector/matrix parsing)
- `compiler/matrix-ops.ts` (`det3`, `det4`, transpose, transform helpers)
- `compiler/input-resolution.ts` (`readInput`, `resolveInputNode`, interface lookup)
- `compiler/texture-nodes.ts` (`compileTextureNode`, glTF texture/image helpers)
- `compiler/warnings.ts` (warning helpers + limitation warnings)

### Why this works

- Lowest conceptual change: no new architecture, just decomposition by responsibility.
- Easier unit testing around pure helpers (matrix/value conversion especially).
- Maintains existing behavior and debugging flow.

### Trade-offs

- The large `switch` remains in one place.
- Category growth still increases `compileNode` length over time.

### Complexity level

Low

### Best when

You want safer incremental refactoring with minimal risk.

---

## Option 2: Handler Registry (Data-Driven Dispatch)

### Pattern

Replace the `switch` with a category-to-handler map, where each handler is a function with a shared signature.

Example shape:

```ts
type NodeHandler = (node: MaterialXNode, context: CompileContext, scopeGraph?: MaterialXNodeGraph, outputName?: string) => unknown;
const handlers: Record<string, NodeHandler> = {
  add: handleAdd,
  multiply: handleMultiply,
  image: handleImage,
  // ...
};
```

`compileNode` becomes:

1. cache lookup
2. handler resolution
3. handler execution or unsupported warning
4. cache store

### Why this works

- Better discoverability: handlers grouped by domain file (`handlers/math.ts`, `handlers/textures.ts`, etc.).
- Easier to add new categories without touching a giant switch block.
- Encourages reusable helper factories for repeated patterns.

### Trade-offs

- Slightly more indirection than switch statements.
- Needs a clear organizational convention so registry files do not become new “god files.”

### Complexity level

Low to Medium

### Best when

You expect supported category count to continue growing.

---

## Option 3: Family-Based Handler Factories

### Pattern

Build small factories for repeated category families, then compose handlers from those factories.

Examples:

- `makeUnaryNumericHandler(inputName, fallback, op)`
- `makeBinaryNumericHandler(leftName, rightName, op)`
- `makeBlendHandler({ fg, bg, mix, formula })`
- `makeTextureSampleHandler({ uvInputName, supportsTiling, colorspace })`

Many current cases become one-line registrations using these factories.

### Why this works

- Greatly reduces boilerplate and copy/paste errors.
- Makes behavioral consistency explicit across related categories.
- Keeps file count modest if factories are grouped by domain.

### Trade-offs

- Over-abstraction risk if factories become too generic.
- Requires discipline to avoid clever but opaque helper signatures.

### Complexity level

Medium

### Best when

You want maintainability gains beyond simple file splitting, but still avoid heavyweight architecture.

---

## Option 4: Two-Layer Compiler Pipeline (Graph Eval + Material Mapping)

### Pattern

Separate compilation into two explicit layers:

1. **Graph evaluator**: resolves MaterialX nodes to intermediate computed node values.
2. **Material mapper**: maps evaluated values to `MeshPhysicalNodeMaterial` assignments (`standard_surface`, `open_pbr_surface`, `gltf_pbr`).

You already partially do this; this option formalizes the boundary and module APIs.

### Why this works

- Stronger separation of concerns and clearer mental model.
- Better testability for evaluator behavior independent of Three material assignment.
- Enables future backends (or diagnostics tooling) with less coupling.

### Trade-offs

- More files and explicit interfaces.
- Higher upfront refactor cost than Options 1–3.

### Complexity level

Medium

### Best when

You anticipate supporting additional shader models/backends over time.

---

## Suggested Path (Low Complexity First)

If your goal is better maintainability **without raising project complexity**, use this sequence:

1. Start with **Option 1** (pure decomposition by responsibility).
2. Move to **Option 2** only after decomposition lands cleanly.
3. Introduce selected **Option 3** factories only for repetitive families (math/blend/texture helpers).
4. Defer **Option 4** unless backend scope grows.

This gives immediate readability/testability wins while keeping architecture changes incremental and reversible.
