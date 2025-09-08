# Immer Draft Propagation Analysis

## The Critical Flow: Session Reference Propagation

### Step 1: Draft Creation in useImmutableCombatState
```typescript
// useImmutableCombatState.ts:40-45
const executeInDraft = useCallback((fn) => {
  const draftSession = createDraft(state.session); // ← Creates Immer proxy

  const result = fn(draftSession, context); // ← Passes draft to function

  const newSession = finishDraft(draftSession); // ← Finalizes mutations
});
```

### Step 2: Intent Execution Receives Draft
```typescript
// Called from executeCommand:
executeInDraft((draftSession, ctx) => {
  const intentExecutor = useIntentExecution(ctx, draftSession, currentActorId);
  //                                           ↑
  //                                    Draft session passed here
  return intentExecutor.executeIntent("Attack Bob");
});
```

### Step 3: Intent Executor Creates Combatant Hook with Draft
```typescript
// execution.ts:207
const combatantHook = useCombatantImpl(context, session, actor);
//                                             ↑
//                                      This is the draftSession!
```

### Step 4: Combatant Hook Gets Draft Combatant
```typescript
// combatant.ts:55
export function useCombatant(context, session, actor) {
  const combatant = session.data.combatants.get(actor.id);
  //                ↑                        ↑
  //         Draft session            Draft combatant object

  return {
    combatant, // ← This is a draft combatant!
    attack: () => { /* mutations will affect draft */ },
    // ...
  };
}
```

### Step 5: Direct Mutations on Draft Objects
```typescript
// deductAp function (combatant.ts:30)
export function deductAp(combatant: Combatant, apCost: number): void {
  combatant.ap.eff.cur -= apCost; // ← Direct mutation on draft object!
}

// Called from action methods like:
// advance.ts:170, strike.ts:132, defend.ts:17
deductAp(combatant, cost.ap);
```

## The Magic: Object Reference Identity

The key insight is that **the same object reference** flows through the entire chain:

```typescript
// These are all the SAME object reference:
const draftSession = createDraft(state.session);           // 1. Immer proxy created
useIntentExecution(ctx, draftSession, actorId);            // 2. Passed to intent executor
useCombatant(ctx, draftSession, actor);                    // 3. Passed to combatant hook
const combatant = draftSession.data.combatants.get(id);   // 4. Draft combatant extracted
deductAp(combatant, cost);                                 // 5. Draft combatant mutated
```

## Immer's Proxy Mechanism

### What Happens Under the Hood:
```typescript
const draftSession = createDraft(originalSession);
// draftSession is a Proxy that:
// 1. Intercepts all property access
// 2. Creates draft copies on first write
// 3. Tracks all mutations

// When we do:
combatant.ap.eff.cur -= 5;

// Immer internally does:
// 1. Detects write to combatant.ap.eff.cur
// 2. Creates draft copy of combatant if not already drafted
// 3. Creates draft copy of combatant.ap if not already drafted
// 4. Creates draft copy of combatant.ap.eff if not already drafted
// 5. Performs the mutation on the draft copy
// 6. Tracks this change for finishDraft()
```

## Copy-on-Write Behavior

### First Access (Read):
```typescript
const currentAP = combatant.ap.eff.cur; // No copy made, reads from original
```

### First Mutation (Write):
```typescript
combatant.ap.eff.cur -= 5; // Copy-on-write triggered:
// 1. combatant gets drafted (shallow copy)
// 2. combatant.ap gets drafted (shallow copy)
// 3. combatant.ap.eff gets drafted (shallow copy)
// 4. Mutation applied to draft copy
```

### Subsequent Mutations:
```typescript
combatant.ap.eff.cur -= 3; // Uses existing draft copy, no additional copying
```

## Performance Characteristics

### ✅ Efficient (Copy-on-Write):
- Only objects that are actually mutated get copied
- Unchanged objects remain as references to originals
- Minimal memory overhead for sparse mutations

### ✅ Transparent to Game Logic:
```typescript
// Game code doesn't know it's working with drafts:
deductAp(combatant, 2.5);           // Same API
combatant.position.coordinate = 150; // Same API
combatant.target = 'flux:actor:bob'; // Same API
```

## The Finalization Process

### When executeInDraft Completes:
```typescript
const newSession = finishDraft(draftSession);
// Immer creates new immutable object tree:
// 1. All drafted objects become immutable
// 2. Unchanged objects are reused (structural sharing)
// 3. New root object with new reference
// 4. Original session remains completely unchanged
```

### React State Update:
```typescript
setState({ session: newSession }); // New reference triggers re-render
```

## Example: Complete Mutation Flow

### Input: "Attack Bob"
```typescript
// 1. Draft creation
const draftSession = createDraft(originalSession);

// 2. Intent execution creates combatant hook with draft
const combatantHook = useCombatant(context, draftSession, alice);

// 3. Attack action executes multiple mutations:
combatantHook.target('flux:actor:bob');  // Sets combatant.target
combatantHook.attack();                  // Calls deductAp, updates position, etc.

// 4. Multiple mutations on same draft:
combatant.target = 'flux:actor:bob';     // Mutation 1
combatant.ap.eff.cur -= 2.5;            // Mutation 2
combatant.position.coordinate = 145;     // Mutation 3

// 5. Finalization creates new immutable tree
const newSession = finishDraft(draftSession);
// newSession has all mutations applied immutably
// originalSession is completely unchanged
```

## Why This Architecture Works

1. **Transparent Mutations**: Game logic uses normal mutation syntax
2. **Automatic Tracking**: Immer tracks all changes automatically
3. **Immutable Results**: Consumers get proper immutable updates
4. **Performance**: Only mutated objects are copied (structural sharing)
5. **Type Safety**: No type casting needed, drafts have same interface
6. **Error Safety**: Failed operations don't corrupt original state

This creates the perfect bridge between mutation-based game logic and immutable React state management.
